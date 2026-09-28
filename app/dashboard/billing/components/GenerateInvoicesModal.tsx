'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import SlideOverDrawer from '@/app/dashboard/components/SlideOverDrawer'
import { generateMonthlyInvoices, GenerateInvoicesResult } from '../actions'

interface PropertyOption {
  id: string
  name: string
}

interface GenerateInvoicesModalProps {
  isOpen: boolean
  onClose: () => void
  properties: PropertyOption[]
  defaultPropertyId?: string
}

export default function GenerateInvoicesModal({
  isOpen,
  onClose,
  properties = [],
  defaultPropertyId = 'ALL',
}: GenerateInvoicesModalProps) {
  const router = useRouter()
  const today = new Date()
  const defaultMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  const [selectedMonth, setSelectedMonth] = useState(defaultMonthStr)
  const [selectedPropertyId, setSelectedPropertyId] = useState(defaultPropertyId)
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<GenerateInvoicesResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleRun = () => {
    setErrorMessage(null)
    setResult(null)

    if (!selectedMonth) {
      setErrorMessage('Please select a target billing month.')
      return
    }

    startTransition(async () => {
      try {
        const res = await generateMonthlyInvoices(
          selectedPropertyId || 'ALL',
          `${selectedMonth}-01`
        )

        setResult(res)

        if (res.success) {
          setTimeout(() => {
            onClose()
            router.refresh()
          }, 1500)
        } else {
          setErrorMessage(res.error || 'Failed to generate monthly invoices.')
        }
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error ? err.message : 'An unexpected error occurred during billing run.'
        )
      }
    })
  }

  const selectedPropertyName =
    selectedPropertyId === 'ALL'
      ? 'All Portfolio Sites'
      : properties.find((p) => p.id === selectedPropertyId)?.name || 'Selected Property'

  const formattedTargetMonth = selectedMonth
    ? new Date(`${selectedMonth}-01`).toLocaleString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : 'Selected Month'

  return (
    <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Global Monthly Invoice Generator ('Bill All')"
      subtitle="Draft monthly invoices for all active leases, combining base rent and any bundled utility readings."
      maxWidth="max-w-lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleRun}
            disabled={isPending || !selectedMonth}
            className="px-5 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {isPending ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Drafting Invoices...</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Generate {formattedTargetMonth} Invoices</span>
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="space-y-5 text-slate-900">
        {/* Error Feedback */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
            <span className="font-bold text-red-500">!</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success Feedback */}
        {result && result.success && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1 animate-in fade-in">
            <div className="flex items-center gap-2 font-bold text-emerald-800">
              <span>✓</span>
              <span>Billing Run Complete</span>
            </div>
            <p>
              Successfully created <strong>{result.count}</strong> invoices totalling{' '}
              <strong>KES {result.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>.
            </p>
            {result.skippedCount != null && result.skippedCount > 0 && (
              <p className="text-[11px] text-emerald-700">
                {result.skippedCount} leases were already invoiced for this month and protected from duplication.
              </p>
            )}
          </div>
        )}

        {/* Configuration Controls */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Billing Month &amp; Year <span className="text-red-500">*</span>
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all font-medium"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Invoices will be dated to the 1st of {formattedTargetMonth}.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Target Property Scope
            </label>
            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
            >
              <option value="ALL">All Portfolio Sites (Global Billing Run)</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Target: <strong>{selectedPropertyName}</strong>
            </p>
          </div>
        </div>

        {/* Operational Mechanics Card */}
        <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-xl space-y-2 text-xs text-blue-900">
          <div className="font-bold flex items-center gap-1.5 text-blue-950">
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>How Enterprise Automated Invoicing Works</span>
          </div>
          <ul className="list-disc pl-4 space-y-1 text-[11px] text-blue-800">
            <li>
              <strong>Active Leases:</strong> The engine queries every tenant lease marked active in the selected property.
            </li>
            <li>
              <strong>Bundled Utility Consolidation:</strong> Any water meter readings staged as <em>bundled</em> for the tenant's unit are automatically aggregated into the invoice's utility line item.
            </li>
            <li>
              <strong>Utility Status Transition:</strong> Those utility readings are immediately promoted to <em>invoiced</em>, preventing double-billing.
            </li>
            <li>
              <strong>Idempotent Protection:</strong> If an invoice already exists for a lease in {formattedTargetMonth}, it is safely skipped.
            </li>
          </ul>
        </div>
      </div>
    </SlideOverDrawer>
  )
}

