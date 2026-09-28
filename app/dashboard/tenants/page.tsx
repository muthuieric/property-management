// app/dashboard/tenants/page.tsx
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'
import Link from 'next/link'
import { toggleUserStatusFormAction } from '@/app/dashboard/team/actions'
import TenantAddTrigger from './components/TenantAddTrigger'

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const message = resolvedSearchParams.message

  const supabase = await createClient()
  const { agencyId, role } = await getUserAgencyContext()
  const isOwner = role === 'agency_owner'

  // 1. Fetch all tenants for this agency
  const { data: tenantsData, error: tenantError } = await supabase
    .from('tenants')
    .select(`id, first_name, last_name, email, phone_number, user_id, is_active, created_at`)
    .eq('agency_id', agencyId)
    .order('first_name', { ascending: true })

  console.log("DATABASE ERROR:", tenantError) // <--- THIS WILL TELL US THE TRUTH
  const tenants = tenantsData || []

  // 2. Fetch profiles for these tenants to determine auth suspension
  const tenantUserIds = tenants.map((t) => t.user_id).filter(Boolean)
  const profileStatusMap = new Map<string, boolean>()

  if (tenantUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, is_active')
      .in('id', tenantUserIds)

    profiles?.forEach((p) => {
      profileStatusMap.set(p.id, p.is_active !== false)
    })
  }

  // 3. Fetch all active leases to display financial alignment (rent & deposit in trust)
  const { data: activeLeases } = await supabase
    .from('leases')
    .select(`
      id,
      tenant_id,
      deposit_amount,
      is_active,
      units (
        id,
        unit_number,
        base_rent,
        properties ( name )
      )
    `)
    .eq('agency_id', agencyId)
    .eq('is_active', true)

  const leaseMap = new Map<string, any>()
  activeLeases?.forEach((l) => {
    if (l.tenant_id) {
      leaseMap.set(l.tenant_id, l)
    }
  })

  // Compute directory aggregates
  const activeTenantsCount = tenants.filter((t) => {
    const profileActive = t.user_id ? profileStatusMap.get(t.user_id) : true
    return t.is_active !== false && profileActive !== false
  }).length
  const suspendedTenantsCount = tenants.length - activeTenantsCount

  const totalContractedRent = activeLeases?.reduce((sum, l) => {
    const rent = Number((l.units as any)?.base_rent || 0)
    return sum + rent
  }, 0) || 0

  const totalDepositsHeld = activeLeases?.reduce((sum, l) => {
    return sum + Number(l.deposit_amount || 0)
  }, 0) || 0

  const isSuccess = message && message.toLowerCase().includes('success')

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-900 text-white shadow-xs">
              Tenancy Directory
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {tenants.length} Registered &bull; {activeTenantsCount} Active Standing &bull; {suspendedTenantsCount} Suspended
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 font-sans">
            Tenant Management
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Institutional roster of tenant records, active lease commitments, deposit trust custody, and portal access authorization.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard"
            className="border border-slate-200 bg-white text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-50 transition font-medium text-xs shadow-xs"
          >
            &larr; Dashboard
          </Link>
          <TenantAddTrigger />
        </div>
      </header>

      {/* Message Feedback Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl text-xs font-medium border flex items-center justify-between ${
            isSuccess
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-900 border-amber-200'
          }`}
        >
          <span>{message}</span>
        </div>
      )}

      {/* Directory Metrics Bento Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Active Tenant Standing
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                {tenants.length > 0 ? Math.round((activeTenantsCount / tenants.length) * 100) : 0}% Active
              </span>
            </div>
            <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums mt-1">
              {activeTenantsCount}
            </p>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 text-xs text-slate-500 flex justify-between">
            <span>Suspended profiles:</span>
            <span className={suspendedTenantsCount > 0 ? 'text-rose-600 font-bold tabular-nums' : 'text-slate-500 tabular-nums'}>
              {suspendedTenantsCount} accounts
            </span>
          </div>
        </div>

        <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Contracted Monthly Rent
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                Active Leases
              </span>
            </div>
            <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums mt-1">
              KES {totalContractedRent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 text-xs text-slate-500">
            Across {activeLeases?.length || 0} active tenancies
          </div>
        </div>

        <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Deposits In Custody
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                Segregated Trust
              </span>
            </div>
            <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums mt-1">
              KES {totalDepositsHeld.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 text-xs text-slate-500">
            Fully refundable upon verified clearance
          </div>
        </div>
      </div>

      {/* Premium White Container Data Table */}
      <section className="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 bg-white flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Tenant Roster & Access Controls</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive directory with database suspension enforcement and right-aligned financial figures.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 tabular-nums">
            {tenants.length} Records
          </span>
        </div>

        {tenants.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No tenants registered in this agency yet. Click &quot;+ Register Tenant&quot; to onboard.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 tracking-wider text-xs font-semibold text-slate-500 uppercase">
                  <th className="p-4 pl-6 text-left">Tenant Profile</th>
                  <th className="p-4 text-left">Contact Info</th>
                  <th className="p-4 text-left">Assigned Site & Unit</th>
                  <th className="p-4 text-right">Monthly Rent</th>
                  <th className="p-4 text-right">Deposit in Trust</th>
                  <th className="p-4 text-center">Account Standing</th>
                  <th className="p-4 pr-6 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenants.map((tenant) => {
                  const targetUserId = tenant.user_id || tenant.id
                  const profileActive = tenant.user_id ? profileStatusMap.get(tenant.user_id) : true
                  const isActive = tenant.is_active !== false && profileActive !== false

                  const lease = leaseMap.get(tenant.id)
                  const unit = lease?.units
                  const propertyName = unit?.properties?.name
                  const rent = unit?.base_rent ? Number(unit.base_rent) : null
                  const deposit = lease?.deposit_amount ? Number(lease.deposit_amount) : null

                  return (
                    <tr
                      key={tenant.id}
                      className={`hover:bg-slate-50/70 transition-all ${
                        !isActive ? 'opacity-50 grayscale' : ''
                      }`}
                    >
                      {/* Identity & Avatar */}
                      <td className="p-4 pl-6 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 shadow-xs ${
                              isActive
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {tenant.first_name?.[0] || 'T'}
                            {tenant.last_name?.[0] || ''}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">
                              {tenant.first_name} {tenant.last_name}
                            </p>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              ID: {tenant.id.slice(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="p-4 whitespace-nowrap">
                        <p className="text-slate-800 font-medium">{tenant.email}</p>
                        <p className="text-slate-400 text-[11px] mt-0.5">
                          {tenant.phone_number || 'No phone provided'}
                        </p>
                      </td>

                      {/* Leased Unit & Property */}
                      <td className="p-4 whitespace-nowrap">
                        {unit ? (
                          <div>
                            <p className="font-semibold text-slate-900">
                              {propertyName || 'Property Site'}
                            </p>
                            <span className="text-[11px] text-slate-500 block">
                              Unit {unit.unit_number}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">
                            No active lease
                          </span>
                        )}
                      </td>

                      {/* Monthly Rent (Right-aligned with tabular-nums) */}
                      <td className="p-4 whitespace-nowrap text-right font-bold text-slate-900 tabular-nums">
                        {rent != null ? (
                          `KES ${rent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        ) : (
                          <span className="text-slate-400 font-normal font-sans text-[11px]">—</span>
                        )}
                      </td>

                      {/* Deposit in Trust (Right-aligned with tabular-nums) */}
                      <td className="p-4 whitespace-nowrap text-right font-bold text-slate-900 tabular-nums">
                        {deposit != null ? (
                          `KES ${deposit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        ) : (
                          <span className="text-slate-400 font-normal font-sans text-[11px]">—</span>
                        )}
                      </td>

                      {/* Account Standing Status Indicator */}
                      <td className="p-4 whitespace-nowrap text-center">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                            Suspended
                          </span>
                        )}
                      </td>

                      {/* Quick Actions (Ghost buttons styled with hover:bg-slate-100) */}
                      <td className="p-4 pr-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Ledger Ghost Button */}
                          <Link
                            href={`/dashboard/financials?tenant_id=${tenant.id}`}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition inline-flex items-center"
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-all duration-200 ease-in-out inline-flex items-center"
                          >
                            View Ledger
                          </Link>

                          {/* + Create Lease (if active and unleased) */}
                          {isActive && !unit && (
                            <Link
                              href={`/dashboard/leases/new?tenant_id=${tenant.id}`}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-slate-100 transition inline-flex items-center"
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-slate-100 cursor-pointer transition-all duration-200 ease-in-out inline-flex items-center"
                            >
                              + Lease
                            </Link>
                          )}

                          {/* Suspend / Reactivate Ghost Button (Owner Only) */}
                          {isOwner && (
                            <form action={toggleUserStatusFormAction} className="inline">
                              <input type="hidden" name="user_id" value={targetUserId} />
                              <input type="hidden" name="current_status" value={String(isActive)} />
                              <input type="hidden" name="redirect_path" value="/dashboard/tenants" />
                              <button
                                type="submit"
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-100 transition ${
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-100 cursor-pointer transition-all duration-200 ease-in-out ${
                                  isActive
                                    ? 'text-slate-600 hover:text-rose-700'
                                    : 'text-emerald-700 hover:text-emerald-800'
                                }`}
                              >
                                {isActive ? 'Suspend' : 'Reactivate'}
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
