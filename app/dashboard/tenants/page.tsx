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
  const { data: tenantsData } = await supabase
    .from('tenants')
    .select(`
      id,
      first_name,
      last_name,
      email,
      phone_number,
      user_id,
      is_active,
      created_at
    `)
    .eq('agency_id', agencyId)
    .order('first_name', { ascending: true })

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
              {tenants.length} Registered Tenants &bull; {activeTenantsCount} Active Accounts
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 font-sans">
            Tenant Directory
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Institutional ledger of tenant profiles, active unit allocations, contracted rent rolls, and security deposits.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <TenantAddTrigger />
        </div>
      </header>

      {/* Message Feedback Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl text-xs border flex items-center justify-between transition-all duration-200 ${
            isSuccess
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-900 border-amber-200'
          }`}
        >
          <span className="font-medium">{message}</span>
        </div>
      )}

      {/* KPI Cards Bento Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Card 1: Active Tenants */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Active Tenants
              </span>
              <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                {activeTenantsCount} Verified
              </span>
            </div>
            <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
              {activeTenantsCount}
            </p>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span>Suspended profiles:</span>
            <span className="font-semibold text-slate-700 tabular-nums">{suspendedTenantsCount}</span>
          </div>
        </div>

        {/* Card 2: Contracted Rent Roll */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Contracted Monthly Rent
              </span>
              <span className="text-xs font-medium text-slate-400">
                Active Leases
              </span>
            </div>
            <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
              KES {totalContractedRent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 text-xs text-slate-500">
            Current active revenue pipeline
          </div>
        </div>

        {/* Card 3: Escrow Deposits */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Security Deposits in Trust
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Custody
              </span>
            </div>
            <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
              KES {totalDepositsHeld.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 text-xs text-slate-500">
            Held in ring-fenced trust accounts
          </div>
        </div>
      </div>

      {/* Modern Tenants Data Table */}
      <section className="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Tenant Roster & Custody Ledgers</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified records with contact details, property allocations, and portal account standing.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 tabular-nums self-start sm:self-auto">
            {tenants.length} Total Records
          </span>
        </div>

        {tenants.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <svg className="w-10 h-10 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zM7 10a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
            <p className="font-semibold text-slate-700 text-sm">No Tenants Registered</p>
            <p className="text-xs text-slate-400 mt-1">Click &quot;+ Register Tenant&quot; above to onboard your first occupant.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 uppercase text-[10px] font-semibold text-slate-500 tracking-wider">
                  <th className="p-4 pl-6">Tenant Name</th>
                  <th className="p-4">Contact Information</th>
                  <th className="p-4">Leased Unit</th>
                  <th className="p-4 text-right">Base Rent</th>
                  <th className="p-4 text-right">Deposit in Trust</th>
                  <th className="p-4 text-center">Account Status</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenants.map((tenant) => {
                  const lease = leaseMap.get(tenant.id)
                  const unit = lease?.units
                  const propertyName = unit?.properties?.name
                  const rent = unit?.base_rent != null ? Number(unit.base_rent) : null
                  const deposit = lease?.deposit_amount != null ? Number(lease.deposit_amount) : null

                  const profileActive = tenant.user_id ? profileStatusMap.get(tenant.user_id) : true
                  const isActive = tenant.is_active !== false && profileActive !== false
                  const targetUserId = tenant.user_id || tenant.id

                  return (
                    <tr
                      key={tenant.id}
                      className={`hover:bg-slate-50/70 transition-all duration-150 ${
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

                      {/* Quick Actions (Ghost buttons styled with hover:bg-slate-100 and cursor-pointer) */}
                      <td className="p-4 pr-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Ledger Ghost Button */}
                          <Link
                            href={`/dashboard/financials?tenant_id=${tenant.id}`}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-all duration-200 ease-in-out inline-flex items-center"
                          >
                            View Ledger
                          </Link>

                          {/* + Create Lease (if active and unleased) */}
                          {isActive && !unit && (
                            <Link
                              href={`/dashboard/leases/new?tenant_id=${tenant.id}`}
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
