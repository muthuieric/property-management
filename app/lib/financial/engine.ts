'use server'

/**
 * Financial Engine — Luffi Tech Property Management
 *
 * Core billing mathematics:
 *   Service Charge   = unit_square_footage × current_service_rate
 *   Escalation       = amount × (1 + rate)^years_elapsed   (compound, on anniversary)
 *   Subtotal         = escalated_base_rent + service_charge
 *   VAT (16%)        = subtotal × 0.16
 *   Total            = subtotal + vat (+ interest penalty)
 *   Interest Penalty = outstanding_arrears × 0.02 per month past grace
 */

import { createClient as createAdminClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const VAT_RATE = 16 // percent
const DEFAULT_ESCALATION_RATE = 0.03 // 3% annual compound
const INTEREST_PENALTY_RATE = 0.02 // 2% monthly on arrears

export interface MoneyResult {
  value: number
  formatted: string
}

export function money(value: number): number {
  return Math.round(value * 100) / 100
}

export function formatKES(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2,
  }).format(value)
}

/**
 * Compound annual escalation.
 * amount × (1 + rate)^years_elapsed
 */
export function applyEscalation(
  amount: number,
  rate: number,
  yearsElapsed: number
): number {
  if (yearsElapsed <= 0 || rate <= 0) return money(amount)
  return money(amount * Math.pow(1 + rate, yearsElapsed))
}

/**
 * Years elapsed between lease start_date and a billing month (anniversary based).
 */
export function yearsElapsed(startDate: string | null, billingMonth: string): number {
  if (!startDate) return 0
  const start = new Date(startDate + 'T00:00:00')
  const [by, bm] = billingMonth.split('-').map(Number)
  const billing = new Date(by, bm - 1, 1)
  let years = billing.getFullYear() - start.getFullYear()
  if (billing.getMonth() < start.getMonth()) years--
  return Math.max(0, years)
}

/**
 * Dynamic service charge: square_footage × rate_per_sqft
 */
export function computeServiceCharge(
  squareFootage: number | null,
  ratePerSqft: number
): number {
  const sqft = squareFootage || 0
  return money(sqft * ratePerSqft)
}

/**
 * Compute full invoice line maths for a lease.
 */
export interface InvoiceCalculation {
  baseRentAmount: number
  serviceChargeAmount: number
  serviceChargeRate: number
  escalatedBaseRent: number
  escalatedServiceCharge: number
  subtotal: number
  vatRate: number
  vatAmount: number
  totalAmount: number
  yearsElapsed: number
  escalationApplied: boolean
}

export function calculateInvoice({
  baseRent,
  squareFootage,
  ratePerSqft,
  escalationPercentage,
  startDate,
  billingMonth,
  existingInterestPenalty = 0,
}: {
  baseRent: number
  squareFootage: number | null
  ratePerSqft: number
  escalationPercentage: number
  startDate: string | null
  billingMonth: string
  existingInterestPenalty?: number
}): InvoiceCalculation {
  const years = yearsElapsed(startDate, billingMonth)
  const escalationApplied = years > 0 && escalationPercentage > 0

  const baseRentAmount = money(baseRent)
  const serviceChargeAmount = computeServiceCharge(squareFootage, ratePerSqft)

  const escalatedBaseRent = applyEscalation(
    baseRentAmount,
    escalationPercentage,
    years
  )
  const escalatedServiceCharge = applyEscalation(
    serviceChargeAmount,
    escalationPercentage,
    years
  )

  const subtotal = money(escalatedBaseRent + escalatedServiceCharge)
  const vatAmount = money(subtotal * (VAT_RATE / 100))
  const totalAmount = money(subtotal + vatAmount)

  return {
    baseRentAmount,
    serviceChargeAmount,
    serviceChargeRate: ratePerSqft,
    escalatedBaseRent,
    escalatedServiceCharge,
    subtotal,
    vatRate: VAT_RATE,
    vatAmount,
    totalAmount,
    yearsElapsed: years,
    escalationApplied,
  }
}

/**
 * 2% monthly interest penalty on outstanding arrears past grace period.
 * outstanding = total_amount - already_charged_interest
 */
export function computeInterestPenalty(
  totalAmount: number,
  alreadyChargedInterest: number
): number {
  const outstanding = money(totalAmount - alreadyChargedInterest)
  if (outstanding <= 0) return 0
  return money(outstanding * INTEREST_PENALTY_RATE)
}

async function getAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Fetch the applicable service charge rate for a property at a billing month.
 * Temporal: rate effective on/before billing month, not yet expired.
 * Prefers property-specific rate over global (no property_id) rate.
 */
export async function getServiceChargeRate({
  agencyId,
  propertyId,
  billingMonth,
}: {
  agencyId: string
  propertyId: string | null
  billingMonth: string
}): Promise<number> {
  const admin = await getAdmin()
  const [by, bm] = billingMonth.split('-').map(Number)
  const billingDate = new Date(by, bm - 1, 1).toISOString().slice(0, 10)

  const { data: rates, error } = await admin
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

/**
 * Atomically generate the next invoice number for an agency.
 * Format: PREFIX/NNNN (e.g. KHL/1118)
 */
export async function nextInvoiceNumber({
  agencyId,
  prefix = 'KHL',
}: {
  agencyId: string
  prefix?: string
}): Promise<string | null> {
  const admin = await getAdmin()

  const { data: existing } = await admin
    .from('invoice_sequences')
    .select('*')
    .eq('agency_id', agencyId)
    .single()

  let lastNumber = 0
  const usePrefix = existing?.prefix || prefix

  if (existing) {
    lastNumber = Number(existing.last_number || 0)
  }

  const nextNumber = lastNumber + 1
  const invoiceNumber = `${usePrefix}/${nextNumber}`

  if (existing) {
    await admin
      .from('invoice_sequences')
      .update({ last_number: nextNumber })
      .eq('agency_id', agencyId)
  } else {
    await admin.from('invoice_sequences').insert({
      agency_id: agencyId,
      prefix: usePrefix,
      last_number: nextNumber,
    })
  }

  return invoiceNumber
}

/**
 * Fetch agency billing identity (KRA PIN, VAT number, bank details) for PDF header/footer.
 */
export async function getAgencyBillingIdentity(agencyId: string) {
  const admin = await getAdmin()
  const { data } = await admin
    .from('agency_billing_identity')
    .select('*')
    .eq('agency_id', agencyId)
    .single()
  return data
}
