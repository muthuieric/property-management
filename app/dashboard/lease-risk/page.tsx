'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  VirtualizedDataTable,
  type TableDensity,
} from '@/app/components/data-table/virtualized-data-table'
import {
  createColumnHelper,
} from '@tanstack/react-table'
import { useDashboardStore } from '@/app/lib/store/dashboard-store'
import { cn } from '@/lib/utils'
import { getLeaseRiskDashboard, type LeaseRiskRow } from './actions'

const columnHelper = createColumnHelper<LeaseRiskRow>()

const COLUMNS: any[] = [
  columnHelper.accessor('tenantName', {
    header: 'Tenant',
    meta: { width: '200px' },
  }),
  columnHelper.accessor('unitNumber', {
    header: 'Unit',
    meta: { width: '120px' },
  }),
  columnHelper.accessor('propertyName', {
    header: 'Property',
    meta: { width: '180px' },
  }),
  columnHelper.accessor('endDate', {
    header: 'Expiry Date',
    meta: { width: '120px' },
    cell: (info) => {
      const value = info.getValue() as string | null
      return value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
    },
  }),
  columnHelper.accessor('monthsUntilExpiry', {
    header: 'Months Left',
    meta: { width: '100px', alignRight: true },
    cell: (info) => {
      const value = info.getValue() as number
      return `${value} months`
    },
  }),
  columnHelper.accessor('annualValue', {
    header: 'Annual Value (KES)',
    meta: { width: '140px', alignRight: true },
    cell: (info) => {
      const value = info.getValue() as number
      return value.toLocaleString(undefined, { minimumFractionDigits: 2 })
    },
  }),
  columnHelper.accessor('riskLevel', {
    header: 'Risk',
    meta: { width: '100px' },
    cell: (info) => {
      const value = info.getValue() as string
      const colors: Record<string, string> = {
        critical: 'bg-red-100 text-red-800',
        high: 'bg-orange-100 text-orange-800',
        medium: 'bg-amber-100 text-amber-800',
        low: 'bg-green-100 text-green-800',
      }
      return (
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${colors[value] ?? colors.low}`}>
          {value}
        </span>
      )
    },
  }),
  columnHelper.accessor('leaseId', {
    header: 'Action',
    meta: { width: '100px' },
    cell: (info) => {
      const row = info.row.original as LeaseRiskRow
      return (
        <Link
          href={`/dashboard/leases/${row.leaseId}`}
          className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-800 underline underline-offset-4"
        >
          Manage
        </Link>
      )
    },
  }),
]

export default function LeaseRiskPage() {
  const [data, setData] = useState<LeaseRiskRow[]>([])
  const [summary, setSummary] = useState<{
    totalAtRisk: number
    totalAnnualValue: number
    criticalCount: number
    highCount: number
    december2026Cluster: LeaseRiskRow[]
  } | null>(null)
  const [loading, setLoading] = useState(false)

  const density = useDashboardStore((s) => s.density)
  const columnVisibility = useDashboardStore((s) => s.columnVisibility)

  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(25)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const result = await getLeaseRiskDashboard()
        setData(result.upcomingExpiries)
        setSummary({
          totalAtRisk: result.totalAtRisk,
          totalAnnualValue: result.totalAnnualValue,
          criticalCount: result.criticalCount,
          highCount: result.highCount,
          december2026Cluster: result.december2026Cluster,
        })
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const from = Math.min(pageIndex * pageSize + 1, data.length)
  const to = Math.min((pageIndex + 1) * pageSize, data.length)
  const visibleRows = data.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)

  const handlePagination = ({ pageIndex: nextIndex, pageSize: nextSize }: { pageIndex: number; pageSize: number }) => {
    setPageIndex(nextIndex)
    setPageSize(nextSize)
  }

  const decClusterCount = summary?.december2026Cluster.length ?? 0
  const decClusterValue = summary?.december2026Cluster.reduce((sum, r) => sum + r.annualValue, 0) ?? 0

  return (
    <div className="p-4 sm:p-8 max-w-[1400px] mx-auto space-y-6 text-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-900 text-white shadow-xs">
            Risk Dashboard
          </span>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 font-sans mt-1">
            Lease Expiry Risk Monitor
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Automated alerts for leases expiring in 12–18 months. December 2026 cluster flagged for priority renewal.
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

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Leases At Risk
          </div>
          <div className="text-3xl font-black text-slate-900 mt-1">
            {summary?.totalAtRisk ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Expiring within 18 months
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Critical (≤12 months)
          </div>
          <div className="text-3xl font-black text-red-600 mt-1">
            {summary?.criticalCount ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            High-value renewals due
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            High (13–18 months)
          </div>
          <div className="text-3xl font-black text-orange-600 mt-1">
            {summary?.highCount ?? 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Schedule renewal talks
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Dec 2026 Cluster
          </div>
          <div className="text-3xl font-black text-emerald-900 mt-1">
            {decClusterCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            KES {decClusterValue.toLocaleString()} annual value
          </div>
        </div>
      </div>

      {/* TOTAL VALUE BANNER */}
      {summary && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <span className="text-emerald-700 font-semibold">💰</span>
            <div>
              <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
                Total Annual Value at Risk
              </div>
              <div className="text-lg font-black text-emerald-900">
                KES {summary.totalAnnualValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DECEMBER 2026 CLUSTER ALERT */}
      {summary && summary.december2026Cluster.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-red-700 font-semibold">⚠️</span>
            <div>
              <div className="text-[11px] font-bold text-red-700 uppercase tracking-wider">
                December 2026 Expiry Cluster Detected
              </div>
              <div className="text-sm text-red-900 font-semibold mt-0.5">
                {summary.december2026Cluster.length} leases expiring in December 2026
              </div>
              <div className="text-xs text-red-700 mt-1">
                {summary.december2026Cluster.map((r) => r.tenantName).join(', ')}
              </div>
              <div className="text-xs text-red-700 mt-1">
                Combined annual value: KES {summary.december2026Cluster.reduce((s, r) => s + r.annualValue, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EXPIRY TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500">Upcoming Expiries</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
              {data.length} lease{data.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            Showing {from} to {to} of {data.length}
          </div>
        </div>
        <VirtualizedDataTable<LeaseRiskRow>
          columns={COLUMNS}
          data={visibleRows}
          totalCount={data.length}
          pageIndex={pageIndex}
          pageSize={pageSize}
          density={density}
          columnVisibility={columnVisibility}
          loading={loading}
          onPaginationChange={handlePagination}
        />
        {data.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-xs text-slate-500">
              No leases expiring within the next 18 months.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
