'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  VirtualizedDataTable,
  type TableDensity,
} from '@/app/components/data-table/virtualized-data-table'
import {
  createColumnHelper,
  type ColumnDef,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { useDashboardStore } from '@/app/lib/store/dashboard-store'
import { cn } from '@/lib/utils'
import {
  getLeaseExpiry,
  getExpiryProperties,
  type ExpiringLeaseRow,
} from './actions'

const columnHelper = createColumnHelper<ExpiringLeaseRow>()

const COLUMNS = [
  columnHelper.accessor('unitNumber', {
    header: 'Unit',
    meta: { width: '120px' },
  }),
  columnHelper.accessor('tenantName', {
    header: 'Tenant',
    meta: { width: '200px' },
  }),
  columnHelper.accessor('propertyName', {
    header: 'Property',
    meta: { width: '200px' },
  }),
  columnHelper.accessor('startDate', {
    header: 'Start Date',
    meta: { width: '130px' },
    cell: (info) => {
      const value = info.getValue() as string | null
      return value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
    },
  }),
  columnHelper.accessor('endDate', {
    header: 'End Date',
    meta: { width: '130px' },
    cell: (info) => {
      const value = info.getValue() as string | null
      return value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
    },
  }),
  columnHelper.accessor('daysRemaining', {
    header: 'Days Left',
    meta: { width: '110px', alignRight: true },
    cell: (info) => {
      const value = info.getValue() as number | null
      if (value === null) return '—'
      if (value < 0) return `Expired ${Math.abs(value)}d ago`
      return `${value} days`
    },
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    meta: { width: '130px' },
    cell: (info) => {
      const value = info.getValue() as 'expired' | 'expiring' | 'active'
      return value
    },
  }),
  columnHelper.accessor('baseRent', {
    header: 'Base Rent (KES)',
    meta: { width: '150px', alignRight: true },
    cell: (info) => {
      const value = info.getValue() as number
      return value.toLocaleString(undefined, { minimumFractionDigits: 2 })
    },
  }),
] as ColumnDef<ExpiringLeaseRow, unknown>[]

function statusBadge(status: 'expired' | 'expiring' | 'active') {
  const config = {
    expired: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', label: 'EXPIRED' },
    expiring: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', label: 'EXPIRING' },
    active: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', label: 'ACTIVE' },
  }[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase', config.bg, config.border, config.text)}>
      {config.label}
    </span>
  )
}

export default function LeaseExpiryPage() {
  const [rows, setRows] = useState<ExpiringLeaseRow[]>([])
  const [loading, setLoading] = useState(false)

  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [sorting, setSorting] = useState<{ id: string; desc: boolean }[]>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const [monthsAhead, setMonthsAhead] = useState(3)
  const [propertyId, setPropertyId] = useState<string | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<'all' | 'expired' | 'expiring'>('all')

  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([])

  const density = useDashboardStore((s) => s.density)
  const columnVisibility = useDashboardStore((s) => s.columnVisibility)
  const setDensity = useDashboardStore((s) => s.setDensity)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    ;(async () => {
      const props = await getExpiryProperties()
      setProperties(props)
    })()
  }, [])

  const runQuery = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getLeaseExpiry({
        monthsAhead,
        propertyId,
        statusFilter,
      })
      setRows(result.rows)
    } catch (err) {
      console.error(err)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [monthsAhead, propertyId, statusFilter])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(runQuery, 400)
  }, [monthsAhead, propertyId, statusFilter, runQuery])

  const expiredCount = rows.filter((r) => r.status === 'expired').length
  const expiringCount = rows.filter((r) => r.status === 'expiring').length
  const totalAtRisk = rows.reduce((sum, r) => sum + r.baseRent, 0)
  const from = Math.min(pageIndex * pageSize + 1, rows.length)
  const to = Math.min((pageIndex + 1) * pageSize, rows.length)

  const handlePagination = ({
    pageIndex: nextIndex,
    pageSize: nextSize,
  }: { pageIndex: number; pageSize: number }) => {
    setPageIndex(nextIndex)
    setPageSize(nextSize)
  }

  const handleSorting = (next: { id: string; desc: boolean }[]) => {
    setSorting(next)
  }

  const handleColumnFilters = (next: ColumnFiltersState) => {
    setColumnFilters(next)
  }

  const visibleRows = rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)

  return (
    <div className="p-4 sm:p-8 max-w-[1400px] mx-auto space-y-6 text-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-900 text-white shadow-xs">
            Lease Expiry
          </span>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 font-sans mt-1">
            Lease Expiry Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track leases approaching expiry and expired tenancies still flagged active. Alert management before tenants vacate.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={density}
            onChange={(e) => setDensity(e.target.value as TableDensity)}
            className="text-[11px] border border-slate-200 rounded px-2 py-1 bg-white focus:border-emerald-500 focus:outline-none"
          >
            <option value="compact">Compact</option>
            <option value="standard">Standard</option>
            <option value="spacious">Spacious</option>
          </select>
          <Link
            href="/dashboard/financials"
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors underline underline-offset-4"
          >
            ← Back to Financial Ledger
          </Link>
        </div>
      </div>

      {/* CONFIGURATION */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Alert Window (months ahead)
              </label>
              <select
                value={monthsAhead}
                onChange={(e) => setMonthsAhead(Number(e.target.value))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value={1}>1 month</option>
                <option value={3}>3 months</option>
                <option value={6}>6 months</option>
                <option value={12}>12 months</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Status Filter
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'expired' | 'expiring')}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="all">All statuses</option>
                <option value="expired">Expired only</option>
                <option value="expiring">Expiring only</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Property
              </label>
              <select
                value={propertyId ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  setPropertyId(v ? v : undefined)
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">All properties</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={runQuery}
            disabled={loading}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
              loading && 'cursor-wait'
            )}
          >
            {loading ? 'Computing…' : 'Refresh'}
          </button>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
          <div className="bg-red-50 border border-red-100 rounded-lg p-4">
            <div className="text-[11px] font-semibold text-red-600 uppercase tracking-wider">Expired</div>
            <div className="text-2xl font-black text-red-900 mt-1">{expiredCount}</div>
            <div className="text-[11px] text-red-600 mt-0.5">Lease end date passed</div>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
            <div className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Expiring Soon</div>
            <div className="text-2xl font-black text-amber-900 mt-1">{expiringCount}</div>
            <div className="text-[11px] text-amber-600 mt-0.5">Within {monthsAhead} month{monthsAhead === 1 ? '' : 's'}</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4">
            <div className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">At-Risk Rent</div>
            <div className="text-2xl font-black text-emerald-900 mt-1">KES {totalAtRisk.toLocaleString()}</div>
            <div className="text-[11px] text-emerald-600 mt-0.5">Base rent across expiring leases</div>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500">Expiring Leases</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
              {rows.length} lease{rows.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            Showing {from} to {to} of {rows.length}
          </div>
        </div>
        <VirtualizedDataTable<ExpiringLeaseRow>
          columns={COLUMNS}
          data={visibleRows}
          totalCount={rows.length}
          pageIndex={pageIndex}
          pageSize={pageSize}
          density={density}
          sorting={sorting}
          columnFilters={columnFilters}
          columnVisibility={columnVisibility}
          loading={loading}
          onPaginationChange={handlePagination}
          onSortingChange={handleSorting}
          onColumnFiltersChange={handleColumnFilters}
          renderCell={(props) => {
            if (props.columnId === 'status') {
              return statusBadge(props.value as 'expired' | 'expiring' | 'active')
            }
            return undefined
          }}
        />
        {rows.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-xs text-slate-500">
              No leases match the selected filters. Try widening the alert window or changing the status filter.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
