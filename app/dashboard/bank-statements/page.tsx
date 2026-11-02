'use client'

import { useState, useEffect } from 'react'
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
import { uploadBankStatement, getUnreconciledInvoices, type BankUploadResult } from './actions'

const columnHelper = createColumnHelper<any>()

const COLUMNS: any[] = [
  columnHelper.accessor('invoice_number', {
    header: 'Invoice No.',
    meta: { width: '140px' },
  }),
  columnHelper.accessor('billing_month', {
    header: 'Billing Month',
    meta: { width: '120px' },
    cell: (info) => {
      const value = info.getValue() as string
      return new Date(value).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    },
  }),
  columnHelper.accessor('total_amount', {
    header: 'Amount (KES)',
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
      const colors: Record<string, string> = {
        unpaid: 'bg-red-100 text-red-800',
        partial: 'bg-amber-100 text-amber-800',
        paid: 'bg-green-100 text-green-800',
      }
      return (
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${colors[value] ?? colors.unpaid}`}>
          {value}
        </span>
      )
    },
  }),
  columnHelper.accessor('tenant_name', {
    header: 'Tenant',
    meta: { width: '180px' },
  }),
  columnHelper.accessor('unit_number', {
    header: 'Unit',
    meta: { width: '100px' },
  }),
]

export default function BankStatementsPage() {
  const [unpaidInvoices, setUnpaidInvoices] = useState<any[]>([])
  const [uploadResult, setUploadResult] = useState<BankUploadResult | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showResults, setShowResults] = useState(false)

  const density = useDashboardStore((s) => s.density)
  const columnVisibility = useDashboardStore((s) => s.columnVisibility)

  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(25)

  useEffect(() => {
    ;(async () => {
      const invoices = await getUnreconciledInvoices()
      setUnpaidInvoices(invoices)
    })()
  }, [])

  const from = Math.min(pageIndex * pageSize + 1, unpaidInvoices.length)
  const to = Math.min((pageIndex + 1) * pageSize, unpaidInvoices.length)
  const visibleRows = unpaidInvoices.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)

  const handlePagination = ({ pageIndex: nextIndex, pageSize: nextSize }: { pageIndex: number; pageSize: number }) => {
    setPageIndex(nextIndex)
    setPageSize(nextSize)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Please upload a CSV file')
      return
    }

    setUploading(true)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const result = await uploadBankStatement({
        fileName: file.name,
        fileBuffer: buffer,
        contentType: file.type,
      })
      setUploadResult(result)
      setShowResults(true)
      // Refresh unpaid invoices
      const updated = await getUnreconciledInvoices()
      setUnpaidInvoices(updated)
    } catch (err) {
      console.error(err)
      alert('Upload failed: ' + (err as Error).message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const totalOutstanding = unpaidInvoices.reduce((sum, i) => sum + i.total_amount, 0)

  return (
    <div className="p-4 sm:p-8 max-w-[1400px] mx-auto space-y-6 text-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-900 text-white shadow-xs">
            Bank Reconciliation
          </span>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 font-sans mt-1">
            Bank Statement Upload
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Upload MT940/CSV bank statements to automatically match RTGS payments to invoices and reconcile ledgers.
          </p>
        </div>
        <Link
          href="/dashboard/financials"
          className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors underline underline-offset-4"
        >
          ← Back to Financials
        </Link>
      </div>

      {/* UPLOAD SECTION */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs font-medium text-slate-600 hover:border-emerald-500 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Choose bank statement CSV
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            disabled={uploading}
            className={cn(
              'rounded-lg border px-4 py-2.5 text-xs font-semibold transition-colors disabled:opacity-50',
              uploading
                ? 'border-slate-200 text-slate-400 bg-slate-50 cursor-wait'
                : 'border-transparent bg-emerald-600 text-white hover:bg-emerald-700'
            )}
          >
            {uploading ? 'Processing…' : 'Upload'}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Supported columns: Date, Amount, Reference/Description. The system matches invoice numbers or exact amounts to outstanding invoices.
        </p>
      </div>

      {/* UPLOAD RESULTS */}
      {showResults && uploadResult && (
        <div className={cn(
          'rounded-xl p-4 shadow-sm border',
          uploadResult.success ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
        )}>
          <div className="flex items-start gap-3">
            <span className={cn('font-semibold', uploadResult.success ? 'text-green-700' : 'text-amber-700')}>
              {uploadResult.success ? '✓' : '⚠'}
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                {uploadResult.success ? 'Reconciliation Complete' : 'Reconciliation Complete with Issues'}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <div className="text-slate-500">Rows Processed</div>
                  <div className="font-mono font-semibold">{uploadResult.rowsProcessed}</div>
                </div>
                <div>
                  <div className="text-slate-500">Matched</div>
                  <div className="font-mono font-semibold text-green-600">{uploadResult.matched}</div>
                </div>
                <div>
                  <div className="text-slate-500">Unmatched</div>
                  <div className="font-mono font-semibold text-amber-600">{uploadResult.unmatched}</div>
                </div>
                <div>
                  <div className="text-slate-500">Errors</div>
                  <div className="font-mono font-semibold text-red-600">{uploadResult.errors.length}</div>
                </div>
              </div>
              {uploadResult.matchedDetails.length > 0 && (
                <div className="mt-3">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Matched Invoices
                  </div>
                  <div className="space-y-1">
                    {uploadResult.matchedDetails.map((d) => (
                      <div key={d.invoiceId} className="flex justify-between text-xs">
                        <span className="text-slate-600">{d.invoiceNumber}</span>
                        <span className="font-mono text-slate-900">KES {d.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {uploadResult.errors.length > 0 && (
                <div className="mt-3">
                  <div className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider mb-1">
                    Unmatched / Errors
                  </div>
                  <div className="space-y-1 text-xs text-amber-700">
                    {uploadResult.errors.slice(0, 10).map((e, i) => (
                      <div key={i} className="truncate">{e}</div>
                    ))}
                    {uploadResult.errors.length > 10 && (
                      <div className="text-slate-500">…and {uploadResult.errors.length - 10} more</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* OUTSTANDING SUMMARY */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Outstanding Invoices</h2>
          <div className="text-right">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Outstanding
            </div>
            <div className="text-xl font-black text-slate-900">
              KES {totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
        <VirtualizedDataTable<any>
          columns={COLUMNS}
          data={visibleRows}
          totalCount={unpaidInvoices.length}
          pageIndex={pageIndex}
          pageSize={pageSize}
          density={density}
          columnVisibility={columnVisibility}
          loading={false}
          onPaginationChange={handlePagination}
        />
        {unpaidInvoices.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-xs text-slate-500">
              No outstanding invoices. All accounts reconciled.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
