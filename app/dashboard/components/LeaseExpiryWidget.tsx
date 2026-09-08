// app/dashboard/components/LeaseExpiryWidget.tsx
'use client'

import { useState } from 'react'
import RenewalModal, { LeaseForRenewal } from './RenewalModal'

interface LeaseExpiryWidgetProps {
  leases: LeaseForRenewal[]
}

export default function LeaseExpiryWidget({ leases }: LeaseExpiryWidgetProps) {
  const [selectedLease, setSelectedLease] = useState<LeaseForRenewal | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'urgent' | 'pending_renewal' | 'vacating'>('all')

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  // Calculate days remaining helper
  const getDaysRemaining = (endDateStr: string | null) => {
    if (!endDateStr) return 999
    const expiry = new Date(endDateStr)
    expiry.setHours(0, 0, 0, 0)
    return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }

  // Filter leases based on quick toggle
  const filteredLeases = leases.filter((lease) => {
    if (!lease.end_date) return false
    const days = getDaysRemaining(lease.end_date)

    if (statusFilter === 'urgent') {
      return days <= 30
    }
    if (statusFilter === 'pending_renewal') {
      return lease.renewal_status === 'pending_renewal'
    }
    if (statusFilter === 'vacating') {
      return lease.renewal_status === 'vacating'
    }
    return true
  })

  const urgentCount = leases.filter((l) => l.end_date && getDaysRemaining(l.end_date) <= 30).length
  const pendingRenewalCount = leases.filter((l) => l.renewal_status === 'pending_renewal').length

  const handleOpenRenewal = (lease: LeaseForRenewal) => {
    setSelectedLease(lease)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedLease(null)
  }

  // Countdown badge helper
  const renderCountdownBadge = (days: number) => {
    if (days < 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
          Expired {Math.abs(days)}d ago
        </span>
      )
    }
    if (days === 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-ping" />
          Expires Today
        </span>
      )
    }
    if (days <= 14) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          Expires in {days} days
        </span>
      )
    }
    if (days <= 30) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Expires in {days} days
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
        Expires in {days} days
      </span>
    )
  }

  // Status pill helper
  const renderStatusPill = (status?: string | null) => {
    const s = status || 'active'
    switch (s) {
      case 'pending_renewal':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            Pending Renewal
          </span>
        )
      case 'renewed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
            Renewed
          </span>
        )
      case 'vacating':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-300">
            Vacating
          </span>
        )
      case 'active':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Active
          </span>
        )
    }
  }

  return (
    <section className="mb-10 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      
      {/* SECTION HEADER */}
      <div className="p-5 md:p-6 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-950/80 text-amber-400 border border-amber-500/30">
              60-Day Horizon
            </span>
            <span className="text-xs text-slate-400">
              Pipeline & Letter Generator
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">
            Lease Renewals & Expiries
          </h2>
          <p className="text-slate-300 text-xs md:text-sm mt-0.5">
            Active tenancies expiring within the next 60 days across your assigned sites.
          </p>
        </div>

        {/* Filter Badges Strip */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            All Upcoming ({leases.length})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('urgent')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              statusFilter === 'urgent'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            &le; 30 Days ({urgentCount})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('pending_renewal')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              statusFilter === 'pending_renewal'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            Pending ({pendingRenewalCount})
          </button>
        </div>
      </div>

      {/* DATA TABLE CONTAINER */}
      {filteredLeases.length === 0 ? (
        <div className="p-10 text-center text-slate-500 bg-slate-50/50">
          <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="font-bold text-slate-800 text-base">No Leases Expiring Soon</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            All active residential leases in your delegated sites have more than 60 days remaining on their agreements.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs md:text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] uppercase font-bold tracking-wider">
                <th className="py-3.5 px-4 md:px-6">Property / Unit</th>
                <th className="py-3.5 px-4">Tenant Details</th>
                <th className="py-3.5 px-4 text-right">Current Rent</th>
                <th className="py-3.5 px-4">Expiry Date</th>
                <th className="py-3.5 px-4">Urgency</th>
                <th className="py-3.5 px-4">Renewal Status</th>
                <th className="py-3.5 px-4 md:px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredLeases.map((lease) => {
                const propName = lease.units?.properties?.name || 'Property'
                const unitNum = lease.units?.unit_number || 'N/A'
                const tenantName = lease.tenants
                  ? `${lease.tenants.first_name} ${lease.tenants.last_name}`
                  : 'Valued Tenant'
                const daysLeft = getDaysRemaining(lease.end_date)
                const rentVal = Number(lease.units?.base_rent || 0)

                return (
                  <tr
                    key={lease.id}
                    className="hover:bg-slate-50/80 transition group"
                  >
                    {/* Property & Unit */}
                    <td className="py-4 px-4 md:px-6">
                      <div className="font-bold text-slate-900 text-sm">{propName}</div>
                      <div className="text-slate-500 text-xs mt-0.5">
                        Unit <span className="font-semibold text-slate-700">#{unitNum}</span>
                      </div>
                    </td>

                    {/* Tenant Details */}
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-800">{tenantName}</div>
                      <div className="text-slate-500 text-xs">
                        {lease.tenants?.phone ? (
                          <span className="font-mono">{lease.tenants.phone}</span>
                        ) : (
                          <span>{lease.tenants?.email || 'No phone'}</span>
                        )}
                      </div>
                    </td>

                    {/* Current Rent */}
                    <td className="py-4 px-4 text-right">
                      <span className="font-bold text-slate-900 tabular-nums">
                        KES {rentVal.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-normal">
                        /month
                      </span>
                    </td>

                    {/* Expiry Date */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-800">
                        {lease.end_date
                          ? new Date(lease.end_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : '—'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Started {new Date(lease.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </div>
                    </td>

                    {/* Urgency Countdown Badge */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      {renderCountdownBadge(daysLeft)}
                    </td>

                    {/* Renewal Status Pill */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      {renderStatusPill(lease.renewal_status)}
                    </td>

                    {/* Action Button */}
                    <td className="py-4 px-4 md:px-6 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleOpenRenewal(lease)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-900 hover:text-white border border-slate-300 hover:border-slate-900 px-3.5 py-1.5 rounded-xl shadow-sm transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span>Manage Renewal</span>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* RENEWAL MANAGEMENT MODAL */}
      <RenewalModal
        lease={selectedLease}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />

    </section>
  )
}

