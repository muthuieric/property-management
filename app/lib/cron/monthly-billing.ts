'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { generateInvoicePdf, type InvoicePdfData } from '@/app/lib/pdf/invoice-generator'
import { sendEmail } from '@/app/lib/notifications'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const VAT_RATE = 16
const ESCALATION_RATE = 0.03

function money(value: number): number {
  return Math.round(value * 100) / 100
}

function yearsElapsed(startDate: string | null, billingMonth: string): number {
  if (!startDate) return 0
  const start = new Date(startDate + 'T00:00:00')
  const [by, bm] = billingMonth.split('-').map(Number)
  const billing = new Date(by, bm - 1, 1)
  let years = billing.getFullYear() - start.getFullYear()
  if (billing.getMonth() < start.getMonth()) years--
  return Math.max(0, years)
}

function applyEscalation(amount: number, rate: number, years: number): number {
  if (years <= 0 || rate <= 0) return money(amount)
  return money(amount * Math.pow(1 + rate, years))
}

interface CronLease {
  id: string
  tenant_id: string
  unit_id: string | null
  agency_id: string
  start_date: string | null
  end_date: string | null
  is_active: boolean
  lease_status: string
  escalation_percentage: number | null
  units: {
    id: string
    unit_number: string | null
    base_rent: number | null
    square_footage: number | null
    parent_unit_id: string | null
    properties: { id: string; name: string } | null
  } | null
  tenants: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    phone_number: string | null
  } | null
}

interface CronUnit {
  id: string
  unit_number: string | null
  square_footage: number | null
  parent_unit_id: string | null
  property_id: string | null
}

function getMergeGroup(
  unit: CronUnit | null,
  allUnits: CronUnit[]
): { unitNumbers: string[]; totalSquareFootage: number } {
  if (!unit) return { unitNumbers: [], totalSquareFootage: 0 }
  let root = unit
  const visited = new Set<string>()
  while (root.parent_unit_id && !visited.has(root.parent_unit_id)) {
    visited.add(root.parent_unit_id)
    const parent = allUnits.find((u) => u.id === root.parent_unit_id)
    if (!parent) break
    root = parent
  }
  const groupUnits = allUnits.filter(
    (u) => u.id === root.id || u.parent_unit_id === root.id
  )
  const unitNumbers = groupUnits
    .map((u) => u.unit_number)
    .filter((n): n is string => n !== null)
    .sort()
  const totalSquareFootage = groupUnits.reduce(
    (sum, u) => sum + (Number(u.square_footage) || 0),
    0
  )
  return { unitNumbers, totalSquareFootage }
}

async function getServiceChargeRate(
  supabase: any,
  agencyId: string,
  propertyId: string | null,
  billingMonth: string
): Promise<number> {
  const [by, bm] = billingMonth.split('-').map(Number)
  const billingDate = new Date(by, bm - 1, 1).toISOString().slice(0, 10)
  const { data: rates, error } = await supabase
    .from('service_rates')
    .select('rate_per_sqft, effective_date, expiry_date, property_id')
    .eq('agency_id', agencyId)
    .lte('effective_date', billingDate)
    .order('effective_date', { ascending: false })
  if (error || !rates) return 0
  const validRates = rates.filter((r: any) => {
    if (r.expiry_date && r.expiry_date < billingDate) return false
    return true
  })
  const propertyRate = validRates.find((r: any) => r.property_id === propertyId)
  if (propertyRate) return Number(propertyRate.rate_per_sqft)
  const globalRate = validRates.find((r: any) => !r.property_id)
  if (globalRate) return Number(globalRate.rate_per_sqft)
  return 0
}

async function nextInvoiceNumber(
  supabase: any,
  agencyId: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('invoice_sequences')
    .select('*')
    .eq('agency_id', agencyId)
    .single()
  let prefix = 'INV'
  let lastNumber = 0
  if (existing) {
    prefix = existing.prefix || 'INV'
    lastNumber = Number(existing.last_number || 0)
  }
  const nextNumber = lastNumber + 1
  const invoiceNumber = `${prefix}/${nextNumber}`
  if (existing) {
    await supabase
      .from('invoice_sequences')
      .update({ last_number: nextNumber })
      .eq('agency_id', agencyId)
  } else {
    await supabase
      .from('invoice_sequences')
      .insert({ agency_id: agencyId, prefix, last_number: nextNumber })
  }
  return invoiceNumber
}

export interface MonthlyBillingResult {
  agencyId: string
  billingMonth: string
  generated: number
  skipped: number
  totalAmount: number
  emailed: number
  emailErrors: number
  errors: string[]
}

export async function runMonthlyBilling({
  agencyId,
  billingMonth,
}: {
  agencyId: string
  billingMonth: string
}): Promise<MonthlyBillingResult> {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  const supabase = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const errors: string[] = []
  let generated = 0
  let skipped = 0
  let totalAmount = 0
  let emailed = 0
  let emailErrors = 0

  // Fetch all active leases for this agency
  const { data: leases, error: leasesErr } = await supabase
    .from('leases')
    .select(
      `
      id, tenant_id, unit_id, agency_id, start_date, end_date,
      is_active, lease_status, escalation_percentage,
      units ( id, unit_number, base_rent, square_footage, parent_unit_id,
        properties ( id, name ) ),
      tenants ( id, first_name, last_name, email, phone_number )
    `
    )
    .eq('agency_id', agencyId)
    .eq('is_active', true)
    .eq('lease_status', 'active')

  if (leasesErr || !leases) {
    return { agencyId, billingMonth, generated: 0, skipped: 0, totalAmount: 0, emailed: 0, emailErrors: 0, errors: [leasesErr?.message ?? 'Failed to fetch leases'] }
  }

  // Fetch all units for merge groups
  const { data: allUnits, error: unitsErr } = await supabase
    .from('units')
    .select('id, unit_number, square_footage, parent_unit_id, property_id')
    .eq('agency_id', agencyId)
  const unitsMap = (allUnits || []) as CronUnit[]

  // Check existing invoices for this month
  const { data: existing } = await supabase
    .from('invoices')
    .select('lease_id')
    .eq('agency_id', agencyId)
    .eq('billing_month', billingMonth)
  const existingLeaseIds = new Set((existing || []).map((i) => i.lease_id))

  const toInsert: any[] = []
  const invoiceData: Array<{ id: string; invoiceNumber: string; tenantEmail: string | null; tenantName: string; billingMonth: string; totalAmount: number; companyName: string | null; vatPin: string | null; taxPin: string | null; pdfUrl: string | null }> = []

  for (const lease of (leases as unknown) as CronLease[]) {
    const unit = lease.units
    const tenant = lease.tenants
    const property = unit?.properties

    // Skip if already invoiced this month
    if (existingLeaseIds.has(lease.id)) {
      skipped++
      continue
    }

    // Build merge group
    const mergeGroup = getMergeGroup(unit, unitsMap)
    const effectiveSquareFootage = mergeGroup.totalSquareFootage > 0
      ? mergeGroup.totalSquareFootage
      : (unit?.square_footage ? Number(unit.square_footage) : 0)

    // Get temporal service charge rate
    const rate = await getServiceChargeRate(supabase, agencyId, property?.id ?? null, billingMonth)

    const baseRent = Number(unit?.base_rent || 0)
    const rawServiceCharge = money(effectiveSquareFootage * rate)
    const years = yearsElapsed(lease.start_date, billingMonth)

    const escalatedBaseRent = applyEscalation(baseRent, ESCALATION_RATE, years)
    const escalatedServiceCharge = applyEscalation(rawServiceCharge, ESCALATION_RATE, years)

    const subtotal = money(escalatedBaseRent + escalatedServiceCharge)
    const vatAmount = money(subtotal * (VAT_RATE / 100))
    const totalAmount = money(subtotal + vatAmount)

    // Generate invoice number
    const invoiceNumber = await nextInvoiceNumber(supabase, agencyId)

    toInsert.push({
      agency_id: agencyId,
      property_id: property?.id ?? null,
      tenant_id: lease.tenant_id,
      lease_id: lease.id,
      billing_month: billingMonth,
      base_rent_amount: escalatedBaseRent,
      utilities_amount: 0,
      service_charge_amount: escalatedServiceCharge,
      service_charge_rate: rate,
      total_amount: totalAmount,
      interest_penalty_amount: 0,
      escalation_applied: years > 0,
      years_elapsed: years,
      status: 'unpaid',
      vat_rate: VAT_RATE,
      vat_amount: vatAmount,
      invoice_number: invoiceNumber,
    })

    invoiceData.push({
      id: lease.id,
      invoiceNumber,
      tenantEmail: tenant?.email ?? null,
      tenantName: `${tenant?.first_name ?? ''} ${tenant?.last_name ?? ''}`.trim() || 'Unknown',
      billingMonth: new Date(billingMonth + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      totalAmount,
      companyName: null, // filled below
      vatPin: null,
      taxPin: null,
      pdfUrl: null,
    })

    generated++
    totalAmount += totalAmount
  }

  if (toInsert.length > 0) {
    const { error: insertErr } = await supabase.from('invoices').insert(toInsert)
    if (insertErr) {
      errors.push(`Insert failed: ${insertErr.message}`)
      return { agencyId, billingMonth, generated: 0, skipped, totalAmount, emailed: 0, emailErrors: 0, errors }
    }
  }

  // Now generate PDFs and email for each inserted invoice
  // Fetch the inserted invoices with billing identity
  const insertedIds = toInsert.map((i) => i.lease_id)
  if (insertedIds.length > 0) {
    const { data: insertedInvoices } = await supabase
      .from('invoices')
      .select(`
        id, invoice_number, billing_month, base_rent_amount, service_charge_amount,
        service_charge_rate, vat_rate, vat_amount, interest_penalty_amount,
        escalation_applied, years_elapsed, total_amount, status, created_at,
        tenants ( first_name, last_name, email ),
        leases ( unit_id, escalation_percentage ),
        units ( unit_number, properties ( name ) ),
        agency_billing_identity ( company_name, vat_pin, tax_pin, email, phone, bank_name, bank_account_name, bank_account_number, bank_branch )
      `)
      .in('lease_id', insertedIds)
      .eq('agency_id', agencyId)

    if (insertedInvoices) {
      for (const inv of (insertedInvoices as any[])) {
        const tenant = inv.tenants?.[0] ?? null
        const unit = inv.leases?.[0]?.units ?? null
        const billingIdentity = inv.agency_billing_identity ?? null

        const pdfData: InvoicePdfData = {
          invoiceId: inv.id,
          invoiceNumber: inv.invoice_number ?? `INV-${inv.id.slice(0, 8)}`,
          isCreditNote: false,
          billingMonth: inv.billing_month,
          tenantName: `${tenant?.first_name ?? ''} ${tenant?.last_name ?? ''}`.trim() || 'Unknown',
          unitNumber: unit?.unit_number ?? null,
          propertyName: unit?.properties?.name ?? null,
          baseRent: Number(inv.base_rent_amount || 0),
          serviceChargeAmount: Number(inv.service_charge_amount || 0),
          escalationPercentage: Number(inv.leases?.[0]?.escalation_percentage ?? 0),
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

        // Generate PDF
        const pdfBuffer = generateInvoicePdf(pdfData)

        // Upload to Supabase Storage
        const fileName = `invoices/${inv.id}.pdf`
        const { error: uploadError } = await supabase.storage
          .from('invoices')
          .upload(fileName, pdfBuffer, { contentType: 'application/pdf', upsert: true })

        let pdfUrl: string | null = null
        if (!uploadError) {
          const { data: urlData } = await supabase.storage.from('invoices').getPublicUrl(fileName)
          pdfUrl = urlData.publicUrl

          // Update invoice with pdf_url
          await supabase.from('invoices').update({ pdf_url: pdfUrl }).eq('id', inv.id)
        }

        // Email the PDF to tenant
        const tenantEmail = tenant?.email
        if (tenantEmail && pdfUrl) {
          const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #134E4A;">
              <h1 style="color: #0F766E;">${billingIdentity?.company_name ?? 'Luffi Tech Property Management'}</h1>
              <h2>Invoice ${inv.invoice_number}</h2>
              <p>Dear ${tenant?.first_name ?? ''} ${tenant?.last_name ?? ''},</p>
              <p>Your invoice for <strong>${invoiceData.find(d => d.id === inv.id)?.billingMonth}</strong> is ready.</p>
              <p><strong>Total Amount:</strong> KES ${inv.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p><a href="${pdfUrl}" style="background:#0369A1;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">Download Invoice PDF</a></p>
              <p style="margin-top:24px;color:#475569;font-size:14px;">Pay via RTGS or Cheque to I&amp;M Bank. Please quote the Invoice Number as reference.</p>
            </div>
          `
          const emailResult = await sendEmail({
            to: tenantEmail,
            subject: `Invoice ${inv.invoice_number} - ${invoiceData.find(d => d.id === inv.id)?.billingMonth}`,
            html,
            text: `Invoice ${inv.invoice_number} for ${invoiceData.find(d => d.id === inv.id)?.billingMonth}. Total: KES ${inv.total_amount.toLocaleString()}.`,
          })
          if (emailResult.success) emailed++
          else emailErrors++
        }
      }
    }
  }

  return { agencyId, billingMonth, generated, skipped, totalAmount, emailed, emailErrors, errors }
}

export async function runAllAgenciesMonthlyBilling({
  billingMonth,
}: {
  billingMonth: string
}): Promise<MonthlyBillingResult[]> {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  const supabase = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: agencies } = await supabase.from('agencies').select('id, name')
  const results: MonthlyBillingResult[] = []

  for (const agency of (agencies || [])) {
    const result = await runMonthlyBilling({ agencyId: agency.id, billingMonth })
    results.push(result)
  }

  return results
}
