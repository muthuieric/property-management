import { NextResponse } from 'next/server'
import { runAllAgenciesMonthlyBilling } from '@/app/lib/cron/monthly-billing'

export const dynamic = 'force-dynamic'
export const maxDuration = 900

// Cron: runs on the 1st of every month at 00:00 UTC
// Generates invoices, PDFs, and emails for all active leases across all agencies
export async function GET(req: Request): Promise<Response> {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.VERCEL_CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const billingMonth = searchParams.get('month') || new Date().toISOString().slice(0, 7)

  try {
    const results = await runAllAgenciesMonthlyBilling({ billingMonth })
    const totalGenerated = results.reduce((sum, r) => sum + r.generated, 0)
    const totalEmailed = results.reduce((sum, r) => sum + r.emailed, 0)
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0)

    return NextResponse.json({
      status: 'ok',
      billingMonth,
      agencies: results.length,
      totalGenerated,
      totalEmailed,
      totalErrors,
      results,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Monthly billing failed' }, { status: 500 })
  }
}

export async function POST(req: Request): Promise<Response> {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.VERCEL_CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { month?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const billingMonth = body.month || new Date().toISOString().slice(0, 7)

  try {
    const results = await runAllAgenciesMonthlyBilling({ billingMonth })
    const totalGenerated = results.reduce((sum, r) => sum + r.generated, 0)
    const totalEmailed = results.reduce((sum, r) => sum + r.emailed, 0)

    return NextResponse.json({
      status: 'ok',
      billingMonth,
      agencies: results.length,
      totalGenerated,
      totalEmailed,
      results,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Monthly billing failed' }, { status: 500 })
  }
}
