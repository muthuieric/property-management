'use client'

import { useEffect, useState } from 'react'
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
  getInvoicesWithPdf,
  generateInvoicePdfAction,
} from './actions'

const columnHelper = createColumnHelper<any>()

const COLUMNS: ColumnDef<any, unknown>[] = [
  columnHelper.accessor('id', {
    header: 'Invoice #',
    meta: { width: '140px' },
    cell: (info) => {
      const value = info.getValue() as string
      return `INV-${value.slice(0, 8).toUpperCase()}`
    },
  }),
  columnHelper.accessor('tenant_name', {
    header: 'Tenant',
    meta: { width: '200px' },
  }),
  columnHelper.accessor('unit_number', {
    header: 'Unit',
    meta: { width: '120px' },
  }),
  columnHelper.accessor('property_name', {
    header: 'Property',
    meta: { width: '200px' },
  }),
  columnHelper.accessor('billing_month', {
    header: 'Billing Month',
    meta: { width: '130px' },
    cell: (info) => {
      const value = info.getValue() as string
      return new Date(value).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    },
  }),
  columnHelper.accessor('total_amount', {
    header: 'Total (KES)',
    meta: { width: '140px', alignRight: true },
    cell: (info) => {
      const value = info.getValue() as number
      return value.toLocaleString(undefined, { minimumFractionDigits: 2 })
    },
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    meta: { width: '120px' },
    cell: (info) => {
      const value = info.getValue() as string
      return value.charAt(0).toUpperCase() + value.slice(1)
    },
  }),
  columnHelper.accessor('pdf_url', {
    header: 'PDF',
    meta: { width: '100px' },
    cell: (info) => {
      const value = info.getValue() as string | null
      return value ? 'Generated' : 'Pending'
    },
  }),
] as ColumnDef<any, unknown>[]

function statusBadge(status: string) {
  const config: Record<string, { bg: string; border: string; text: string }> = {
    unpaid: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
    partial: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
    paid: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  }
  const c = config[status] || config.unpaid
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase', c.bg, c.border, c.text)}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [sorting, setSorting] = useState<{ id: string; desc: boolean }[]>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const density = useDashboardStore((s) => s.density)
  const columnVisibility = useDashboardStore((s) => s.columnVisibility)
  const setDensity = useDashboardStore((s) => s.setDensity)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const data = await getInvoicesWithPdf()
        setInvoices(data)
      } catch (err) {
        console.error(err)
        setInvoices([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleGeneratePdf = async (invoiceId: string) => {
    setLoading(true)
    try {
      const result = await generateInvoicePdfAction({ invoiceId })
      if (result.success && result.pdfUrl) {
        alert(`PDF generated: ${result.pdfUrl}`)
        // Refresh to show updated pdf_url
        const data = await getInvoicesWithPdf()
        setInvoices(data)
      } else {
        alert(`Failed: ${result.error}`)
      }
    } catch (err: any) {
       alert(`Error: ${err?.message ?? 'Unknown error'}`)
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

  const from = Math.min(pageIndex * pageSize + 1, invoices.length)
  const to = Math.min((pageIndex + 1) * pageSize, invoices.length)
  const visibleRows = invoices.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)

  return (
    <div className="p-4 sm:p-8 max-w-[1400px] mx-auto space-y-6 text-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-900 text-white shadow-xs">
            Invoices
          </span>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 font-sans mt-1">
            Invoice Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            View, generate, and download tenant invoices with VAT and service charge breakdown.
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
            href="/dashboard/billing-engine"
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors underline underline-offset-4"
          >
            ← Back to Billing Engine
          </Link>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Invoices</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{invoices.length}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Unpaid</div>
          <div className="text-2xl font-black text-amber-900 mt-1">
            {invoices.filter((i) => i.status === 'unpaid').length}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Paid</div>
          <div className="text-2xl font-black text-emerald-900 mt-1">
            {invoices.filter((i) => i.status === 'paid').length}
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500">Invoices</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
              {invoices.length}
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            Showing {from} to {to} of {invoices.length}
          </div>
        </div>
        <VirtualizedDataTable<any>
          columns={COLUMNS}
          data={visibleRows}
          totalCount={invoices.length}
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
              return statusBadge(props.value as string)
            }
            if (props.columnId === 'pdf_url') {
              const row = props.row as any
              const hasPdf = Boolean(row.pdf_url)
              return (
                <button
                  onClick={() => handleGeneratePdf(row.id)}
                  disabled={loading}
                  className={cn(
                    'inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-medium transition-colors disabled:opacity-50',
                    hasPdf
                      ? 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                      : 'border-slate-200 text-slate-500 bg-white hover:bg-slate-50'
                  )}
                >
                  {hasPdf ? 'View PDF' : 'Generate'}
                </button>
              )
            }
            return undefined
          }}
        />
        {invoices.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-xs text-slate-500">
              No invoices found. Run the billing engine first to generate invoices.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
