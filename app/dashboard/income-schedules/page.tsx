'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  createColumnHelper,
  type ColumnDef,
} from '@tanstack/react-table'
import { type ColumnFiltersState } from '@tanstack/react-table'
import {
  VirtualizedDataTable,
  type TableDensity,
} from '@/app/components/data-table/virtualized-data-table'
import { useDashboardStore } from '@/app/lib/store/dashboard-store'
import { getIncomeSchedule, type IncomeScheduleRow } from './actions'

const columnHelper = createColumnHelper<IncomeScheduleRow>()

const COLUMNS = [
  columnHelper.accessor('transaction_date', {
    header: 'Date',
    meta: { width: '140px' },
    cell: (info) => {
      const value = info.getValue() as string | null
      if (!value) return '-'
      return new Date(value).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    },
  }),
  columnHelper.accessor('description', {
    header: 'Description',
    meta: { filterable: true, width: '260px' },
  }),
  columnHelper.accessor('property_name', {
    header: 'Property',
    meta: { width: '150px' },
  }),
  columnHelper.accessor('unit_number', {
    header: 'Unit',
    meta: { width: '100px' },
  }),
  columnHelper.accessor('tenant_name', {
    header: 'Tenant',
    meta: { width: '160px' },
  }),
  columnHelper.accessor('transaction_type', {
    header: 'Type',
    meta: { filterable: true, width: '100px' },
  }),
  columnHelper.accessor('amount', {
    header: 'Amount (KES)',
    meta: { width: '130px', alignRight: true },
    cell: (info) => {
      const value = info.getValue() as number
      return value ? value.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'
    },
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    meta: { filterable: true, width: '110px' },
  }),
  columnHelper.accessor('receipt_id', {
    header: 'Receipt ID',
    meta: { width: '150px' },
  }),
  columnHelper.accessor('payment_method', {
    header: 'Method',
    meta: { width: '110px' },
  }),
] as ColumnDef<IncomeScheduleRow, unknown>[]

export default function IncomeSchedulesPage() {
  const [rows, setRows] = useState<IncomeScheduleRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [sorting, setSorting] = useState<{ id: string; desc: boolean }[]>([
    { id: 'transaction_date', desc: true },
  ])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [filterInput, setFilterInput] = useState('')
  const [debouncedFilter, setDebouncedFilter] = useState('')

  const density = useDashboardStore((s) => s.density)
  const columnVisibility = useDashboardStore((s) => s.columnVisibility)
  const setDensity = useDashboardStore((s) => s.setDensity)
  const setPageSizeStore = useDashboardStore((s) => s.setPageSize)
  const toggleColumn = useDashboardStore((s) => s.toggleColumn)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getIncomeSchedule({
        pageIndex,
        pageSize,
        sorting,
        columnFilters,
        globalFilter: debouncedFilter,
      })
      setRows(result.rows)
      setTotalCount(result.totalCount)
    } catch (err) {
      console.error(err)
      setRows([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [pageIndex, pageSize, sorting, columnFilters, debouncedFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const onFilterChange = (value: string) => {
    setFilterInput(value)
    setPageIndex(0)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDebouncedFilter(value), 300)
  }

  const handlePagination = ({ pageIndex: nextIndex, pageSize: nextSize }: { pageIndex: number; pageSize: number }) => {
    setPageIndex(nextIndex)
    setPageSize(nextSize)
    setPageSizeStore(nextSize)
  }

  const handleSorting = (next: { id: string; desc: boolean }[]) => {
    setSorting(next)
    setPageIndex(0)
  }

  const handleColumnFilters = (next: ColumnFiltersState) => {
    setColumnFilters(next)
    setPageIndex(0)
  }

  const handleColumnVisibility = (next: Record<string, boolean>) => {
    Object.entries(next).forEach(([id, visible]) => {
      toggleColumn(id, visible)
    })
  }

  return (
    <div className="p-4 sm:p-8 max-w-[1400px] mx-auto space-y-6 text-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-900 text-white shadow-xs">
            Income Schedules
          </span>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 font-sans mt-1">
            Tenant Income Schedule
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Historical rent collections across all units. Server-side pagination, sorting, and filtering with row virtualization for large ledgers.
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

      <div className="flex flex-wrap items-center gap-3 mb-2">
        <input
          type="text"
          placeholder="Search description, receipt, tenant, property…"
          value={filterInput}
          onChange={(e) => onFilterChange(e.target.value)}
          className="w-full sm:w-96 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <span className="text-[11px] font-medium text-slate-500">
          {totalCount.toLocaleString()} record{totalCount === 1 ? '' : 's'}
        </span>
      </div>

      <VirtualizedDataTable<IncomeScheduleRow>
        columns={COLUMNS}
        data={rows}
        totalCount={totalCount}
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
        onColumnVisibilityChange={handleColumnVisibility}
      />
    </div>
  )
}
