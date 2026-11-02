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
  isMergedUnit: boolean
  mergedUnitNumbers: string[]
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
    parent_unit_id: string | null
    properties: { id: string; name: string } | null
  } | null
  tenants: {
    id: string
    first_name: string | null
    last_name: string | null
  } | null
}

interface UnitRow {
  id: string
  unit_number: string | null
  square_footage: number | null
  parent_unit_id: string | null
}

export interface BillingGenerateResult {
  generated: number
  skipped: number
  totalAmount: number
  rows: BillingPreviewRow[]
}

export interface CreditNoteResult {
  success: boolean
  creditNumber: string | null
  error: string | null
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
 * Given a unit, find all units in its merge group (itself + children).
 * Returns the merged unit numbers and total square footage.
 */
function getMergeGroup(
  unit: UnitRow | null,
  allUnits: UnitRow[]
): { unitNumbers: string[]; totalSquareFootage: number; baseUnit: UnitRow | null } {
  if (!unit) return { unitNumbers: [], totalSquareFootage: 0, baseUnit: null }

  // Find this unit's root parent (if it's a child, find the parent)
  let root = unit
  let visited = new Set<string>()
  while (root.parent_unit_id && !visited.has(root.parent_unit_id)) {
    visited.add(root.parent_unit_id)
    const parent = allUnits.find((u) => u.id === root.parent_unit_id)
    if (!parent) break
    root = parent
  }

  // Collect all children of the root (including root itself)
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

  return { unitNumbers, totalSquareFootage, baseUnit: root }
}

/**
 * Fetch applicable service charge rate for a property at the given billing month.
 * Uses temporal rate table: rate effective on or before billing month, not yet expired.
 */
async function getServiceChargeRate(
  supabase: Awaited<ReturnType<typeof createClient>>,
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

  // Filter to rates not yet expired, prefer property-specific over global
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

/**
 * Atomically generate the next invoice number for an agency.
 * Format: PREFIX/NNNN (e.g., KHL/1118)
 */
async function nextInvoiceNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  agencyId: string
): Promise<string | null> {
  // Ensure a sequence row exists
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
    const { error } = await supabase
      .from('invoice_sequences')
      .update({ last_number: nextNumber })
      .eq('agency_id', agencyId)
    if (error) {
      console.error('nextInvoiceNumber update error:', error)
      return null
    }
  } else {
    const { error } = await supabase
      .from('invoice_sequences')
      .insert({
        agency_id: agencyId,
        prefix,
        last_number: nextNumber,
      })
    if (error) {
      console.error('nextInvoiceNumber insert error:', error)
      return null
    }
  }

  return invoiceNumber
}

export async function getBillingPreview({
  billingMonth,
  serviceChargeRate,
  propertyId,
}: {
  billingMonth: string
  serviceChargeRate?: number
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
        parent_unit_id,
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

  // Fetch all units for this agency to build merge groups
  const { data: allUnits, error: unitsErr } = await supabase
    .from('units')
    .select('id, unit_number, square_footage, parent_unit_id, property_id')
    .eq('agency_id', agencyId)

  const unitsMap = (allUnits || []) as UnitRow[]

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

    // Look up temporal service charge rate for this property at this billing month
    const effectiveRate = await getServiceChargeRate(
      supabase,
      agencyId,
      property?.id ?? null,
      billingMonth
    )
    const rate = serviceChargeRate !== undefined ? serviceChargeRate : effectiveRate

    // Build merge group for this unit
    const mergeGroup = getMergeGroup(unit, unitsMap)
    const isMerged = mergeGroup.unitNumbers.length > 1

    // Use merged square footage for service charge
    const effectiveSquareFootage = mergeGroup.totalSquareFootage > 0 ? mergeGroup.totalSquareFootage : (unit?.square_footage ? Number(unit.square_footage) : 0)
    const displayUnitNumber = isMerged ? mergeGroup.unitNumbers.join(', ') : unit?.unit_number ?? null

    const baseRent = Number(unit?.base_rent || 0)
    const rawServiceCharge = money(effectiveSquareFootage * rate)

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
      unitNumber: displayUnitNumber,
      propertyId: property?.id ?? null,
      propertyName: property?.name ?? null,
      baseRent: escalatedBaseRent,
      squareFootage: effectiveSquareFootage || null,
      serviceChargeRate: rate,
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
      isMergedUnit: isMerged,
      mergedUnitNumbers: mergeGroup.unitNumbers,
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

  const toInsert = preview.filter((r) => !r.alreadyInvoiced)

  // Generate invoice numbers in sequence
  const invoicesWithNumbers = await Promise.all(
    toInsert.map(async (r) => {
      const invoiceNumber = await nextInvoiceNumber(supabase, agencyId)
      return {
        ...r,
        invoiceNumber,
      }
    })
  )

  const toDbInsert = invoicesWithNumbers.map((r) => ({
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
    invoice_number: r.invoiceNumber,
    created_by: userId,
  }))

  let generated = 0
  if (toDbInsert.length > 0) {
    const { error } = await supabase.from('invoices').insert(toDbInsert)
    if (error) {
      console.error('generateInvoices insert error:', error)
      return {
        generated: 0,
        skipped: preview.length,
        totalAmount: 0,
        rows: preview,
      }
    }
    generated = toDbInsert.length
    // Create double-entry ledger entries for invoices (Debits to AR, Credits to Revenue)
    for (const inv of toDbInsert) {
      try {
        await supabase.from('ledger_entries').insert({
          agency_id: inv.agency_id,
          tenant_id: inv.tenant_id,
          invoice_id: undefined,
          debit_account: 'Accounts Receivable',
          credit_account: 'Rent Income',
          amount: inv.total_amount,
          entry_date: new Date().toISOString().slice(0, 10),
          reference: inv.invoice_number || `INV-${billingMonth}`,
        })
      } catch (e) {
        // ignore
      }
    }
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

export async function createCreditNote({
  originalInvoiceId,
  amount,
  vatAmount,
  reason,
}: {
  originalInvoiceId: string
  amount: number
  vatAmount: number
  reason: string
}): Promise<CreditNoteResult> {
  const { agencyId, userId } = await getUserAgencyContext()
  const supabase = await createClient()

  // Fetch the original invoice to verify agency and get details
  const { data: originalInvoice, error: invError } = await supabase
    .from('invoices')
    .select('id, agency_id, invoice_number, total_amount, vat_amount, tenant_id')
    .eq('id', originalInvoiceId)
    .eq('agency_id', agencyId)
    .single()

  if (invError || !originalInvoice) {
    return { success: false, creditNumber: null, error: 'Original invoice not found' }
  }

  // Generate credit number using sequence-like approach
  const { data: existingSeq } = await supabase
    .from('invoice_sequences')
    .select('prefix')
    .eq('agency_id', agencyId)
    .single()

  const prefix = (existingSeq?.prefix || 'INV').replace('INV', 'CN')
  const creditNumber = `${prefix}/CN-${Date.now().toString().slice(-6)}`

  const creditAmount = money(amount)
  const creditVat = money(vatAmount)

  // Insert credit note (negative amount for double-entry reversal)
  const { data: creditNote, error: cnError } = await supabase
    .from('credit_notes')
    .insert({
      agency_id: agencyId,
      original_invoice_id: originalInvoiceId,
      credit_number: creditNumber,
      amount: -Math.abs(creditAmount), // negative for bookkeeping reversal
      vat_amount: -Math.abs(creditVat),
      reason,
      status: 'issued',
      created_by: userId,
    })
    .select()
    .single()

  if (cnError) {
    console.error('createCreditNote error:', cnError)
    return { success: false, creditNumber: null, error: cnError.message }
  }

  // Create double-entry ledger entries for the credit note
  // Debit: VAT Output (reversing liability), Credit: Debtors/Accounts Receivable
      await supabase.from('ledger_entries').insert([
        {
          agency_id: agencyId,
          tenant_id: originalInvoice.tenant_id ?? null,
          invoice_id: originalInvoiceId,
          debit_account: 'VAT Output',
          credit_account: 'Accounts Receivable',
          amount: Math.abs(creditVat),
          entry_date: new Date().toISOString().slice(0, 10),
          reference: creditNumber,
        },
        {
          agency_id: agencyId,
          tenant_id: originalInvoice.tenant_id ?? null,
          invoice_id: originalInvoiceId,
          debit_account: 'Accounts Receivable',
          credit_account: 'Rent Income',
          amount: Math.abs(creditAmount),
          entry_date: new Date().toISOString().slice(0, 10),
          reference: creditNumber,
        },
      ])

  return { success: true, creditNumber, error: null }
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
