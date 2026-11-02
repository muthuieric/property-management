import { createClient as createAdminClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const INTEREST_RATE = 0.02 // 2% flat per month on outstanding arrears

export interface InterestResult {
  appliedCount: number
  totalInterest: number
  rows: Array<{
    invoiceId: string
    tenantId: string
    tenantName: string
    unitNumber: string | null
    propertyName: string | null
    billingMonth: string
    previousTotal: number
    interestAmount: number
    newTotal: number
  }>
  error: string | null
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
 * Apply 2% flat monthly interest to outstanding (unpaid/partial) invoices
 * from previous billing months. Idempotent: skips invoices already charged
 * interest for the given period month.
 */
export async function applyMonthlyInterest({
  periodMonth,
}: {
  periodMonth: string // 'YYYY-MM'
}): Promise<InterestResult> {
  const admin = await getAdmin()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)

  // Fetch all unpaid/partial invoices from before the period month
  const { data: invoices, error: invErr } = await admin
    .from('invoices')
    .select(
      `
      id,
      tenant_id,
      billing_month,
      total_amount,
      status,
      tenants ( first_name, last_name ),
      leases ( units ( unit_number, properties ( name ) ) )
    `
    )
    .in('status', ['unpaid', 'partial'])
    .lt('billing_month', periodMonth)

  if (invErr || !invoices) {
    console.error('applyMonthlyInterest fetch error:', invErr)
    return { appliedCount: 0, totalInterest: 0, rows: [], error: invErr?.message ?? 'Failed to fetch invoices' }
  }

  // Fetch existing interest entries for this period to avoid double-charging
  const { data: existingInterest } = await admin
    .from('arrears_interest')
    .select('invoice_id')
    .eq('period_month', periodMonth)

  const alreadyCharged = new Set(
    (existingInterest || []).map((e: any) => e.invoice_id)
  )

  const results: InterestResult['rows'] = []
  let totalInterest = 0

  for (const inv of invoices as any[]) {
    if (alreadyCharged.has(inv.id)) continue

    const previousTotal = Number(inv.total_amount || 0)
    if (previousTotal <= 0) continue

    const interestAmount = Math.round(previousTotal * INTEREST_RATE * 100) / 100
    const newTotal = Math.round((previousTotal + interestAmount) * 100) / 100

    const tenant = inv.tenants as { first_name: string | null; last_name: string | null } | null
    const unit = inv.leases?.[0]?.units as { unit_number: string | null; properties: { name: string | null } | null } | null

    // Insert interest record
    await admin.from('arrears_interest').insert({
      tenant_id: inv.tenant_id,
      invoice_id: inv.id,
      period_month: periodMonth,
      interest_amount: interestAmount,
      applied_at: todayStr,
    })

    // Increase the invoice total by the interest amount
    await admin
      .from('invoices')
      .update({ total_amount: newTotal, interest_penalty_amount: Math.round((Number(inv.interest_penalty_amount || 0) + interestAmount) * 100) / 100 })
      .eq('id', inv.id)

    results.push({
      invoiceId: inv.id,
      tenantId: inv.tenant_id,
      tenantName: `${tenant?.first_name ?? ''} ${tenant?.last_name ?? ''}`.trim() || 'Unknown',
      unitNumber: unit?.unit_number ?? null,
      propertyName: unit?.properties?.name ?? null,
      billingMonth: inv.billing_month,
      previousTotal,
      interestAmount,
      newTotal,
    })

    totalInterest = Math.round((totalInterest + interestAmount) * 100) / 100
  }

  return {
    appliedCount: results.length,
    totalInterest,
    rows: results,
    error: null,
  }
}

/**
 * Fetch arrears summary for the dashboard.
 */
export async function getArrearsSummary(): Promise<{
  totalArrears: number
  interestToDate: number
  overdueInvoices: number
  recentInterest: Array<{
    id: string
    tenantName: string
    unitNumber: string | null
    periodMonth: string
    interestAmount: number
    appliedAt: string
  }>
  error: string | null
}> {
  const admin = await getAdmin()

  const { data: invoices, error: invErr } = await admin
    .from('invoices')
    .select(
      `
      total_amount,
      status,
      billing_month,
      tenants ( first_name, last_name ),
      leases ( units ( unit_number ) )
    `
    )
    .in('status', ['unpaid', 'partial'])

  if (invErr || !invoices) {
    return { totalArrears: 0, interestToDate: 0, overdueInvoices: 0, recentInterest: [], error: invErr?.message ?? 'Failed to fetch' }
  }

  const totalArrears = Math.round(
    invoices.reduce((sum, inv: any) => sum + Number(inv.total_amount || 0), 0) * 100
  ) / 100

  const overdueInvoices = invoices.length

  const { data: interest } = await admin
    .from('arrears_interest')
    .select(
      `
      id,
      interest_amount,
      period_month,
      applied_at,
      tenants ( first_name, last_name ),
      invoices ( leases ( units ( unit_number ) ) )
    `
    )
    .order('applied_at', { ascending: false })
    .limit(20)

  const recentInterest: {
    id: string
    tenantName: string
    unitNumber: string | null
    periodMonth: string
    interestAmount: number
    appliedAt: string
  }[] = []

  const interestToDate = Math.round(
    (interest || []).reduce((sum, i: any) => sum + Number(i.interest_amount || 0), 0) * 100
  ) / 100

  for (const i of (interest || []) as any[]) {
    const tenant = i.tenants as { first_name: string | null; last_name: string | null } | null
    const unit = i.invoices?.[0]?.leases?.[0]?.units as { unit_number: string | null } | null
    recentInterest.push({
      id: i.id,
      tenantName: `${tenant?.first_name ?? ''} ${tenant?.last_name ?? ''}`.trim() || 'Unknown',
      unitNumber: unit?.unit_number ?? null,
      periodMonth: i.period_month,
      interestAmount: Number(i.interest_amount || 0),
      appliedAt: i.applied_at,
    })
  }

  return {
    totalArrears,
    interestToDate,
    overdueInvoices,
    recentInterest,
    error: null,
  }
}
