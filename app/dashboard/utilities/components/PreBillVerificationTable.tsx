'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { approveUtilityPreBills, UtilityReadingItem } from '../actions'

interface PreBillVerificationTableProps {
  draftReadings: UtilityReadingItem[]
}

export default function PreBillVerificationTable({
  draftReadings = [],
}: PreBillVerificationTableProps) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const allDraftIds = draftReadings.map((r) => r.id)
  const isAllSelected =
    draftReadings.length > 0 && draftReadings.every((r) => selectedIds.has(r.id))
  const hasSomeSelected = selectedIds.size > 0

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(allDraftIds))
    }
  }

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  const handleApprove = (strategy: 'bill_now' | 'bundle') => {
    if (selectedIds.size === 0) return

    setFeedback(null)
    const idsArray = Array.from(selectedIds)

    startTransition(async () => {
      try {
        const res = await approveUtilityPreBills(idsArray, strategy)
        if (res.success) {
          const actionText =
            strategy === 'bill_now'
              ? `Generated ${res.count} standalone invoices in the ledger!`
              : `Marked ${res.count} readings to bundle into next month's rent invoices!`

          setFeedback({
            type: 'success',
            message: actionText,
          })
          setSelectedIds(new Set())
          router.refresh()
        } else {
          setFeedback({
            type: 'error',
            message: res.error || 'Failed to process pre-bills.',
          })
        }
      } catch (err: unknown) {
        setFeedback({
          type: 'error',
          message: err instanceof Error ? err.message : 'Unexpected server error.',
        })
      }
    })
  }

  // Selected financial aggregates
  const selectedReadings = draftReadings.filter((r) => selectedIds.has(r.id))
  const selectedTotalCharge = selectedReadings.reduce((sum, r) => sum + r.total_charge, 0)
  const selectedTotalConsumption = selectedReadings.reduce((sum, r) => sum + r.consumption, 0)

  return (
    <div className="relative space-y-4">
      {/* Toast Notification */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-bold">{feedback.type === 'success' ? '✓' : '!'}</span>
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-semibold hover:opacity-75"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Draft Table Header & Counter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">Pre-Bill Verification (Staged Drafts)</h3>
            <span className="text-[11px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
              {draftReadings.length} Pending
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit meter readings before financial commitment. Choose standalone invoicing or bundled rent billing.
          </p>
        </div>

        {draftReadings.length > 0 && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs"
            >
              {isAllSelected ? 'Deselect All' : 'Select All Drafts'}
            </button>
          </div>
        )}
      </div>

      {draftReadings.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl">
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-xs font-bold text-slate-800">All Caught Up</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            There are no staged draft meter readings waiting for verification.
          </p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 uppercase text-[10px] font-semibold text-slate-500 tracking-wider">
                  <th className="py-3 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                      aria-label="Select all rows"
                    />
                  </th>
                  <th className="py-3 px-4">Unit</th>
                  <th className="py-3 px-4">Site</th>
                  <th className="py-3 px-4 text-right">Previous</th>
                  <th className="py-3 px-4 text-right">Current</th>
                  <th className="py-3 px-4 text-right">Consumption</th>
                  <th className="py-3 px-4 text-right">Total Charge</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {draftReadings.map((reading) => {
                  const isChecked = selectedIds.has(reading.id)
                  return (
                    <tr
                      key={reading.id}
                      onClick={() => toggleSelectRow(reading.id)}
                      className={`cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-amber-50/70 hover:bg-amber-50'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td
                        className="py-2.5 px-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectRow(reading.id)}
                          className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">
                        {reading.unit_number}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 font-medium">
                        {reading.property_name}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-500 tabular-nums">
                        {reading.previous_reading.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-800 tabular-nums">
                        {reading.current_reading.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-blue-700 tabular-nums">
                        {reading.consumption.toFixed(2)} m³
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                        KES {reading.total_charge.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Draft
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sticky Bottom Action Bar when items are selected */}
      {hasSomeSelected && (
        <div className="sticky bottom-4 z-40 animate-in slide-in-from-bottom-3 duration-200">
          <div className="p-3.5 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs">
                {selectedIds.size}
              </span>
              <div>
                <p className="text-xs font-bold text-white">
                  {selectedIds.size} {selectedIds.size === 1 ? 'Reading' : 'Readings'} Selected
                </p>
                <p className="text-[11px] text-slate-300">
                  Volume: <span className="text-blue-300 font-semibold">{selectedTotalConsumption.toFixed(1)} m³</span> &bull; Total:{' '}
                  <span className="text-emerald-300 font-semibold">
                    KES {selectedTotalCharge.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                disabled={isPending}
                className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleApprove('bundle')}
                disabled={isPending}
                className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
                title="Attaches this water bill as an automated line item on the tenant's upcoming monthly rent invoice"
              >
                {isPending ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Add to Next Month's Rent (Bundle)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleApprove('bill_now')}
                disabled={isPending}
                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
                title="Generates immediate standalone invoice entries in the financial ledger"
              >
                {isPending ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Bill Now (Standalone Invoice)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

