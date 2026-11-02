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
  getBillingPreview,
  generateInvoices,
  getProperties,
  type BillingPreviewRow,
} from './actions'

const columnHelper = createColumnHelper<BillingPreviewRow>()

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
  columnHelper.accessor('baseRent', {
    header: 'Base Rent (KES)',
    meta: { width: '140px', alignRight: true },
    cell: (info) => {
      const value = info.getValue() as number
      return value.toLocaleString(undefined, { minimumFractionDigits: 2 })
    },
  }),
  columnHelper.accessor('squareFootage', {
    header: 'Sq Ft',
    meta: { width: '100px', alignRight: true },
    cell: (info) => {
      const value = info.getValue() as number | null
      return value ? value.toLocaleString() : '—'
    },
  }),
  columnHelper.accessor('serviceChargeAmount', {
    header: 'Service Charge (KES)',
    meta: { width: '150px', alignRight: true },
    cell: (info) => {
      const value = info.getValue() as number
      return value.toLocaleString(undefined, { minimumFractionDigits: 2 })
    },
  }),
  columnHelper.accessor('vatAmount', {
    header: 'VAT 16% (KES)',
    meta: { width: '140px', alignRight: true },
    cell: (info) => {
      const value = info.getValue() as number
      return value.toLocaleString(undefined, { minimumFractionDigits: 2 })
    },
  }),
  columnHelper.accessor('totalAmount', {
    header: 'Total (KES)',
    meta: { width: '140px', alignRight: true },
    cell: (info) => {
      const value = info.getValue() as number
      return value.toLocaleString(undefined, { minimumFractionDigits: 2 })
    },
  }),
  columnHelper.accessor('alreadyInvoiced', {
    header: 'Status',
    meta: { width: '140px' },
    cell: (info) => {
      const value = info.getValue() as boolean
      return value ? 'Already invoiced' : 'Ready'
    },
  }),
] as ColumnDef<BillingPreviewRow, unknown>[]

export default function BillingEnginePage() {
  const [preview, setPreview] = useState<BillingPreviewRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [sorting, setSorting] = useState<{ id: string; desc: boolean }[]>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const [billingMonth, setBillingMonth] = useState(
    new Date().toISOString().slice(0, 7)
  )
  const [serviceChargeRate, setServiceChargeRate] = useState(0)
  const [propertyId, setPropertyId] = useState<string | undefined>(undefined)

  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([])

  const density = useDashboardStore((s) => s.density)
  const columnVisibility = useDashboardStore((s) => s.columnVisibility)
  const setDensity = useDashboardStore((s) => s.setDensity)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    ;(async () => {
      const props = await getProperties()
      setProperties(props)
    })()
  }, [])

  const runPreview = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await getBillingPreview({
        billingMonth,
        serviceChargeRate,
        propertyId,
      })
      setPreview(rows)
      setTotalCount(rows.length)
    } catch (err) {
      console.error(err)
      setPreview([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [billingMonth, serviceChargeRate, propertyId])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(runPreview, 400)
  }, [billingMonth, serviceChargeRate, propertyId, runPreview])

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const result = await generateInvoices({
        billingMonth,
        serviceChargeRate,
        propertyId,
      })
      setPreview(result.rows)
      setTotalCount(result.rows.length)
      alert(
        `Generated ${result.generated} invoice(s) for ${billingMonth}. ` +
          `Skipped ${result.skipped} already-invoiced lease(s). ` +
          `Total value: KES ${result.totalAmount.toLocaleString()}`
      )
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

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

  const from = Math.min(pageIndex * pageSize + 1, totalCount)
  const to = Math.min((pageIndex + 1) * pageSize, totalCount)
  const grandTotal = preview.reduce((sum, r) => sum + r.totalAmount, 0)
  const readyRows = preview.filter((r) => !r.alreadyInvoiced)
  const readyCount = readyRows.length
  const readyTotal = readyRows.reduce((sum, r) => sum + r.totalAmount, 0)

  return (
    <div className="p-4 sm:p-8 max-w-[1400px] mx-auto space-y-6 text-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-900 text-white shadow-xs">
            Billing Engine
          </span>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 font-sans mt-1">
            Automated Monthly Billing
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Generate invoices for all active leases: base rent + service charge (per sq ft) + 16% VAT.
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
                Billing Month
              </label>
              <input
                type="month"
                value={billingMonth}
                onChange={(e) => setBillingMonth(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Service Charge / Sq Ft (KES)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={serviceChargeRate}
                onChange={(e) => setServiceChargeRate(Number(e.target.value || 0))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-32"
              />
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
          <div className="flex items-end gap-3">
            <button
              onClick={runPreview}
              disabled={loading}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
                loading && 'cursor-wait'
              )}
            >
              {loading ? 'Computing…' : 'Preview'}
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading || readyCount === 0}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                readyCount === 0
                  ? 'border-slate-200 text-slate-400 bg-slate-50'
                  : 'border-transparent bg-emerald-600 text-white hover:bg-emerald-700'
              )}
            >
              Generate Invoices
            </button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="flex flex-col sm:flex-row gap-4 pt-3 border-t border-slate-100">
          <div className="flex-1 bg-slate-50 rounded-lg p-4">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Ready to Invoice
            </div>
            <div className="text-xl font-black text-emerald-900 mt-1">
              {readyCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              KES {readyTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="flex-1 bg-slate-50 rounded-lg p-4">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Already Invoiced
            </div>
            <div className="text-xl font-black text-slate-900 mt-1">
              {preview.length - readyCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Skipped (duplicate month)
            </div>
          </div>
          <div className="flex-1 bg-slate-50 rounded-lg p-4">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Grand Total
            </div>
            <div className="text-xl font-black text-slate-900 mt-1">
              KES {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* PREVIEW TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500">Preview</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
              {totalCount} lease{totalCount === 1 ? '' : 's'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            Showing {from} to {to} of {totalCount}
          </div>
        </div>
        <VirtualizedDataTable<BillingPreviewRow>
          columns={COLUMNS}
          data={preview.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)}
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
        />
        {totalCount === 0 && (
          <div className="p-12 text-center">
            <p className="text-xs text-slate-500">
              No active leases found for the selected filters. Adjust the billing month or property.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
