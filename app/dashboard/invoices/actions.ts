'use server'

import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getUserAgencyContext } from '@/utils/supabase/get-context'
import { generateInvoicePdf, type InvoicePdfData } from '@/app/lib/pdf/invoice-generator'

const INVOICES_BUCKET = 'invoices'
const LEASE_DOCUMENTS_BUCKET = 'lease-documents'
const CERTIFICATES_BUCKET = 'certificates'

export interface GenerateInvoicePdfResult {
  success: boolean
  pdfUrl: string | null
  error: string | null
}

export interface DocumentFile {
  name: string
  size: number
  updated_at: string
  url: string | null
  bucket: string
}

async function ensureBuckets(supabaseAdmin: any) {
  const buckets = [INVOICES_BUCKET, LEASE_DOCUMENTS_BUCKET, CERTIFICATES_BUCKET]
  for (const bucket of buckets) {
    const { data: existing } = await supabaseAdmin.storage.listBuckets()
    const alreadyExists = (existing || []).some((b: any) => b.name === bucket)
    if (!alreadyExists) {
      await supabaseAdmin.storage.createBucket(bucket, { public: false })
    }
  }
}

export async function generateInvoicePdfAction({
  invoiceId,
}: {
  invoiceId: string
}): Promise<GenerateInvoicePdfResult> {
  try {
    const { agencyId } = await getUserAgencyContext()
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    await ensureBuckets(supabaseAdmin)

    // Fetch invoice + related data
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(
        `
        id,
        billing_month,
        base_rent_amount,
        service_charge_amount,
        vat_rate,
        vat_amount,
        total_amount,
        status,
        created_at,
        tenants ( first_name, last_name ),
        leases ( unit_id ),
        units ( unit_number, properties ( name ) ),
        agency_billing_identity ( company_name, vat_pin, tax_pin, email, phone )
      `
      )
      .eq('id', invoiceId)
      .eq('agency_id', agencyId)
      .single()

    if (invoiceError || !invoice) {
      return { success: false, pdfUrl: null, error: 'Invoice not found' }
    }

    const tenant = ((invoice as any).tenants as Array<{ first_name: string | null; last_name: string | null }> | null)?.[0] ?? null
    const unit = (((invoice as any).leases as Array<{ units: { unit_number: string | null; properties: { name: string | null } | null } | null }> | null)?.[0]?.units) ?? null
    const billingIdentity = ((invoice as any).agency_billing_identity as {
      company_name: string | null
      vat_pin: string | null
      tax_pin: string | null
      email: string | null
      phone: string | null
    } | null)

    const pdfData: InvoicePdfData = {
      invoiceId: invoice.id,
      invoiceNumber: `INV-${invoice.id.slice(0, 8).toUpperCase()}`,
      billingMonth: new Date(invoice.billing_month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      tenantName: `${tenant?.first_name ?? ''} ${tenant?.last_name ?? ''}`.trim() || 'Unknown Tenant',
      unitNumber: unit?.unit_number ?? null,
      propertyName: unit?.properties?.name ?? null,
      baseRent: Number(invoice.base_rent_amount || 0),
      serviceChargeAmount: Number(invoice.service_charge_amount || 0),
      vatRate: Number(invoice.vat_rate || 16),
      vatAmount: Number(invoice.vat_amount || 0),
      totalAmount: Number(invoice.total_amount || 0),
      status: invoice.status,
      companyName: billingIdentity?.company_name ?? 'Luffi Tech Property Management',
      vatPin: billingIdentity?.vat_pin ?? null,
      taxPin: billingIdentity?.tax_pin ?? null,
      companyEmail: billingIdentity?.email ?? null,
      companyPhone: billingIdentity?.phone ?? null,
      issuedAt: invoice.created_at,
    }

    const pdfBuffer = generateInvoicePdf(pdfData)

    // Upload to Supabase Storage
    const fileName = `invoices/${invoiceId}.pdf`
    const { error: uploadError } = await supabaseAdmin.storage
      .from(INVOICES_BUCKET)
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      console.error('PDF upload error:', uploadError)
      return { success: false, pdfUrl: null, error: 'Failed to upload PDF' }
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(INVOICES_BUCKET)
      .getPublicUrl(fileName)

    // Update invoice record with pdf_url
    await supabase
      .from('invoices')
      .update({ pdf_url: urlData.publicUrl, emailed_at: new Date().toISOString() })
      .eq('id', invoiceId)
      .eq('agency_id', agencyId)

    return { success: true, pdfUrl: urlData.publicUrl, error: null }
  } catch (err: any) {
    console.error('generateInvoicePdfAction error:', err)
    return { success: false, pdfUrl: null, error: err?.message ?? 'Unknown error' }
  }
}

export async function getInvoicesWithPdf(): Promise<Array<{
  id: string
  billing_month: string
  tenant_name: string
  unit_number: string | null
  property_name: string | null
  total_amount: number
  status: string
  pdf_url: string | null
  created_at: string
}>> {
  const { agencyId } = await getUserAgencyContext()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invoices')
    .select(
      `
      id,
      billing_month,
      total_amount,
      status,
      pdf_url,
      created_at,
      tenants ( first_name, last_name ),
      leases ( units ( unit_number, properties ( name ) ) )
    `
    )
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })

  if (error || !data) {
    console.error('getInvoicesWithPdf error:', error)
    return []
  }

  return data.map((inv: any) => {
    const tenant = Array.isArray(inv.tenants) ? inv.tenants[0] : inv.tenants
    const unit = inv.leases?.[0]?.units
    return {
      id: inv.id,
      billing_month: inv.billing_month,
      tenant_name: `${tenant?.first_name ?? ''} ${tenant?.last_name ?? ''}`.trim() || 'Unknown',
      unit_number: unit?.unit_number ?? null,
      property_name: unit?.properties?.name ?? null,
      total_amount: Number(inv.total_amount || 0),
      status: inv.status,
      pdf_url: inv.pdf_url,
      created_at: inv.created_at,
    }
  })
}

export async function listDocuments(bucket: string): Promise<DocumentFile[]> {
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  await ensureBuckets(supabaseAdmin)

  const { data: files, error } = await supabaseAdmin.storage.from(bucket).list('', {
    sortBy: { column: 'updated_at', order: 'desc' },
  })

  if (error || !files) {
    console.error(`listDocuments error (${bucket}):`, error)
    return []
  }

  return files.map((f: any) => {
    const { data: urlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(f.name)
    return {
      name: f.name,
      size: f.size || 0,
      updated_at: f.updated_at || '',
      url: urlData.publicUrl,
      bucket,
    }
  })
}

export async function uploadDocument({
  bucket,
  fileName,
  fileBuffer,
  contentType,
}: {
  bucket: string
  fileName: string
  fileBuffer: Buffer
  contentType: string
}): Promise<{ success: boolean; url: string | null; error: string | null }> {
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  await ensureBuckets(supabaseAdmin)

  const { error } = await supabaseAdmin.storage.from(bucket).upload(fileName, fileBuffer, {
    contentType,
    upsert: true,
  })

  if (error) {
    return { success: false, url: null, error: error.message }
  }

  const { data: urlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(fileName)
  return { success: true, url: urlData.publicUrl, error: null }
}
