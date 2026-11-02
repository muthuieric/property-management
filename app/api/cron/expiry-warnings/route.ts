import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendEmail } from '@/app/lib/notifications'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Cron: runs once daily at 06:00 UTC
// Sends lease expiry warning emails to property managers 180, 90, and 30 days
// before any active lease expires, to initiate renewal negotiations.
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

  const WINDOWS = [180, 90, 30] as const

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data: leases, error: leasesErr } = await admin
      .from('leases')
      .select(
        `
        id,
        tenant_id,
        unit_id,
        agency_id,
        start_date,
        end_date,
        units ( unit_number, properties ( id, name ) ),
        tenants ( id, first_name, last_name, email, phone_number )
      `
      )
      .eq('is_active', true)
      .not('end_date', 'is', null)

    if (leasesErr) {
      return NextResponse.json({ error: leasesErr.message }, { status: 500 })
    }

    const typedLeases = (leases ?? []) as any[]

    const { data: profiles, error: profilesErr } = await admin
      .from('profiles')
      .select('id, email, first_name, last_name, role, agency_id')
      .eq('is_active', true)
      .in('role', ['agency_owner', 'property_manager', 'super_admin'])

    if (profilesErr) {
      return NextResponse.json({ error: profilesErr.message }, { status: 500 })
    }

    const byAgency = new Map<string, Array<{ id: string; email: string | null; name: string }>>()
    for (const p of (profiles ?? [])) {
      if (!p.email) continue
      const list = byAgency.get(p.agency_id) ?? []
      list.push({ id: p.id, email: p.email, name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() })
      byAgency.set(p.agency_id, list)
    }

    const { data: existingLogs } = await admin
      .from('notification_logs')
      .select('lease_id, window_days, channel')

    const logged = new Set<string>()
    for (const log of (existingLogs ?? [])) {
      logged.add(`${log.lease_id}|${log.window_days}|${log.channel}`)
    }

    const results: Array<{
      leaseId: string
      tenantName: string
      endDate: string | null
      windowDays: number
      sent: number
      skipped: number
      errors: string[]
    }> = []

    let totalSent = 0
    let totalSkipped = 0
    let totalErrors = 0

    for (const lease of typedLeases) {
      const endDate = lease.end_date
      if (!endDate) continue

      const end = new Date(endDate + 'T00:00:00')
      end.setHours(0, 0, 0, 0)

      const tenant = lease.tenants
      const unit = lease.units
      const property = unit?.properties ?? null
      const agencyId = lease.agency_id

      const tenantName = `${tenant?.first_name ?? ''} ${tenant?.last_name ?? ''}`.trim() || 'Unknown Tenant'

      const recipients = byAgency.get(agencyId) ?? []
      const recipientEmails = recipients.map((r) => r.email).filter(Boolean) as string[]

      const leaseResult = {
        leaseId: lease.id,
        tenantName,
        endDate,
        windowDays: 0,
        sent: 0,
        skipped: 0,
        errors: [] as string[],
      }

      for (const windowDays of WINDOWS) {
        const target = new Date(today)
        target.setDate(target.getDate() + windowDays)

        const diffMs = end.getTime() - target.getTime()
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

        if (diffDays !== 0) continue

        leaseResult.windowDays = windowDays

        const subject = `Lease Expiry Warning: ${tenantName} (Unit ${unit?.unit_number ?? 'N/A'}) expires in ${windowDays} days`
        const html = `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#134E4A;">
            <h2 style="color:#DC2626;">Lease Expiry Warning - Act Now</h2>
            <p>The lease for <strong>${tenantName}</strong> at <strong>${property?.name ?? 'Property'}</strong> (Unit ${unit?.unit_number ?? 'N/A'}) expires on <strong>${new Date(endDate).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.</p>
            <p><strong>Days remaining:</strong> ${windowDays}</p>
            <p>Please initiate renewal negotiations with the tenant to protect cash flow and avoid vacancy.</p>
            <p style="margin-top:24px;">
              <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/dashboard/lease-expiry" style="background:#0369A1;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">View Lease Expiry Dashboard</a>
            </p>
            <p style="margin-top:24px;color:#475569;font-size:13px;">Luffi Tech Property Management</p>
          </div>
        `

        for (const email of recipientEmails) {
          const logKey = `${lease.id}|${windowDays}|email`
          if (logged.has(logKey)) {
            leaseResult.skipped++
            continue
          }

          const result = await sendEmail({
            to: email,
            subject,
            html,
            text: `Lease expiry warning: ${tenantName} (Unit ${unit?.unit_number ?? 'N/A'}) expires in ${windowDays} days on ${endDate}. Initiate renewal negotiations.`,
          })

          if (result.success) {
            leaseResult.sent++
            totalSent++
            void admin.from('notification_logs').insert({
              agency_id: agencyId,
              lease_id: lease.id,
              tenant_id: lease.tenant_id,
              window_days: windowDays,
              channel: 'email',
              status: 'sent',
            })
            logged.add(logKey)
          } else {
            leaseResult.errors.push(`${email}: ${result.error}`)
            totalErrors++
          }
        }
      }

      if (leaseResult.sent > 0 || leaseResult.skipped > 0 || leaseResult.errors.length > 0) {
        results.push(leaseResult)
        totalSkipped += leaseResult.skipped
      }
    }

    return NextResponse.json({
      status: 'ok',
      totalLeases: typedLeases.length,
      totalSent,
      totalSkipped,
      totalErrors,
      results,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Expiry warning cron failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request): Promise<Response> {
  return GET(req)
}
