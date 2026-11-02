import { NextResponse } from 'next/server'
import { applyMonthlyInterest } from '@/app/lib/debt-control'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET: run interest for the previous month (intended for cron)
// POST: run interest for a specified period month (?period=YYYY-MM or body {periodMonth})
export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url)
  const periodMonth = searchParams.get('period') || previousMonth()

  try {
    const result = await applyMonthlyInterest({ periodMonth })
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json({
      status: 'ok',
      periodMonth,
      appliedCount: result.appliedCount,
      totalInterest: result.totalInterest,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Interest application failed' }, { status: 500 })
  }
}

export async function POST(req: Request): Promise<Response> {
  let body: { periodMonth?: string }
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const periodMonth = body.periodMonth || previousMonth()

  try {
    const result = await applyMonthlyInterest({ periodMonth })
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json({
      status: 'ok',
      periodMonth,
      appliedCount: result.appliedCount,
      totalInterest: result.totalInterest,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Interest application failed' }, { status: 500 })
  }
}

function previousMonth(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 7)
}
