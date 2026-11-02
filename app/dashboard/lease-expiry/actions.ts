'use server'

import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'

export interface ExpiringLeaseRow {
  leaseId: string
  tenantId: string
  tenantName: string
  unitNumber: string | null
  propertyId: string | null
  propertyName: string | null
  startDate: string | null
  endDate: string | null
  daysRemaining: number | null
  status: 'expired' | 'expiring' | 'active'
  baseRent: number
}

export interface LeaseExpiryResult {
  rows: ExpiringLeaseRow[]
  expiredCount: number
  expiringCount: number
  totalAtRisk: number
  withinWindowCount: number
}

export interface LeaseExpiryFilters {
  monthsAhead: number
  propertyId?: string
  statusFilter: 'all' | 'expired' | 'expiring'
}

function daysBetween(from: string, to: string): number {
  const a = new Date(from)
  const b = new Date(to)
  a.setHours(0, 0, 0, 0)
  b.setHours(0, 0, 0, 0)
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

export async function getLeaseExpiry({
  monthsAhead,
  propertyId,
  statusFilter,
}: LeaseExpiryFilters): Promise<LeaseExpiryResult> {
  const { agencyId } = await getUserAgencyContext()
  const supabase = await createClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)

  const { data: leases, error } = await supabase
    .from('leases')
    .select(
      `
      id,
      tenant_id,
      unit_id,
      property_id,
      agency_id,
      start_date,
      end_date,
      is_active,
      lease_status,
      units ( id, unit_number, base_rent, properties ( id, name ) ),
      tenants ( id, first_name, last_name )
    `
    )
    .eq('agency_id', agencyId)
    .eq('is_active', true)
    .order('end_date', { ascending: true, nullsFirst: false })

  if (error || !leases) {
    console.error('getLeaseExpiry error:', error)
    return { rows: [], expiredCount: 0, expiringCount: 0, totalAtRisk: 0, withinWindowCount: 0 }
  }

  const rows: ExpiringLeaseRow[] = []

  for (const lease of leases as Array<Record<string, unknown>>) {
    const unit = lease.units as { unit_number: string | null; base_rent: number | null; properties: { id: string; name: string } | null } | null
    const tenant = lease.tenants as { first_name: string | null; last_name: string | null } | null
    const property = (unit?.properties as { id: string; name: string } | null)

    if (propertyId && property?.id !== propertyId) continue

    const endDate = (lease.end_date as string | null)
    const daysRemaining = endDate ? daysBetween(todayStr, endDate) : null

    let status: 'expired' | 'expiring' | 'active' = 'active'
    if (endDate && daysRemaining !== null && daysRemaining < 0) {
      status = 'expired'
    } else if (endDate && daysRemaining !== null && daysRemaining <= monthsAhead * 30) {
      status = 'expiring'
    }

    if (statusFilter === 'expired' && status !== 'expired') continue
    if (statusFilter === 'expiring' && status !== 'expiring') continue

    rows.push({
      leaseId: (lease.id as string),
      tenantId: (lease.tenant_id as string),
      tenantName: `${(tenant?.first_name as string | null) ?? ''} ${(tenant?.last_name as string | null) ?? ''}`.trim() || 'Unknown',
      unitNumber: unit?.unit_number ?? null,
      propertyId: property?.id ?? null,
      propertyName: property?.name ?? null,
      startDate: (lease.start_date as string | null),
      endDate,
      daysRemaining,
      status,
      baseRent: Number(unit?.base_rent || 0),
    })
  }

  const expiredCount = rows.filter((r) => r.status === 'expired').length
  const expiringCount = rows.filter((r) => r.status === 'expiring').length
  const withinWindowCount = rows.filter((r) => r.status === 'expiring' && r.daysRemaining !== null && r.daysRemaining >= 0).length
  const totalAtRisk = rows.reduce((sum, r) => sum + r.baseRent, 0)

  rows.sort((a, b) => {
    if (a.daysRemaining === null && b.daysRemaining === null) return 0
    if (a.daysRemaining === null) return 1
    if (b.daysRemaining === null) return -1
    return a.daysRemaining - b.daysRemaining
  })

  return {
    rows,
    expiredCount,
    expiringCount,
    totalAtRisk,
    withinWindowCount,
  }
}

export async function getExpiryProperties(): Promise<Array<{ id: string; name: string }>> {
  const { agencyId } = await getUserAgencyContext()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('properties')
    .select('id, name')
    .eq('agency_id', agencyId)
    .order('name', { ascending: true })

  if (error || !data) {
    console.error('getExpiryProperties error:', error)
    return []
  }

  return data.map((p) => ({ id: p.id, name: p.name }))
}
