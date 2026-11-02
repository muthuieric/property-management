import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { computeInterestPenalty, money } from '@/app/lib/financial/engine'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Cron: runs daily at 02:00 UTC
// Applies a 2% monthly interest penalty to outstanding invoice arrears past their
// grace period. Idempotent — skips invoices already charged for the period month.
export async function GET(req: Request): Promise<Response> {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.VERCEL_CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const periodMonth = searchParams.get('period') || new Date().toISOString().slice(0, 7)

  const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  try {
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
        agency_id,
        billing_month,
        total_amount,
        status,
        interest_penalty_amount,
        tenants ( first_name, last_name ),
        leases ( units ( unit_number, properties ( name ) ) )
      `
      )
      .in('status', ['unpaid', 'partial'])
      .lt('billing_month', periodMonth)

    if (invErr) {
      return NextResponse.json({ error: invErr.message }, { status: 500 })
    }

    // Existing interest entries for this period (idempotency)
    const { data: existingInterest } = await admin
      .from('arrears_interest')
      .select('invoice_id')
      .eq('period_month', periodMonth)
    const alreadyCharged = new Set((existingInterest ?? []).map((e: any) => e.invoice_id))

    const results: Array<{
      invoiceId: string
      tenantId: string
      tenantName: string
      unitNumber: string | null
      propertyName: string | null
      billingMonth: string
      previousTotal: number
      interestAmount: number
      newTotal: number
    }> = []

    let totalInterest = 0
    let appliedCount = 0

    for (const inv of (invoices ?? [])) {
      if (alreadyCharged.has(inv.id)) continue

      const previousTotal = Number(inv.total_amount || 0)
      if (previousTotal <= 0) continue

      const alreadyChargedInterest = Number(inv.interest_penalty_amount || 0)
      const interestAmount = computeInterestPenalty(previousTotal, alreadyChargedInterest)
      if (interestAmount <= 0) continue

      const newTotal = money(previousTotal + interestAmount)

      const tenant = (inv.tenants ?? [])[0] as { first_name: string | null; last_name: string | null } | null
      const unit = (inv.leases?.[0]?.units ?? [])[0] as unknown as { unit_number: string | null; properties: { name: string | null } | null } | null

      // Insert interest record
      await admin.from('arrears_interest').insert({
        tenant_id: inv.tenant_id,
        invoice_id: inv.id,
        period_month: periodMonth,
        interest_amount: interestAmount,
        applied_at: todayStr,
      })

      // Increase invoice total by interest amount
      await admin
        .from('invoices')
        .update({
          total_amount: newTotal,
          interest_penalty_amount: money(alreadyChargedInterest + interestAmount),
        })
        .eq('id', inv.id)

      // Append interest charge to tenant ledger
      await admin.from('ledger_entries').insert({
        agency_id: inv.agency_id,
        tenant_id: inv.tenant_id,
        invoice_id: inv.id,
        debit_account: 'Interest Receivable',
        credit_account: 'Interest Income',
        amount: interestAmount,
        entry_date: todayStr,
        reference: `INT-${periodMonth}`,
      })

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

      totalInterest = money(totalInterest + interestAmount)
      appliedCount++
    }

    return NextResponse.json({
      status: 'ok',
      periodMonth,
      appliedCount,
      totalInterest,
      results,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Interest application failed' }, { status: 500 })
  }
}

export async function POST(req: Request): Promise<Response> {
  return GET(req)
}
