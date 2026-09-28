// app/dashboard/deposits/page.tsx
import { createClient } from '@/utils/supabase/server'
import { endLease } from './actions'
import { getUserAgencyContext } from '@/utils/supabase/get-context'
import Link from 'next/link'
import ReleaseDepositButton from './components/ReleaseDepositButton'

export default async function DepositsLedgerPage() {
  const supabase = await createClient()
  const { agencyId } = await getUserAgencyContext()

  // Notice we added `id` inside the `units` block so we can pass it to the action
  const { data: activeLeases } = await supabase
  // 1. Fetch active leases with deposit escrow scoped to this agency
  let query = supabase
    .from('leases')
    .select(`
      id,
      start_date,
      deposit_amount,
      tenants ( first_name, last_name, email ),
      is_active,
      agency_id,
      tenants (
        id,
        first_name,
        last_name,
        email,
        phone
      ),
      units (
        id,
        unit_number,
        properties ( name )
        base_rent,
        properties (
          id,
          name,
          location
        )
      )
    `)
    .eq('is_active', true)
    .order('start_date', { ascending: false })

  const totalEscrow = activeLeases?.reduce(
    (sum, lease) => sum + Number(lease.deposit_amount),
  if (agencyId) {
    query = query.eq('agency_id', agencyId)
  }

  const { data: activeLeasesData } = await query
  const activeLeases = activeLeasesData || []

  // Compute escrow macro metrics
  const totalEscrow = activeLeases.reduce(
    (sum, lease) => sum + Number(lease.deposit_amount || 0),
    0
  ) || 0
  )
  const totalCount = activeLeases.length
  const averageDeposit = totalCount > 0 ? Math.round(totalEscrow / totalCount) : 0

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full">
      <header className="mb-8 pb-4 border-b">
        <h1 className="text-3xl font-bold">Deposit Escrow Ledger</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track and verify all locked security deposits across your portfolio.
        </p>
    <div className="p-4 md:p-8 text-slate-900 w-full max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-900 text-white shadow-xs">
              Institutional Escrow Vault
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Statutory Trust Custody &bull; {totalCount} Active {totalCount === 1 ? 'Deposit' : 'Deposits'}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 font-sans">
            Deposit Escrow Ledger
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Real-time custody tracking, statutory deposit security, and auditable lease turnover across your portfolio.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard"
            className="border border-slate-200 bg-white text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-all duration-200 ease-in-out font-semibold text-xs shadow-xs"
          >
            &larr; Executive Overview
          </Link>
          <Link
            href="/dashboard/properties"
            className="bg-slate-900 hover:bg-slate-800 hover:shadow-md text-white px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ease-in-out font-semibold text-xs shadow-xs"
          >
            View Properties
          </Link>
        </div>
      </header>

      <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-lg shadow-sm">
          <h3 className="text-emerald-800 text-sm font-semibold uppercase tracking-wider mb-2">
            Total Funds in Escrow
          </h3>
          <p className="text-4xl font-bold text-emerald-900">
            KES {totalEscrow.toLocaleString()}
          </p>
      {/* Escrow Bento Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Card 1: Total Locked in Escrow */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Total Funds in Escrow
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                100% Ring-Fenced
              </span>
            </div>
            <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
              KES {totalEscrow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 text-xs text-slate-500">
            Dedicated statutory tenant trust balance
          </div>
        </div>

        {/* Card 2: Active Deposit Accounts */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Secured Tenancies
              </span>
              <span className="text-xs font-medium text-slate-400">
                Active Contracts
              </span>
            </div>
            <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
              {totalCount}
            </p>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 text-xs text-slate-500">
            Active leases with deposited collateral
          </div>
        </div>

        {/* Card 3: Average Deposit */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Average Deposit per Lease
              </span>
              <span className="text-xs font-medium text-slate-400">
                Standard Benchmark
              </span>
            </div>
            <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
              KES {averageDeposit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 text-xs text-slate-500">
            Portfolio standard security reserve
          </div>
        </div>
      </div>

      <section className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="p-4 md:p-6 border-b bg-gray-50 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Active Deposits</h2>
      {/* Active Deposits Premium Table Container */}
      <section className="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Active Deposit Ledgers & Custody Accounts</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified security deposits held in trust for active tenancy agreements.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 tabular-nums self-start sm:self-auto">
            {totalCount} Active Accounts
          </span>
        </div>
        
        {!activeLeases || activeLeases.length === 0 ? (
          <div className="p-8 text-center text-gray-500 italic">
            No active deposits found.
        {activeLeases.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <svg className="w-10 h-10 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-semibold text-slate-700 text-sm">No Active Deposits in Trust</p>
            <p className="text-xs text-slate-400 mt-1">All tenant leases have been settled or no deposits have been logged yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
            <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
              <thead>
                <tr className="bg-white border-b text-sm text-gray-500">
                  <th className="p-4 font-semibold">Tenant</th>
                  <th className="p-4 font-semibold">Property & Unit</th>
                  <th className="p-4 font-semibold">Lease Started</th>
                  <th className="p-4 font-semibold text-right">Deposit Amount</th>
                  <th className="p-4 font-semibold text-center">Actions</th>
                <tr className="bg-slate-50/80 border-b border-slate-200 uppercase text-[10px] font-semibold text-slate-500 tracking-wider">
                  <th className="p-4 pl-6">Tenant Occupant</th>
                  <th className="p-4">Property & Unit</th>
                  <th className="p-4">Lease Inception</th>
                  <th className="p-4 text-right">Escrow Amount</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeLeases.map((lease: any) => (
                  <tr key={lease.id} className="border-b hover:bg-gray-50 transition">
                    <td className="p-4">
                      <p className="font-medium">
                        {lease.tenants.first_name} {lease.tenants.last_name}
                      </p>
                      <p className="text-xs text-gray-500">{lease.tenants.email}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-gray-800">{lease.units.properties.name}</p>
                      <p className="text-xs text-gray-500">Unit {lease.units.unit_number}</p>
                    </td>
                    <td className="p-4 text-gray-600 text-sm">
                      {new Date(lease.start_date).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right font-bold text-slate-700">
                      KES {Number(lease.deposit_amount).toLocaleString()}
                    </td>
                    <td className="p-4 text-center bg-gray-50/50">
                      {/* The Form that triggers the Move-Out / Refund process */}
                      <form action={endLease}>
                        <input type="hidden" name="lease_id" value={lease.id} />
                        <input type="hidden" name="unit_id" value={lease.units.id} />
                        <button 
                          type="submit" 
                          className="text-sm bg-white border border-red-200 text-red-600 px-3 py-1 rounded-md hover:bg-red-50 hover:border-red-300 transition shadow-sm"
                        >
                          Refund & End Lease
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              <tbody className="divide-y divide-slate-100">
                {activeLeases.map((lease: any) => {
                  const tenant = lease.tenants
                  const tenantName = tenant
                    ? `${tenant.first_name || ''} ${tenant.last_name || ''}`.trim() || 'Valued Tenant'
                    : 'Unassigned Tenant'
                  const propertyName = lease.units?.properties?.name || 'Property'
                  const unitNumber = lease.units?.unit_number || 'N/A'
                  const depositNum = Number(lease.deposit_amount || 0)

                  return (
                    <tr key={lease.id} className="hover:bg-slate-50/70 transition-all duration-150">
                      <td className="p-4 pl-6">
                        <p className="font-bold text-slate-900 text-sm">
                          {tenantName}
                        </p>
                        {tenant?.email && (
                          <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                            {tenant.email}
                          </span>
                        )}
                      </td>

                      <td className="p-4">
                        <p className="font-semibold text-slate-800">
                          {propertyName}
                        </p>
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                          Unit {unitNumber}
                        </span>
                      </td>

                      <td className="p-4 text-slate-600">
                        <span className="font-medium text-slate-700">
                          {lease.start_date
                            ? new Date(lease.start_date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : '—'}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        <span className="font-bold text-slate-900 tabular-nums text-sm">
                          KES {depositNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="block text-[10px] text-emerald-700 font-semibold uppercase tracking-wider">
                          Locked in Trust
                        </span>
                      </td>

                      <td className="p-4 pr-6 text-right">
                        <ReleaseDepositButton
                          leaseId={lease.id}
                          unitId={lease.units?.id || ''}
                          tenantName={tenantName}
                          unitNumber={unitNumber}
                          propertyName={propertyName}
                          depositAmount={depositNum}
                        />
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