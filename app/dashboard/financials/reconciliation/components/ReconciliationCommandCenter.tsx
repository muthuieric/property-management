'use client'

import React, { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { verifyPendingPayments, verifyTransaction } from '@/app/dashboard/financials/actions'

export interface PropertyOption {
  id: string
  name: string
}

export interface ReconciliationTransaction {
  id: string
  receipt_id?: string
  property_id: string | null
  unit_id: string | null
  tenant_id: string | null
  transaction_type: string
  amount: number
  transaction_date: string
  description: string
  status: 'pending' | 'verified' | 'bounced' | null
  payment_method: string | null
  external_reference: string | null
  created_at: string
  properties?: { id: string; name: string } | null
  units?: { id: string; unit_number: string } | null
  tenants?: {
    id: string
    first_name: string | null
    last_name: string | null
    phone_number: string | null
    email: string | null
  } | null
}

interface ReconciliationCommandCenterProps {
  properties: PropertyOption[]
  transactions: ReconciliationTransaction[]
  initialPropertyId?: string
}

export default function ReconciliationCommandCenter({
  properties = [],
  transactions = [],
  initialPropertyId = '',
}: ReconciliationCommandCenterProps) {
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending')
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(initialPropertyId)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [isPending, startTransition] = useTransition()
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  // Filter transactions by selected property and search query
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (selectedPropertyId && tx.property_id !== selectedPropertyId) {
        return false
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const tenantName = `${tx.tenants?.first_name || ''} ${tx.tenants?.last_name || ''}`.toLowerCase()
        const unitNum = (tx.units?.unit_number || '').toLowerCase()
        const refCode = (tx.external_reference || '').toLowerCase()
        const desc = (tx.description || '').toLowerCase()
        const propName = (tx.properties?.name || '').toLowerCase()

        const matches =
          tenantName.includes(query) ||
          unitNum.includes(query) ||
          refCode.includes(query) ||
          desc.includes(query) ||
          propName.includes(query)

        if (!matches) return false
      }

      return true
    })
  }, [transactions, selectedPropertyId, searchQuery])

  // Split into pending vs verified lists
  const pendingTransactions = useMemo(() => {
    return filteredTransactions.filter((tx) => tx.status === 'pending')
  }, [filteredTransactions])

  const verifiedTransactions = useMemo(() => {
    return filteredTransactions.filter((tx) => tx.status === 'verified' || tx.status === null)
  }, [filteredTransactions])

  // Selected records aggregate calculation
  const selectedSum = useMemo(() => {
    let sum = 0
    pendingTransactions.forEach((tx) => {
      if (selectedIds.has(tx.id)) {
        sum += Number(tx.amount || 0)
      }
    })
    return sum
  }, [pendingTransactions, selectedIds])

  // Selection handlers
  const handleToggleRow = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  const handleSelectAllPending = () => {
    if (selectedIds.size === pendingTransactions.length && pendingTransactions.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pendingTransactions.map((t) => t.id)))
    }
  }

  const handleDeselectAll = () => {
    setSelectedIds(new Set())
  }

  // Mass-verify selected payments
  const handleVerifySelected = () => {
    if (selectedIds.size === 0) return

    setActionFeedback(null)
    const idsToVerify = Array.from(selectedIds)

    startTransition(async () => {
      try {
        const res = await verifyPendingPayments(idsToVerify)
        if (res.success) {
          setActionFeedback({
            type: 'success',
            message: `Successfully verified ${res.verifiedCount} payment${
              res.verifiedCount === 1 ? '' : 's'
            }.${
              res.settledInvoicesCount > 0
                ? ` Settled ${res.settledInvoicesCount} open tenant invoice${
                    res.settledInvoicesCount === 1 ? '' : 's'
                  }.`
                : ''
            }`,
          })
          setSelectedIds(new Set())
          router.refresh()
        } else {
          setActionFeedback({
            type: 'error',
            message: res.error || 'Failed to verify selected payments.',
          })
        }
      } catch (err: any) {
        console.error('Error verifying payments:', err)
        setActionFeedback({
          type: 'error',
          message: err?.message || 'Server error occurred while verifying payments.',
        })
      }
    })
  }

  // Single row verify handler
  const handleVerifySingle = (id: string) => {
    setActionFeedback(null)
    startTransition(async () => {
      try {
        const res = await verifyTransaction(id)
        if (res.success) {
          setActionFeedback({
            type: 'success',
            message: 'Payment verified and tenant ledger reconciled.',
          })
          const next = new Set(selectedIds)
          next.delete(id)
          setSelectedIds(next)
          router.refresh()
        } else {
          setActionFeedback({
            type: 'error',
            message: res.error || 'Failed to verify transaction.',
          })
        }
      } catch (err: any) {
        setActionFeedback({
          type: 'error',
          message: err?.message || 'Error verifying transaction.',
        })
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Feedback Banner */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-2xl text-xs font-medium border flex items-center justify-between shadow-xs transition-all ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-rose-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            <span>{actionFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold ml-2"
          >
            &times;
          </button>
        </div>
      )}

      {/* FILTER CONTROLS & TABS ROW */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Main Tabs Navigation */}
          <div className="flex items-center p-1 bg-slate-100/80 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => {
                setActiveTab('pending')
                setSelectedIds(new Set())
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer ${
                activeTab === 'pending'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>Pending Reconciliation</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === 'pending'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {pendingTransactions.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('all')
                setSelectedIds(new Set())
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>All Historical Payments</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === 'all'
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {verifiedTransactions.length}
              </span>
            </button>
          </div>

          {/* Estate Dropdown & Search Filter */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Property Filter Dropdown */}
            <div className="w-full sm:w-60">
              <label htmlFor="estateFilter" className="sr-only">
                Filter by Estate
              </label>
              <select
                id="estateFilter"
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              >
                <option value="">-- All Estates &amp; Properties --</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search unit, tenant, ref code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3 top-2.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          TAB 1: PENDING PAYMENTS (WITH MULTI-SELECT & STICKY ACTION BAR)
          ===================================================================== */}
      {activeTab === 'pending' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {pendingTransactions.length === 0 ? (
            <div className="py-16 px-4 text-center">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-emerald-200 shadow-xs">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-slate-900">All Payments Reconciled!</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                There are no pending unverified transactions for the selected scope. Bulk-uploaded payments will appear here for verification.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={
                          selectedIds.size === pendingTransactions.length && pendingTransactions.length > 0
                        }
                        onChange={handleSelectAllPending}
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                        title="Select All Pending"
                      />
                    </th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Unit &amp; Property</th>
                    <th className="py-3 px-3">Resident / Tenant</th>
                    <th className="py-3 px-3 text-center">Channel</th>
                    <th className="py-3 px-3">Reference Code</th>
                    <th className="py-3 px-3 text-right">Amount (KES)</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingTransactions.map((tx) => {
                    const isSelected = selectedIds.has(tx.id)
                    const tenantName = tx.tenants
                      ? `${tx.tenants.first_name || ''} ${tx.tenants.last_name || ''}`.trim() || 'Resident'
                      : 'Unassigned Occupant'
                    const unitNumber = tx.units?.unit_number || 'N/A'
                    const propertyName = tx.properties?.name || 'Property Site'

                    return (
                      <tr
                        key={tx.id}
                        className={`transition-colors ${
                          isSelected ? 'bg-emerald-50/40' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleRow(tx.id)}
                            className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                          {new Date(tx.transaction_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900">Unit #{unitNumber}</p>
                          <p className="text-[11px] text-slate-500">{propertyName}</p>
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-800">{tenantName}</p>
                          {tx.tenants?.phone_number && (
                            <p className="text-[11px] text-slate-500">{tx.tenants.phone_number}</p>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {tx.payment_method || 'MPESA'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-700 text-[11px]">
                          {tx.external_reference ? (
                            <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200 font-semibold">
                              {tx.external_reference}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">No Ref</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                          KES {Number(tx.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse mr-1" />
                            Pending
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleVerifySingle(tx.id)}
                            disabled={isPending}
                            className="px-3 py-1 bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 hover:text-amber-950 font-semibold rounded-lg text-xs transition-colors cursor-pointer shadow-2xs"
                          >
                            Verify
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2: ALL HISTORICAL VERIFIED PAYMENTS (READ-ONLY LEDGER)
          ===================================================================== */}
      {activeTab === 'all' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {verifiedTransactions.length === 0 ? (
            <div className="py-16 px-4 text-center text-xs text-slate-400 italic">
              No historical payments found for the selected estate or query.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-3">Unit &amp; Estate</th>
                    <th className="py-3 px-3">Resident</th>
                    <th className="py-3 px-3 text-center">Channel</th>
                    <th className="py-3 px-3">Reference</th>
                    <th className="py-3 px-3 text-right">Amount (KES)</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {verifiedTransactions.map((tx) => {
                    const tenantName = tx.tenants
                      ? `${tx.tenants.first_name || ''} ${tx.tenants.last_name || ''}`.trim() || 'Resident'
                      : 'Resident'
                    const unitNumber = tx.units?.unit_number || 'N/A'
                    const propertyName = tx.properties?.name || 'Property Site'

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {new Date(tx.transaction_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900">Unit #{unitNumber}</p>
                          <p className="text-[11px] text-slate-500">{propertyName}</p>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800">
                          {tenantName}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {tx.payment_method || 'MPESA'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-700 text-[11px]">
                          {tx.external_reference ? (
                            <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                              {tx.external_reference}
                            </span>
                          ) : (
                            <span className="text-slate-400">&mdash;</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                          KES {Number(tx.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Verified
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <Link
                            href={`/portal/receipts/${tx.receipt_id || tx.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>Receipt</span>
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          STICKY BOTTOM ACTION BAR (WHEN ROWS ARE SELECTED IN PENDING TAB)
          ===================================================================== */}
      {selectedIds.size > 0 && activeTab === 'pending' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-2xl shadow-2xl px-6 py-3.5 border border-slate-800 flex items-center gap-6 animate-in slide-in-from-bottom-4 duration-200">
          <div>
            <span className="text-xs font-bold text-white block">
              {selectedIds.size} payment{selectedIds.size === 1 ? '' : 's'} selected
            </span>
            <span className="text-[11px] text-emerald-400 font-mono font-semibold">
              Total: KES {selectedSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="h-6 w-px bg-slate-700" />

          <button
            type="button"
            onClick={handleDeselectAll}
            className="text-xs text-slate-400 hover:text-white font-medium transition-colors cursor-pointer"
          >
            Deselect All
          </button>

          <button
            type="button"
            onClick={handleVerifySelected}
            disabled={isPending}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-xs font-bold shadow-sm transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            {isPending ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Verifying &amp; Reconciling...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Verify Selected Payments</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

