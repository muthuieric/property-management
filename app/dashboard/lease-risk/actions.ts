'use server'

import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'

export interface LeaseRiskRow {
  leaseId: string
  tenantId: string
  tenantName: string
  unitNumber: string | null
  propertyId: string | null
  propertyName: string | null
  baseRent: number | null
  endDate: string | null
  monthsUntilExpiry: number
  riskLevel: 'critical' | 'high' | 'medium' | 'low'
  annualValue: number
  escalationPercentage: number | null
  leaseStatus: string
}

export interface LeaseRiskSummary {
  totalAtRisk: number
  totalAnnualValue: number
  criticalCount: number
  highCount: number
  december2026Cluster: LeaseRiskRow[]
  upcomingExpiries: LeaseRiskRow[]
}

function monthsUntil(dateStr: string | null): number {
  if (!dateStr) return 999
  const end = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diffMs = end.getTime() - now.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30))
}

function riskLevel(months: number, annualValue: number): 'critical' | 'high' | 'medium' | 'low' {
  if (months <= 12 && annualValue > 1000000) return 'critical'
  if (months <= 18 && annualValue > 1000000) return 'high'
  if (months <= 12) return 'high'
  if (months <= 18) return 'medium'
  return 'low'
}

export async function getLeaseRiskDashboard(): Promise<LeaseRiskSummary> {
  const { agencyId } = await getUserAgencyContext()
  const supabase = await createClient()

  const { data: leases, error } = await supabase
    .from('leases')
    .select(
      `
      id,
      tenant_id,
      unit_id,
      end_date,
      base_rent:units(base_rent),
      unit_number:units(unit_number),
      property_name:units(properties(name)),
      property_id:units(property_id),
      escalation_percentage,
      lease_status,
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
    console.error('getLeaseRiskDashboard error:', error)
    return {
      totalAtRisk: 0,
      totalAnnualValue: 0,
      criticalCount: 0,
      highCount: 0,
      december2026Cluster: [],
      upcomingExpiries: [],
    }
  }

  const now = new Date()
  const twelveMonthsOut = new Date(now)
  twelveMonthsOut.setMonth(twelveMonthsOut.getMonth() + 12)
  const eighteenMonthsOut = new Date(now)
  eighteenMonthsOut.setMonth(eighteenMonthsOut.getMonth() + 18)

  const dec2026Start = new Date(2026, 11, 1)
  const dec2026End = new Date(2026, 11, 31)

  const rows: LeaseRiskRow[] = []

  for (const lease of (leases as unknown as any[])) {
    const months = monthsUntil(lease.end_date)
    const baseRent = Number(lease.base_rent?.base_rent || 0)
    const annualValue = baseRent * 12
    const level = riskLevel(months, annualValue)

    // Only include leases expiring within 18 months
    if (months > 18) continue

    const tenant = lease.tenants as { first_name: string | null; last_name: string | null } | null

    rows.push({
      leaseId: lease.id,
      tenantId: lease.tenant_id,
      tenantName: `${tenant?.first_name ?? ''} ${tenant?.last_name ?? ''}`.trim() || 'Unknown',
      unitNumber: lease.unit_number?.unit_number ?? null,
      propertyId: lease.property_id?.id ?? null,
      propertyName: lease.property_name?.name ?? null,
      baseRent: baseRent || null,
      endDate: lease.end_date,
      monthsUntilExpiry: months,
      riskLevel: level,
      annualValue,
      escalationPercentage: lease.escalation_percentage,
      leaseStatus: lease.lease_status,
    })
  }

  // Sort by months until expiry (soonest first)
  rows.sort((a, b) => a.monthsUntilExpiry - b.monthsUntilExpiry)

  const criticalCount = rows.filter((r) => r.riskLevel === 'critical').length
  const highCount = rows.filter((r) => r.riskLevel === 'high').length
  const totalAnnualValue = rows.reduce((sum, r) => sum + r.annualValue, 0)

  // December 2026 cluster
  const december2026Cluster = rows.filter((r) => {
    if (!r.endDate) return false
    const end = new Date(r.endDate + 'T00:00:00')
    return end >= dec2026Start && end <= dec2026End
  })

  return {
    totalAtRisk: rows.length,
    totalAnnualValue,
    criticalCount,
    highCount,
    december2026Cluster,
    upcomingExpiries: rows,
  }
}
