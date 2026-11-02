'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  runInterestApplication,
  fetchArrearsSummary,
} from './actions'

export default function DebtControlPage() {
  const [summary, setSummary] = useState<{
    totalArrears: number
    interestToDate: number
    overdueInvoices: number
    recentInterest: Array<{
      id: string
      tenantName: string
      unitNumber: string | null
      periodMonth: string
      interestAmount: number
      appliedAt: string
    }>
    error: string | null
  } | null>(null)
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  const [periodMonth, setPeriodMonth] = useState(
    new Date().toISOString().slice(0, 7)
  )

  useEffect(() => {
    ;(async () => {
      try {
        const data = await fetchArrearsSummary()
        setSummary(data)
      } catch (err) {
        console.error(err)
        setSummary(null)
      }
    })()
  }, [])

  const handleApply = async () => {
    setApplying(true)
    setResult(null)
    try {
      const r = await runInterestApplication({ periodMonth })
      if (r.error) {
        setResult({ kind: 'error', message: r.error })
        return
      }
      // Refresh summary
      const data = await fetchArrearsSummary()
      setSummary(data)
      setResult({
        kind: 'success',
        message: `Applied 2% interest to ${r.appliedCount} invoice(s). Total interest: KES ${r.totalInterest.toLocaleString()}`,
      })
    } catch (err: any) {
      setResult({ kind: 'error', message: err?.message ?? 'Failed to apply interest.' })
    } finally {
      setApplying(false)
    }
  }

  if (!summary) {
    return (
      <div className="p-4 sm:p-8 max-w-[1200px] mx-auto">
        <div className="p-8 text-center text-slate-500 text-xs">Loading…</div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 max-w-[1200px] mx-auto space-y-6 text-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-900 text-white shadow-xs">
            Debt Control
          </span>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 font-sans mt-1">
            Arrears & Interest
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Apply a flat 2% monthly interest penalty on outstanding arrears.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/financials"
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors underline underline-offset-4"
          >
            ← Back to Financial Ledger
          </Link>
        </div>
      </div>

      {result && (
        <div
          className={cn(
            'rounded-lg border px-4 py-3 text-xs font-medium',
            result.kind === 'success'
              ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
              : 'border-red-200 text-red-700 bg-red-50'
          )}
        >
          {result.message}
        </div>
      )}

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Arrears</div>
          <div className="text-2xl font-black text-red-900 mt-1">
            KES {summary.totalArrears.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-red-600 mt-0.5">
            {summary.overdueInvoices} overdue invoice{summary.overdueInvoices === 1 ? '' : 's'}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Interest To Date</div>
          <div className="text-2xl font-black text-amber-900 mt-1">
            KES {summary.interestToDate.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-amber-600 mt-0.5">2% flat monthly</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Next Period</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{periodMonth}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Apply interest for this month</div>
        </div>
      </div>

      {/* APPLY INTEREST */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 font-sans">Apply Monthly Interest</h2>
            <p className="text-[11px] text-slate-500 mt-1">
              Charges 2% flat interest on the outstanding balance of every unpaid invoice from previous months. Idempotent — won&apos;t double-charge the same period.
            </p>
          </div>
          <div className="flex items-end gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Period
              </label>
              <input
                type="month"
                value={periodMonth}
                onChange={(e) => setPeriodMonth(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <button
              onClick={handleApply}
              disabled={applying}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                applying
                  ? 'border-slate-200 text-slate-400 bg-slate-50 cursor-wait'
                  : 'border-transparent bg-emerald-600 text-white hover:bg-emerald-700'
              )}
            >
              {applying ? 'Applying…' : 'Apply Interest'}
            </button>
          </div>
        </div>
      </div>

      {/* RECENT INTEREST */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-3">
          <h2 className="text-lg font-bold text-slate-900 font-sans">Recent Interest Applications</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-3 font-semibold text-slate-500 uppercase tracking-wider">Tenant</th>
                <th className="px-6 py-3 font-semibold text-slate-500 uppercase tracking-wider">Unit</th>
                <th className="px-6 py-3 font-semibold text-slate-500 uppercase tracking-wider">Period</th>
                <th className="px-6 py-3 font-semibold text-slate-500 uppercase tracking-wider text-right">Interest (KES)</th>
                <th className="px-6 py-3 font-semibold text-slate-500 uppercase tracking-wider">Applied</th>
              </tr>
            </thead>
            <tbody>
              {summary.recentInterest.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 text-xs">
                    No interest applications yet.
                  </td>
                </tr>
              ) : (
                summary.recentInterest.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="px-6 py-3 text-slate-900 font-medium">{r.tenantName}</td>
                    <td className="px-6 py-3 text-slate-600">{r.unitNumber ?? '—'}</td>
                    <td className="px-6 py-3 text-slate-600">{r.periodMonth}</td>
                    <td className="px-6 py-3 text-right font-medium text-slate-900">
                      KES {r.interestAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-3 text-slate-600">
                      {new Date(r.appliedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
