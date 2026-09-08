// app/dashboard/components/RenewalModal.tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { updateLeaseRenewal, markLeaseForVacancy } from '../renewals/actions'

export type LeaseForRenewal = {
  id: string
  start_date: string
  end_date: string | null
  deposit_amount: number | string
  renewal_status?: string | null
  is_active: boolean
  unit_id: string
  tenant_id: string
  units?: {
    id: string
    unit_number: string
    base_rent: number | string
    property_id?: string
    properties?: {
      id?: string
      name: string
      location?: string
    }
  }
  tenants?: {
    id?: string
    first_name: string
    last_name: string
    email?: string
    phone?: string
  }
}

interface RenewalModalProps {
  lease: LeaseForRenewal | null
  isOpen: boolean
  onClose: () => void
}

export default function RenewalModal({ lease, isOpen, onClose }: RenewalModalProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Tab state: 'parameters' | 'agreement'
  const [activeTab, setActiveTab] = useState<'parameters' | 'agreement'>('parameters')

  // Calculate default 1-year extension date
  const getDefaultEndDate = (currentEndDate: string | null | undefined) => {
    const base = currentEndDate ? new Date(currentEndDate) : new Date()
    const nextYear = new Date(base)
    nextYear.setFullYear(nextYear.getFullYear() + 1)
    return nextYear.toISOString().split('T')[0]
  }

  const currentRent = Number(lease?.units?.base_rent || 0)
  const [proposedRent, setProposedRent] = useState<number>(currentRent)
  const [newEndDate, setNewEndDate] = useState<string>(
    getDefaultEndDate(lease?.end_date)
  )
  const [renewalStatus, setRenewalStatus] = useState<'pending_renewal' | 'renewed'>(
    (lease?.renewal_status === 'renewed' ? 'renewed' : 'pending_renewal')
  )

  // Vacancy flow state
  const [showVacancyConfirm, setShowVacancyConfirm] = useState(false)
  const [vacateDate, setVacateDate] = useState(
    lease?.end_date || new Date().toISOString().split('T')[0]
  )
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [vacancyDone, setVacancyDone] = useState(false)

  if (!isOpen || !lease) return null

  const tenantName = lease.tenants
    ? `${lease.tenants.first_name} ${lease.tenants.last_name}`
    : 'Valued Tenant'
  const propertyName = lease.units?.properties?.name || 'Property Site'
  const propertyLocation = lease.units?.properties?.location || 'Nairobi, Kenya'
  const unitNumber = lease.units?.unit_number || 'N/A'
  const depositAmount = Number(lease.deposit_amount || 0)

  // Extension date presets
  const applyExtensionPreset = (months: number) => {
    const base = lease.end_date ? new Date(lease.end_date) : new Date()
    const target = new Date(base)
    target.setMonth(target.getMonth() + months)
    setNewEndDate(target.toISOString().split('T')[0])
  }

  // Calculate rent delta
  const rentDelta = proposedRent - currentRent
  const rentPercentage = currentRent > 0 ? ((rentDelta / currentRent) * 100).toFixed(1) : '0'

  // Submit Renewal Update
  const handleSaveRenewal = () => {
    setStatusMessage(null)
    startTransition(async () => {
      const res = await updateLeaseRenewal({
        leaseId: lease.id,
        unitId: lease.unit_id || lease.units?.id || '',
        proposedRent: Number(proposedRent),
        newEndDate,
        renewalStatus,
      })

      if (res.success) {
        setStatusMessage({ type: 'success', text: res.message || 'Renewal updated successfully.' })
        router.refresh()
        setTimeout(() => {
          onClose()
        }, 1200)
      } else {
        setStatusMessage({ type: 'error', text: res.error || 'Failed to update renewal.' })
      }
    })
  }

  // Submit Notice to Vacate
  const handleMarkVacancy = () => {
    setStatusMessage(null)
    startTransition(async () => {
      const res = await markLeaseForVacancy({
        leaseId: lease.id,
        unitId: lease.unit_id || lease.units?.id || '',
        vacateDate,
      })

      if (res.success) {
        setStatusMessage({ type: 'success', text: res.message || 'Marked for vacancy.' })
        setVacancyDone(true)
        router.refresh()
      } else {
        setStatusMessage({ type: 'error', text: res.error || 'Failed to mark for vacancy.' })
      }
    })
  }

  const todayStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <>
      {/* Inject print-specific styling so only the legal agreement is printed */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-agreement,
          #printable-agreement * {
            visibility: visible;
          }
          #printable-agreement {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: #0f172a !important;
            padding: 32px !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      {/* Modal Backdrop */}
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
        <div className="relative bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
          
          {/* MODAL HEADER */}
          <div className="p-5 md:p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-700">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                  Lease Renewal Suite
                </span>
                <span className="text-xs text-slate-400">
                  Unit #{unitNumber} &bull; {propertyName}
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight">
                Manage Lease Renewal & Agreement
              </h2>
            </div>

            <button
              onClick={onClose}
              disabled={isPending}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Close dialog"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* TAB NAVIGATION STRIP */}
          <div className="flex items-center justify-between px-6 border-b border-slate-200 bg-slate-50">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('parameters')}
                className={`py-3 px-4 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
                  activeTab === 'parameters'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <span>Renewal Terms & Parameters</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('agreement')}
                className={`py-3 px-4 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
                  activeTab === 'agreement'
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Renewal Letter & Agreement Template</span>
              </button>
            </div>

            {activeTab === 'agreement' && (
              <button
                type="button"
                onClick={() => window.print()}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 px-3 py-1.5 rounded-lg shadow-sm transition"
              >
                <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>Print / Export Agreement</span>
              </button>
            )}
          </div>

          {/* STATUS NOTIFICATION ALERT */}
          {statusMessage && (
            <div
              className={`p-3 mx-6 mt-4 rounded-xl text-xs font-semibold flex items-center justify-between ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>{statusMessage.type === 'success' ? '✓' : '⚠️'}</span>
                <span>{statusMessage.text}</span>
              </div>
              <button
                onClick={() => setStatusMessage(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                &times;
              </button>
            </div>
          )}

          {/* MODAL BODY (SCROLLABLE) */}
          <div className="p-6 overflow-y-auto flex-1 text-slate-900">
            
            {/* TAB 1: RENEWAL PARAMETERS */}
            {activeTab === 'parameters' && (
              <div className="space-y-6">
                
                {/* Current Lease Snapshot Strip */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 uppercase tracking-wider block text-[10px] font-semibold mb-0.5">
                      Tenant
                    </span>
                    <span className="font-bold text-slate-900 text-sm">{tenantName}</span>
                    <span className="text-slate-500 block text-[11px] truncate">
                      {lease.tenants?.email || 'No email registered'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 uppercase tracking-wider block text-[10px] font-semibold mb-0.5">
                      Property & Unit
                    </span>
                    <span className="font-bold text-slate-900 text-sm">
                      Unit #{unitNumber}
                    </span>
                    <span className="text-slate-500 block text-[11px]">{propertyName}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 uppercase tracking-wider block text-[10px] font-semibold mb-0.5">
                      Current Expiry Date
                    </span>
                    <span className="font-bold text-slate-900 text-sm">
                      {lease.end_date ? new Date(lease.end_date).toLocaleDateString() : 'Periodic / Open'}
                    </span>
                    <span className="text-slate-500 block text-[11px]">
                      Started: {new Date(lease.start_date).toLocaleDateString()}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 uppercase tracking-wider block text-[10px] font-semibold mb-0.5">
                      Escrow Deposit
                    </span>
                    <span className="font-bold text-emerald-700 text-sm tabular-nums">
                      KES {depositAmount.toLocaleString()}
                    </span>
                    <span className="text-emerald-600 block text-[11px]">Held in Trust</span>
                  </div>
                </div>

                {/* Form Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Proposed New Rent */}
                  <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Proposed New Base Rent (KES)
                        </label>
                        <span className="text-[11px] text-slate-500">
                          Current: KES {currentRent.toLocaleString()}
                        </span>
                      </div>

                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-sm font-bold text-slate-400">
                          KES
                        </span>
                        <input
                          type="number"
                          value={proposedRent}
                          onChange={(e) => setProposedRent(Number(e.target.value))}
                          className="w-full pl-14 pr-4 py-2 text-lg font-extrabold text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-none tabular-nums"
                          placeholder="e.g. 50000"
                        />
                      </div>

                      {/* Delta Indicator */}
                      <div className="mt-3 flex items-center gap-2 text-xs font-semibold">
                        {rentDelta > 0 && (
                          <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                            +{rentDelta.toLocaleString()} KES (+{rentPercentage}%) increase
                          </span>
                        )}
                        {rentDelta < 0 && (
                          <span className="text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                            {rentDelta.toLocaleString()} KES ({rentPercentage}%) reduction
                          </span>
                        )}
                        {rentDelta === 0 && (
                          <span className="text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                            No price change (Fixed rent)
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-4">
                      Updating this will reflect in the official lease renewal agreement and unit ledger upon execution.
                    </p>
                  </div>

                  {/* New End Date & Extension Presets */}
                  <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          New End Date (Extension)
                        </label>
                        <span className="text-[11px] text-slate-500">
                          Target Expiry
                        </span>
                      </div>

                      <input
                        type="date"
                        value={newEndDate}
                        onChange={(e) => setNewEndDate(e.target.value)}
                        className="w-full px-4 py-2 text-sm font-semibold text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-none"
                      />

                      {/* Quick Extension Buttons */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => applyExtensionPreset(6)}
                          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-2.5 py-1 rounded-md transition"
                        >
                          +6 Months
                        </button>
                        <button
                          type="button"
                          onClick={() => applyExtensionPreset(12)}
                          className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold px-2.5 py-1 rounded-md transition"
                        >
                          +1 Year (Recommended)
                        </button>
                        <button
                          type="button"
                          onClick={() => applyExtensionPreset(24)}
                          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-2.5 py-1 rounded-md transition"
                        >
                          +2 Years
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-4">
                      Standard residential tenancy renewals extend by 12 calendar months.
                    </p>
                  </div>

                </div>

                {/* Workflow Renewal Status Selector */}
                <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-3">
                    Update Renewal Workflow Status
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label
                      className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                        renewalStatus === 'pending_renewal'
                          ? 'bg-amber-50/70 border-amber-300 text-amber-950'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="renewal_status"
                        value="pending_renewal"
                        checked={renewalStatus === 'pending_renewal'}
                        onChange={() => setRenewalStatus('pending_renewal')}
                        className="mt-1 text-amber-600 focus:ring-amber-500"
                      />
                      <div>
                        <span className="font-bold text-sm block">Pending Renewal (Offer Issued)</span>
                        <span className="text-xs text-slate-500 block mt-0.5">
                          Notice/Offer sent to tenant. Awaiting tenant agreement & signature.
                        </span>
                      </div>
                    </label>

                    <label
                      className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                        renewalStatus === 'renewed'
                          ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="renewal_status"
                        value="renewed"
                        checked={renewalStatus === 'renewed'}
                        onChange={() => setRenewalStatus('renewed')}
                        className="mt-1 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div>
                        <span className="font-bold text-sm block">Renewed (Agreement Executed)</span>
                        <span className="text-xs text-slate-500 block mt-0.5">
                          Agreement finalized. Updates active lease end date and unit rent terms.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowVacancyConfirm(!showVacancyConfirm)}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-4 py-2.5 rounded-xl transition w-full sm:w-auto"
                  >
                    Tenant Moving Out? Issue Notice to Vacate &rarr;
                  </button>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => setActiveTab('agreement')}
                      className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition"
                    >
                      Preview Agreement &rarr;
                    </button>

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={handleSaveRenewal}
                      className="px-6 py-2.5 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-sm transition flex items-center gap-2"
                    >
                      {isPending ? (
                        <>
                          <span className="animate-spin text-sm">⏳</span>
                          <span>Saving Terms...</span>
                        </>
                      ) : (
                        <span>Save Renewal Terms</span>
                      )}
                    </button>
                  </div>
                </div>

                {/* EXPANDABLE NOTICE TO VACATE / MARK VACANCY WORKFLOW */}
                {showVacancyConfirm && (
                  <div className="p-5 rounded-xl border border-rose-200 bg-rose-50/60 transition">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-rose-100 text-rose-700 rounded-lg shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>

                      <div className="flex-1">
                        <h4 className="font-bold text-rose-950 text-sm mb-1">
                          Mark for Vacancy / Issue Notice to Vacate
                        </h4>
                        <p className="text-xs text-rose-800 mb-3 leading-relaxed">
                          If the tenant has formally declined the renewal offer or given notice of departure, mark this lease as Vacating. This triggers the Move-Out & Utility Clearance procedure and alerts the leasing team of upcoming availability.
                        </p>

                        {!vacancyDone ? (
                          <div className="flex flex-col sm:flex-row items-end gap-3">
                            <div className="w-full sm:w-60">
                              <label className="text-[11px] font-semibold text-rose-900 block mb-1">
                                Scheduled Vacate Date
                              </label>
                              <input
                                type="date"
                                value={vacateDate}
                                onChange={(e) => setVacateDate(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs border border-rose-300 rounded-lg bg-white text-slate-900"
                              />
                            </div>

                            <button
                              type="button"
                              disabled={isPending}
                              onClick={handleMarkVacancy}
                              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg shadow-sm transition"
                            >
                              Confirm Notice to Vacate
                            </button>
                          </div>
                        ) : (
                          <div className="mt-2 p-3 bg-white border border-rose-300 rounded-lg flex items-center justify-between">
                            <span className="text-xs font-semibold text-rose-900">
                              ✓ Lease marked as Vacating. Ready for exit reconciliation.
                            </span>
                            <Link
                              href="/dashboard/clearance"
                              className="text-xs font-bold text-blue-600 hover:text-blue-800 underline"
                            >
                              Open Move-Out Clearance &rarr;
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* TAB 2: LIVE PREVIEW OF LEASE RENEWAL LETTER / TENANCY AGREEMENT */}
            {activeTab === 'agreement' && (
              <div className="space-y-4">
                
                {/* Print Action Bar */}
                <div className="flex items-center justify-between p-3 bg-slate-100 rounded-xl text-xs text-slate-600 border border-slate-200">
                  <span>
                    Official dynamic agreement preview ready for print, PDF export, or direct signing.
                  </span>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-1.5 rounded-lg font-semibold shadow-sm transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    <span>Print Document</span>
                  </button>
                </div>

                {/* THE OFFICIAL PRINTABLE AGREEMENT DOCUMENT CONTAINER */}
                <div
                  id="printable-agreement"
                  className="bg-white p-8 md:p-12 border border-slate-300 rounded-xl shadow-md text-slate-900 font-serif leading-relaxed text-sm"
                >
                  
                  {/* Letterhead Header */}
                  <div className="border-b-2 border-slate-900 pb-6 mb-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans uppercase">
                          Residential Tenancy Agreement
                        </h1>
                        <p className="text-xs text-slate-500 font-sans mt-0.5 tracking-wider uppercase font-semibold">
                          Formal Extension & Lease Renewal Notice
                        </p>
                      </div>
                      <div className="text-right font-sans">
                        <span className="text-xs text-slate-500 block">Date of Issuance</span>
                        <span className="text-sm font-bold text-slate-900">{todayStr}</span>
                        <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                          REF: LRN-{lease.id.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Parties & Demised Premises */}
                  <div className="mb-6 grid grid-cols-2 gap-4 font-sans text-xs bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div>
                      <span className="text-slate-500 uppercase font-semibold block text-[10px] mb-0.5">
                        Landlord / Management
                      </span>
                      <p className="font-bold text-slate-900 text-sm">Property Management Agency</p>
                      <p className="text-slate-600">{propertyName}</p>
                      <p className="text-slate-500">{propertyLocation}</p>
                    </div>

                    <div>
                      <span className="text-slate-500 uppercase font-semibold block text-[10px] mb-0.5">
                        Tenant (Lessee)
                      </span>
                      <p className="font-bold text-slate-900 text-sm">{tenantName}</p>
                      <p className="text-slate-600">Unit #{unitNumber}, {propertyName}</p>
                      <p className="text-slate-500">{lease.tenants?.email || ''} &bull; {lease.tenants?.phone || ''}</p>
                    </div>
                  </div>

                  {/* Body Clauses */}
                  <div className="space-y-4 text-xs md:text-sm text-slate-800">
                    <p>
                      This Tenancy Renewal Addendum is entered into between <strong>Property Management</strong> (&ldquo;Landlord/Agent&rdquo;) and <strong>{tenantName}</strong> (&ldquo;Tenant&rdquo;) in respect of <strong>Unit #{unitNumber}</strong> at <strong>{propertyName}</strong> (&ldquo;Demised Premises&rdquo;).
                    </p>

                    <div className="space-y-3 pt-2">
                      <div className="flex items-start gap-2">
                        <strong className="font-sans shrink-0">1. Renewal Period:</strong>
                        <span>
                          The existing tenancy agreement expiring on <strong>{lease.end_date ? new Date(lease.end_date).toLocaleDateString() : 'the current period'}</strong> is hereby extended to terminate on <strong>{new Date(newEndDate).toLocaleDateString()}</strong>, subject to the terms hereof.
                        </span>
                      </div>

                      <div className="flex items-start gap-2">
                        <strong className="font-sans shrink-0">2. Revised Rental Rate:</strong>
                        <span>
                          The agreed monthly base rent for the renewed term shall be <strong className="tabular-nums font-bold text-slate-900">KES {proposedRent.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>, payable in advance on or before the 1st day of each calendar month.
                        </span>
                      </div>

                      <div className="flex items-start gap-2">
                        <strong className="font-sans shrink-0">3. Escrow Deposit Rollover:</strong>
                        <span>
                          The Tenant&apos;s security deposit of <strong className="tabular-nums font-bold text-slate-900">KES {depositAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong> held in protected escrow shall remain pledged and automatically transferred to secure this renewal period, fully refundable upon exit clearance.
                        </span>
                      </div>

                      <div className="flex items-start gap-2">
                        <strong className="font-sans shrink-0">4. Terms & Conditions:</strong>
                        <span>
                          All other covenants, maintenance obligations, utility payment requirements (water, power), and house rules contained in the original Principal Lease Agreement shall continue in full force and effect.
                        </span>
                      </div>
                    </div>

                    <p className="pt-2 text-xs text-slate-600 italic">
                      Please sign and return an executed copy of this addendum prior to the current expiry date to ensure uninterrupted possession of the premises.
                    </p>
                  </div>

                  {/* Execution / Signature Blocks */}
                  <div className="mt-12 pt-8 border-t border-slate-300 grid grid-cols-2 gap-8 font-sans">
                    <div>
                      <div className="border-b border-slate-400 pb-1 mb-2 h-10 flex items-end">
                        <span className="text-[10px] text-slate-400 font-mono italic">Authorized Management Signature</span>
                      </div>
                      <p className="font-bold text-xs text-slate-900">For: Property Management</p>
                      <p className="text-[11px] text-slate-500">Property Coordinator / Authorized Agent</p>
                      <p className="text-[10px] text-slate-400 mt-1">Date: ________________________</p>
                    </div>

                    <div>
                      <div className="border-b border-slate-400 pb-1 mb-2 h-10 flex items-end">
                        <span className="text-[10px] text-slate-400 font-mono italic">Tenant Endorsement</span>
                      </div>
                      <p className="font-bold text-xs text-slate-900">{tenantName}</p>
                      <p className="text-[11px] text-slate-500">Tenant / Lessee Signature</p>
                      <p className="text-[10px] text-slate-400 mt-1">Date: ________________________</p>
                    </div>
                  </div>

                </div>

                {/* Back to Parameters Button */}
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('parameters')}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl transition"
                  >
                    &larr; Back to Parameters & Adjustments
                  </button>
                </div>

              </div>
            )}

          </div>

          {/* MODAL FOOTER */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Tenancy Ref: <strong className="font-mono text-slate-700">{lease.id.slice(0, 8)}</strong>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-600 hover:text-slate-900 font-medium px-3 py-1 rounded-lg hover:bg-slate-200 transition"
            >
              Close
            </button>
          </div>

        </div>
      </div>
    </>
  )
}

