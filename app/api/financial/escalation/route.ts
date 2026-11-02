import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { applyEscalation, money } from '@/app/lib/financial/engine'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Cron: runs once daily at 01:00 UTC
// Checks all active leases; when a lease hits its anniversary (same month/day as
// start_date), applies a compound annual escalation to BOTH base rent and service
// charge, and increments years_elapsed on the lease.
export async function GET(req: Request): Promise<Response> {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.VERCEL_CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().slice(0, 10)
    const todayMonth = today.getMonth() + 1 // 1-12
    const todayDay = today.getDate()

    // Fetch all active leases with their units
    const { data: leases, error: leasesErr } = await admin
      .from('leases')
      .select(
        `
        id,
        unit_id,
        tenant_id,
        agency_id,
        start_date,
        end_date,
        is_active,
        lease_status,
        escalation_percentage,
        years_elapsed,
        units ( id, unit_number, base_rent, square_footage, property_id )
      `
      )
      .eq('is_active', true)
      .eq('lease_status', 'active')
      .not('start_date', 'is', null)

    if (leasesErr) {
      return NextResponse.json({ error: leasesErr.message }, { status: 500 })
    }

    const applied: Array<{
      leaseId: string
      unitId: string
      unitNumber: string | null
      oldBaseRent: number
      newBaseRent: number
      oldServiceCharge: number
      newServiceCharge: number
      yearsElapsed: number
    }> = []

    let totalApplied = 0

    for (const lease of (leases ?? [])) {
      const startDate = (lease as any).start_date as string | null
      if (!startDate) continue

      const start = new Date(startDate + 'T00:00:00')
      // Anniversary check: same month and day as start_date
      if (start.getMonth() + 1 !== todayMonth || start.getDate() !== todayDay) continue

      const unit = (lease as any).units as {
        id: string
        unit_number: string | null
        base_rent: number | null
        square_footage: number | null
        property_id: string | null
      } | null
      if (!unit) continue

      const agencyId = (lease as any).agency_id as string
      const escalationPct = Number((lease as any).escalation_percentage || 0)
      if (escalationPct <= 0) continue

      const currentYears = Number((lease as any).years_elapsed || 0)
      const newYears = currentYears + 1

      const oldBaseRent = Number(unit.base_rent || 0)
      const newBaseRent = applyEscalation(oldBaseRent, escalationPct / 100, 1)

      // Fetch current service charge rate for the property
      let ratePerSqft = 0
      try {
        ratePerSqft = await (await import('@/app/lib/financial/engine')).getServiceChargeRate({
          agencyId,
          propertyId: unit.property_id ?? null,
          billingMonth: todayStr.slice(0, 7),
        })
      } catch {
        ratePerSqft = 0
      }

      const oldServiceCharge = money(
        Number(unit.square_footage || 0) * ratePerSqft
      )
      const newServiceCharge = applyEscalation(oldServiceCharge, escalationPct / 100, 1)

      // Update unit base_rent to escalated amount
      await admin
        .from('units')
        .update({ base_rent: newBaseRent })
        .eq('id', unit.id)

      // Update lease years_elapsed
      await admin
        .from('leases')
        .update({ years_elapsed: newYears, escalation_applied: true })
        .eq('id', lease.id)

      applied.push({
        leaseId: lease.id,
        unitId: unit.id,
        unitNumber: unit.unit_number,
        oldBaseRent,
        newBaseRent,
        oldServiceCharge,
        newServiceCharge,
        yearsElapsed: newYears,
      })

      totalApplied++
    }

    return NextResponse.json({
      status: 'ok',
      date: todayStr,
      totalApplied,
      applied,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? 'Escalation cron failed' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request): Promise<Response> {
  return GET(req)
}
