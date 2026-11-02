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
  escalationPercentage: number
  yearsElapsed: number
  escalatedBaseRent: number
  escalatedServiceCharge: number
  vatRate: number
  vatAmount: number
  interestPenalty: number
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
  start_date: string | null
  escalation_percentage: number | null
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
const ESCALATION_RATE = 0.03 // 3% annual compound escalation
const INTEREST_PENALTY_RATE = 0.02 // 2% monthly interest on arrears

function money(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Calculate complete years elapsed between lease start_date and billing month.
 * Escalation kicks in on each anniversary of the lease start.
 */
function yearsElapsed(startDate: string | null, billingMonth: string): number {
  if (!startDate) return 0
  const start = new Date(startDate + 'T00:00:00')
  const [by, bm] = billingMonth.split('-').map(Number)
  const billing = new Date(by, bm - 1, 1)

  let years = billing.getFullYear() - start.getFullYear()
  if (billing.getMonth() < start.getMonth()) {
    years--
  }
  return Math.max(0, years)
}

function applyEscalation(amount: number, rate: number, years: number): number {
  if (years <= 0 || rate <= 0) return money(amount)
  return money(amount * Math.pow(1 + rate, years))
}

/**
 * Fetch unpaid invoices from previous billing months for a tenant
 * to calculate the 2% monthly interest penalty.
 */
async function getInterestPenalty(
  supabase: Awaited<ReturnType<typeof createClient>>,
  agencyId: string,
  tenantId: string,
  currentBillingMonth: string
): Promise<number> {
  const { data: unpaid, error } = await supabase
    .from('invoices')
    .select('total_amount, billing_month, interest_penalty_amount')
    .eq('agency_id', agencyId)
    .eq('tenant_id', tenantId)
    .in('status', ['unpaid', 'partial'])
    .lt('billing_month', currentBillingMonth)

  if (error || !unpaid) return 0

  let totalPenalty = 0
  for (const inv of unpaid) {
    const baseTotal = Number(inv.total_amount || 0)
    const alreadyCharged = Number(inv.interest_penalty_amount || 0)
    const outstanding = baseTotal - alreadyCharged
    if (outstanding <= 0) continue
    const penalty = money(outstanding * INTEREST_PENALTY_RATE)
    totalPenalty += penalty
  }

  return money(totalPenalty)
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
      escalation_percentage,
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

    if (propertyId && property?.id !== propertyId) continue

    const baseRent = Number(unit?.base_rent || 0)
    const squareFootage = unit?.square_footage ? Number(unit.square_footage) : null
    const rawServiceCharge = money((squareFootage || 0) * serviceChargeRate)

    const escalationPct = Number(lease.escalation_percentage || 0)
    const years = yearsElapsed(lease.start_date, billingMonth)

    const escalatedBaseRent = applyEscalation(baseRent, ESCALATION_RATE, years)
    const escalatedServiceCharge = applyEscalation(rawServiceCharge, ESCALATION_RATE, years)

    const subtotal = money(escalatedBaseRent + escalatedServiceCharge)
    const vatAmount = money(subtotal * (VAT_RATE / 100))

    // Interest penalty on outstanding arrears from previous months
    const interestPenalty = await getInterestPenalty(
      supabase,
      agencyId,
      lease.tenant_id,
      billingMonth
    )

    const totalAmount = money(subtotal + vatAmount + interestPenalty)

    rows.push({
      leaseId: lease.id,
      tenantId: lease.tenant_id,
      tenantName: `${tenant?.first_name || ''} ${tenant?.last_name || ''}`.trim() || 'Unknown',
      unitNumber: unit?.unit_number ?? null,
      propertyId: property?.id ?? null,
      propertyName: property?.name ?? null,
      baseRent: escalatedBaseRent,
      squareFootage,
      serviceChargeRate: serviceChargeRate,
      serviceChargeAmount: escalatedServiceCharge,
      escalationPercentage: escalationPct,
      yearsElapsed: years,
      escalatedBaseRent,
      escalatedServiceCharge,
      vatRate: VAT_RATE,
      vatAmount,
      interestPenalty,
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
    total_amount: r.totalAmount,
    interest_penalty_amount: r.interestPenalty,
    escalation_applied: r.yearsElapsed > 0,
    years_elapsed: r.yearsElapsed,
    status: 'unpaid',
    vat_rate: r.vatRate,
    vat_amount: r.vatAmount,
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
