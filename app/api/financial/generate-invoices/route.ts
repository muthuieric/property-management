import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import {
  calculateInvoice,
  getServiceChargeRate,
  nextInvoiceNumber,
  money,
  formatKES,
} from '@/app/lib/financial/engine'
import { generateInvoicePdf, type InvoicePdfData } from '@/app/lib/pdf/invoice-generator'
import { sendEmail } from '@/app/lib/notifications'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Cron / manual trigger: generates monthly invoices for all active leases.
// Runs on the 1st of every month via Vercel Cron (/api/cron/generate-invoices),
// or can be invoked manually with ?billing_month=YYYY-MM.
export async function GET(req: Request): Promise<Response> {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.VERCEL_CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const billingMonth = searchParams.get('billing_month') || new Date().toISOString().slice(0, 7)

  const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  try {
    const { data: agencies, error: agenciesErr } = await admin
      .from('agencies')
      .select('id, name')

    if (agenciesErr) {
      return NextResponse.json({ error: agenciesErr.message }, { status: 500 })
    }

    const results: Array<{
      agencyId: string
      agencyName: string | null
      generated: number
      skipped: number
      totalAmount: number
      emailed: number
      emailErrors: number
    }> = []

    let grandGenerated = 0
    let grandTotal = 0

    for (const agency of (agencies ?? [])) {
      const agencyId = agency.id

      // Fetch all active leases for this agency with units, tenants, properties
      const { data: leases, error: leasesErr } = await admin
        .from('leases')
        .select(
          `
          id,
          tenant_id,
          unit_id,
          agency_id,
          start_date,
          end_date,
          is_active,
          lease_status,
          escalation_percentage,
          years_elapsed,
          units ( id, unit_number, base_rent, square_footage, property_id ),
          tenants ( id, first_name, last_name, email ),
          properties ( id, name )
        `
        )
        .eq('agency_id', agencyId)
        .eq('is_active', true)
        .eq('lease_status', 'active')

      if (leasesErr) {
        results.push({
          agencyId,
          agencyName: agency.name,
          generated: 0,
          skipped: 0,
          totalAmount: 0,
          emailed: 0,
          emailErrors: 1,
        })
        continue
      }

      // Check existing invoices for this billing month to avoid duplicates
      const { data: existing } = await admin
        .from('invoices')
        .select('lease_id')
        .eq('agency_id', agencyId)
        .eq('billing_month', billingMonth)
      const existingLeaseIds = new Set((existing ?? []).map((i) => i.lease_id))

      let generated = 0
      let skipped = 0
      let totalAmount = 0
      let emailed = 0
      let emailErrors = 0

      const toInsert: any[] = []
      const invoiceJobs: Array<{
        id: string
        invoiceNumber: string
        tenantEmail: string | null
        tenantName: string
        billingMonth: string
        totalAmount: number
        companyName: string | null
        vatPin: string | null
        taxPin: string | null
        bankName: string | null
        bankAccountName: string | null
        bankAccountNumber: string | null
        bankBranch: string | null
        baseRent: number
        serviceCharge: number
        vatAmount: number
        interestPenalty: number
        escalationPercentage: number
        yearsElapsed: number
      }> = []

      for (const lease of (leases ?? [])) {
        const leaseId = (lease as any).id
        if (existingLeaseIds.has(leaseId)) {
          skipped++
          continue
        }

        const unit = (lease as any).units as {
          id: string
          unit_number: string | null
          base_rent: number | null
          square_footage: number | null
          property_id: string | null
        } | null
        const tenant = (lease as any).tenants as {
          id: string
          first_name: string | null
          last_name: string | null
          email: string | null
        } | null
        const property = (lease as any).properties as { id: string; name: string } | null

        const baseRent = Number(unit?.base_rent || 0)
        const escalationPct = Number((lease as any).escalation_percentage || 0)
        const startDate = (lease as any).start_date as string | null

        // Get service charge rate for this property
        const ratePerSqft = await getServiceChargeRate({
          agencyId,
          propertyId: unit?.property_id ?? null,
          billingMonth,
        })

        const calc = calculateInvoice({
          baseRent,
          squareFootage: unit?.square_footage ?? null,
          ratePerSqft,
          escalationPercentage: escalationPct,
          startDate,
          billingMonth,
        })

        const invoiceNumber = await nextInvoiceNumber({
          agencyId,
          prefix: 'KHL',
        })
        if (!invoiceNumber) {
          skipped++
          continue
        }

        toInsert.push({
          agency_id: agencyId,
          property_id: property?.id ?? null,
          tenant_id: (lease as any).tenant_id,
          lease_id: leaseId,
          billing_month: billingMonth,
          base_rent_amount: calc.baseRentAmount,
          utilities_amount: 0,
          service_charge_amount: calc.serviceChargeAmount,
          service_charge_rate: calc.serviceChargeRate,
          total_amount: calc.totalAmount,
          interest_penalty_amount: 0,
          escalation_applied: calc.escalationApplied,
          years_elapsed: calc.yearsElapsed,
          status: 'unpaid',
          vat_rate: calc.vatRate,
          vat_amount: calc.vatAmount,
          invoice_number: invoiceNumber,
          created_at: new Date().toISOString(),
        })

        invoiceJobs.push({
          id: leaseId,
          invoiceNumber,
          tenantEmail: tenant?.email ?? null,
          tenantName: `${tenant?.first_name ?? ''} ${tenant?.last_name ?? ''}`.trim() || 'Unknown Tenant',
          billingMonth,
          totalAmount: calc.totalAmount,
          companyName: null, // filled below
          vatPin: null,
          taxPin: null,
          bankName: null,
          bankAccountName: null,
          bankAccountNumber: null,
          bankBranch: null,
          baseRent: calc.escalatedBaseRent,
          serviceCharge: calc.escalatedServiceCharge,
          vatAmount: calc.vatAmount,
          interestPenalty: 0,
          escalationPercentage: escalationPct,
          yearsElapsed: calc.yearsElapsed,
        })

        generated++
        totalAmount += calc.totalAmount
      }

      if (toInsert.length > 0) {
        const { error: insertErr } = await admin.from('invoices').insert(toInsert)
        if (insertErr) {
          results.push({
            agencyId,
            agencyName: agency.name,
            generated: 0,
            skipped,
            totalAmount: 0,
            emailed: 0,
            emailErrors: 1,
          })
          continue
        }
      }

      // Fetch inserted invoices with billing identity for PDF + email
      const insertedLeaseIds = toInsert.map((i) => i.lease_id)
      if (insertedLeaseIds.length > 0) {
        const { data: insertedInvoices } = await admin
          .from('invoices')
          .select(
            `
            id, invoice_number, billing_month, base_rent_amount, service_charge_amount,
            service_charge_rate, vat_rate, vat_amount, interest_penalty_amount,
            escalation_applied, years_elapsed, total_amount, status, created_at,
            tenants ( first_name, last_name, email ),
            units ( unit_number, properties ( name ) ),
            leases ( escalation_percentage ),
            agency_billing_identity ( company_name, vat_pin, tax_pin, email, phone,
              bank_name, bank_account_name, bank_account_number, bank_branch )
          `
          )
          .in('id', insertedLeaseIds)
          .eq('agency_id', agencyId)

        if (insertedInvoices) {
          for (const inv of (insertedInvoices as any[])) {
            const tenant = inv.tenants?.[0] ?? null
            const unit = inv.leases?.[0]?.units ?? null
            const billingIdentity = inv.agency_billing_identity ?? null

            const pdfData: InvoicePdfData = {
              invoiceId: inv.id,
              invoiceNumber: inv.invoice_number ?? `KHL-${inv.id.slice(0, 8)}`,
              isCreditNote: false,
              billingMonth: inv.billing_month,
              tenantName: `${tenant?.first_name ?? ''} ${tenant?.last_name ?? ''}`.trim() || 'Unknown',
              unitNumber: unit?.unit_number ?? null,
              propertyName: unit?.properties?.name ?? null,
              baseRent: Number(inv.base_rent_amount || 0),
              serviceChargeAmount: Number(inv.service_charge_amount || 0),
              escalationPercentage: Number((inv.leases as any[])?.[0]?.escalation_percentage ?? 0),
              yearsElapsed: Number(inv.years_elapsed || 0),
              escalatedBaseRent: Number(inv.base_rent_amount || 0),
              escalatedServiceCharge: Number(inv.service_charge_amount || 0),
              vatRate: Number(inv.vat_rate || 16),
              vatAmount: Number(inv.vat_amount || 0),
              interestPenalty: Number(inv.interest_penalty_amount || 0),
              totalAmount: Number(inv.total_amount || 0),
              status: inv.status,
              companyName: billingIdentity?.company_name ?? 'Luffi Tech Property Management',
              vatPin: billingIdentity?.vat_pin ?? null,
              taxPin: billingIdentity?.tax_pin ?? null,
              companyEmail: billingIdentity?.email ?? null,
              companyPhone: billingIdentity?.phone ?? null,
              bankName: billingIdentity?.bank_name ?? null,
              bankAccountName: billingIdentity?.bank_account_name ?? null,
              bankAccountNumber: billingIdentity?.bank_account_number ?? null,
              bankBranch: billingIdentity?.bank_branch ?? null,
              issuedAt: inv.created_at,
            }

            const pdfBuffer = generateInvoicePdf(pdfData)

            // Upload to Supabase Storage
            const fileName = `invoices/${inv.id}.pdf`
            let pdfUrl: string | null = null
            const { error: uploadError } = await admin.storage
              .from('invoices')
              .upload(fileName, pdfBuffer, {
                contentType: 'application/pdf',
                upsert: true,
              })

            if (!uploadError) {
              const { data: urlData } = await admin.storage
                .from('invoices')
                .getPublicUrl(fileName)
              pdfUrl = urlData.publicUrl

              await admin.from('invoices').update({ pdf_url: pdfUrl }).eq('id', inv.id)
            }

            // Email PDF to tenant
            const tenantEmail = tenant?.email
            if (tenantEmail && pdfUrl) {
              const html = `
                <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#134E4A;">
                  <h1 style="color:#0F766E;">${billingIdentity?.company_name ?? 'Luffi Tech Property Management'}</h1>
                  <h2>Invoice ${inv.invoice_number}</h2>
                  <p>Dear ${tenant?.first_name ?? ''} ${tenant?.last_name ?? ''},</p>
                  <p>Your invoice for <strong>${new Date(inv.billing_month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong> is ready.</p>
                  <p><strong>Total Amount:</strong> ${formatKES(Number(inv.total_amount || 0))}</p>
                  ${pdfUrl ? `<p><a href="${pdfUrl}" style="background:#0369A1;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">Download Invoice PDF</a></p>` : ''}
                  <p style="margin-top:24px;color:#475569;font-size:14px;">Pay via RTGS or Cheque to I&amp;M Bank. Please quote the Invoice Number as reference.</p>
                </div>
              `
              const emailResult = await sendEmail({
                to: tenantEmail,
                subject: `Invoice ${inv.invoice_number}`,
                html,
                text: `Invoice ${inv.invoice_number}. Total: ${formatKES(Number(inv.total_amount || 0))}.`,
              })
              if (emailResult.success) emailed++
              else emailErrors++
            }
          }
        }
      }

      results.push({
        agencyId,
        agencyName: agency.name,
        generated,
        skipped,
        totalAmount,
        emailed,
        emailErrors,
      })

      grandGenerated += generated
      grandTotal += totalAmount
    }

    return NextResponse.json({
      status: 'ok',
      billingMonth,
      agencies: results.length,
      totalGenerated: grandGenerated,
      totalEmailed: results.reduce((s, r) => s + r.emailed, 0),
      totalErrors: results.reduce((s, r) => s + r.emailErrors, 0),
      grandTotal: money(grandTotal),
      results,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Invoice generation failed' }, { status: 500 })
  }
}

export async function POST(req: Request): Promise<Response> {
  return GET(req)
}
