'use server'

import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'

export interface BillingPreviewRow {
  leaseId: string
  tenantId: string
  tenantName: string
  unitNumber: string | null
  propertyId: string | null
  propertyName: string | null
  baseRent: number
  squareFootage: number | null
  serviceChargeRate: number
  serviceChargeAmount: number
  vatRate: number
  vatAmount: number
  totalAmount: number
  alreadyInvoiced: boolean
}

export interface PropertyOption {
  id: string
  name: string
}

interface LeaseRow {
  id: string
  tenant_id: string
  unit_id: string | null
  agency_id: string
  is_active: boolean
  lease_status: string
  units: {
    id: string
    unit_number: string | null
    base_rent: number | null
    square_footage: number | null
    properties: { id: string; name: string } | null
  } | null
  tenants: {
    id: string
    first_name: string | null
    last_name: string | null
  } | null
}

export interface BillingGenerateResult {
  generated: number
  skipped: number
  totalAmount: number
  rows: BillingPreviewRow[]
}

const VAT_RATE = 16

function money(value: number): number {
  return Math.round(value * 100) / 100
}

export async function getBillingPreview({
  billingMonth,
  serviceChargeRate,
  propertyId,
}: {
  billingMonth: string
  serviceChargeRate: number
  propertyId?: string
}): Promise<BillingPreviewRow[]> {
  const { agencyId } = await getUserAgencyContext()
  const supabase = await createClient()

  const { data: leases, error } = await supabase
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
      units (
        id,
        unit_number,
        base_rent,
        square_footage,
        properties ( id, name )
      ),
      tenants (
        id,
        first_name,
        last_name
      )
    `
    )
    .eq('agency_id', agencyId)
    .eq('is_active', true)
    .eq('lease_status', 'active')

  if (error || !leases) {
    console.error('getBillingPreview error:', error)
    return []
  }

  // Existing invoices for the billing month (to skip duplicates)
  const { data: existing } = await supabase
    .from('invoices')
    .select('lease_id')
    .eq('agency_id', agencyId)
    .eq('billing_month', billingMonth)

  const existingLeaseIds = new Set((existing || []).map((i) => i.lease_id))

  const rows: BillingPreviewRow[] = []

  for (const lease of (leases as unknown) as LeaseRow[]) {
    const unit = lease.units
    const tenant = lease.tenants
    const property = unit?.properties

    // Optional property filter
    if (propertyId && property?.id !== propertyId) continue

    const baseRent = Number(unit?.base_rent || 0)
    const squareFootage = unit?.square_footage ? Number(unit.square_footage) : null
    const rate = serviceChargeRate
    const serviceChargeAmount = money((squareFootage || 0) * rate)
    const subtotal = money(baseRent + serviceChargeAmount)
    const vatAmount = money(subtotal * (VAT_RATE / 100))
    const totalAmount = money(subtotal + vatAmount)

    rows.push({
      leaseId: lease.id,
      tenantId: lease.tenant_id,
      tenantName: `${tenant?.first_name || ''} ${tenant?.last_name || ''}`.trim() || 'Unknown',
      unitNumber: unit?.unit_number ?? null,
      propertyId: property?.id ?? null,
      propertyName: property?.name ?? null,
      baseRent,
      squareFootage,
      serviceChargeRate: rate,
      serviceChargeAmount,
      vatRate: VAT_RATE,
      vatAmount,
      totalAmount,
      alreadyInvoiced: existingLeaseIds.has(lease.id),
    })
  }

  return rows
}

export async function generateInvoices({
  billingMonth,
  serviceChargeRate,
  propertyId,
}: {
  billingMonth: string
  serviceChargeRate: number
  propertyId?: string
}): Promise<BillingGenerateResult> {
  const { agencyId, userId } = await getUserAgencyContext()
  const supabase = await createClient()

  const preview = await getBillingPreview({
    billingMonth,
    serviceChargeRate,
    propertyId,
  })

  const toInsert = preview.filter((r) => !r.alreadyInvoiced).map((r) => ({
    agency_id: agencyId,
    property_id: r.propertyId,
    tenant_id: r.tenantId,
    lease_id: r.leaseId,
    billing_month: billingMonth,
    base_rent_amount: r.baseRent,
    utilities_amount: 0,
    service_charge_amount: r.serviceChargeAmount,
    service_charge_rate: r.serviceChargeRate,
    vat_rate: r.vatRate,
    vat_amount: r.vatAmount,
    total_amount: r.totalAmount,
    status: 'unpaid',
    created_by: userId,
  }))

  let generated = 0
  if (toInsert.length > 0) {
    const { error } = await supabase.from('invoices').insert(toInsert)
    if (error) {
      console.error('generateInvoices insert error:', error)
      return {
        generated: 0,
        skipped: preview.length,
        totalAmount: 0,
        rows: preview,
      }
    }
    generated = toInsert.length
  }

  const totalAmount = money(
    preview.reduce((sum, r) => sum + r.totalAmount, 0)
  )

  return {
    generated,
    skipped: preview.length - generated,
    totalAmount,
    rows: preview,
  }
}

export async function getProperties(): Promise<PropertyOption[]> {
  const { agencyId } = await getUserAgencyContext()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('properties')
    .select('id, name')
    .eq('agency_id', agencyId)
    .order('name', { ascending: true })

  if (error || !data) {
    console.error('getProperties error:', error)
    return []
  }

  return data.map((p) => ({ id: p.id, name: p.name }))
}
