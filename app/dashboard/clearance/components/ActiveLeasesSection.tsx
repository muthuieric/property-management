'use client'

import { useState, useMemo } from 'react'
import MoveOutDrawer, { ActiveLeaseClearanceItem, UnitTicketItem } from './MoveOutDrawer'

interface ActiveLeasesSectionProps {
  leases: ActiveLeaseClearanceItem[]
  unitTickets: UnitTicketItem[]
  initiateMoveOutAction: (formData: FormData) => Promise<void> | void
}

export default function ActiveLeasesSection({
  leases,
  unitTickets,
  initiateMoveOutAction,
}: ActiveLeasesSectionProps) {
  const [selectedLease, setSelectedLease] = useState<ActiveLeaseClearanceItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredLeases = useMemo(() => {
    if (!searchQuery.trim()) return leases
    const q = searchQuery.toLowerCase()
    return leases.filter((lease) => {
      const tenantName = lease.tenants
        ? `${lease.tenants.first_name || ''} ${lease.tenants.last_name || ''}`.toLowerCase()
        : ''
      const propertyName = (lease.units?.properties?.name || '').toLowerCase()
      const unitNum = (lease.units?.unit_number || '').toLowerCase()
      return tenantName.includes(q) || propertyName.includes(q) || unitNum.includes(q)
    })
  }, [leases, searchQuery])

  return (
    <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6">
      {/* CARD HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-slate-100 text-slate-800 rounded-lg text-xs">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </span>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Active Leases (Move-Out Initiation)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Reconcile deposit escrow, deduct verified contractor repairs, and execute final tenant turnover clearance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {leases.length > 3 && (
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tenant or unit..."
                className="w-48 sm:w-56 text-xs rounded-lg border border-slate-200 bg-white px-3 py-1.5 pl-8 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition"
              />
              <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          )}

          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-800 shrink-0">
            {leases.length} Active Leases
          </span>
        </div>
      </div>

      {/* LEASES TABLE */}
      {leases.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-400 italic">
          No active tenancies found eligible for move-out clearance.
        </div>
      ) : filteredLeases.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-400 italic">
          No leases matching &quot;{searchQuery}&quot;.
        </div>
      ) : (
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 font-semibold text-slate-600 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Tenant</th>
                <th className="py-3 px-4">Property & Unit</th>
                <th className="py-3 px-4 text-right">Escrow Deposit</th>
                <th className="py-3 px-4 text-right">Outstanding Arrears</th>
                <th className="py-3 px-4 text-right">Pre-Repair Net</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLeases.map((lease) => {
                const tenant = lease.tenants
                const tenantName = tenant
                  ? `${tenant.first_name || ''} ${tenant.last_name || ''}`.trim() || 'Tenant'
                  : 'Tenant'
                const deposit = Number(lease.deposit_amount || 0)
                const unpaidDues = Number(lease.unpaidDues || 0)
                const preRepairNet = deposit - unpaidDues

                return (
                  <tr
                    key={`clearance-row-${lease.id}`}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    {/* Tenant Info */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <p className="font-bold text-slate-900 text-sm">{tenantName}</p>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        {tenant?.phone || tenant?.email || 'No contact on file'}
                      </p>
                    </td>

                    {/* Property & Unit */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <p className="font-semibold text-slate-800">
                        {lease.units?.properties?.name || 'Assigned Property'}
                      </p>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        Unit #{lease.units?.unit_number}
                      </p>
                    </td>

                    {/* Escrow Deposit */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-right">
                      <span className="font-semibold text-slate-900 tabular-nums">
                        KES {deposit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Secured in escrow</span>
                    </td>

                    {/* Current Arrears */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-right">
                      <span
                        className={`font-semibold tabular-nums ${
                          unpaidDues > 0 ? 'text-amber-700 font-bold' : 'text-emerald-700'
                        }`}
                      >
                        KES {unpaidDues.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {unpaidDues > 0 ? 'Pending arrears' : 'Zero balance'}
                      </span>
                    </td>

                    {/* Pre-Repair Net */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-right">
                      <span
                        className={`font-bold tabular-nums ${
                          preRepairNet >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        KES {preRepairNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {preRepairNet >= 0 ? 'Est. refund' : 'Net deficit'}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedLease(lease)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 hover:shadow-md text-white cursor-pointer transition-all duration-200 ease-in-out shadow-xs"
                      >
                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span>Initiate Move-Out</span>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MOVE-OUT SLIDE-OVER DRAWER */}
      <MoveOutDrawer
        isOpen={!!selectedLease}
        onClose={() => setSelectedLease(null)}
        lease={selectedLease}
        unitTickets={unitTickets}
        action={initiateMoveOutAction}
      />
    </div>
  )
}
