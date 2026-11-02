'use client'

import { Buffer } from 'buffer'
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
  listDocuments,
  uploadDocument,
  type DocumentFile,
} from '@/app/dashboard/invoices/actions'

const BUCKETS = [
  { id: 'invoices', label: 'Invoices' },
  { id: 'lease-documents', label: 'Signed Leases' },
  { id: 'certificates', label: 'Compliance Certificates' },
] as const

const columnHelper = createColumnHelper<DocumentFile>()

const COLUMNS: ColumnDef<DocumentFile, unknown>[] = [
  columnHelper.accessor('name', {
    header: 'File Name',
    meta: { width: '300px' },
  }),
  columnHelper.accessor('bucket', {
    header: 'Bucket',
    meta: { width: '150px' },
  }),
  columnHelper.accessor('size', {
    header: 'Size',
    meta: { width: '100px', alignRight: true },
    cell: (info) => {
      const value = info.getValue() as number
      const kb = (value / 1024).toFixed(1)
      return `${kb} KB`
    },
  }),
  columnHelper.accessor('updated_at', {
    header: 'Updated',
    meta: { width: '180px' },
    cell: (info) => {
      const value = info.getValue() as string
      return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    },
  }),
  columnHelper.accessor('url', {
    header: 'Action',
    meta: { width: '120px' },
    cell: (info) => {
      const value = info.getValue() as string | null
      return value ? 'Download' : '—'
    },
  }),
] as ColumnDef<DocumentFile, unknown>[]

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentFile[]>([])
  const [loading, setLoading] = useState(false)
  const [activeBucket, setActiveBucket] = useState<string>('invoices')

  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [sorting, setSorting] = useState<{ id: string; desc: boolean }[]>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const density = useDashboardStore((s) => s.density)
  const columnVisibility = useDashboardStore((s) => s.columnVisibility)
  const setDensity = useDashboardStore((s) => s.setDensity)

  useEffect(() => {
    setLoading(true)
    ;(async () => {
      try {
        const docs = await listDocuments(activeBucket)
        setDocuments(docs)
      } catch (err) {
        console.error(err)
        setDocuments([])
      } finally {
        setLoading(false)
      }
    })()
  }, [activeBucket])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    ;(async () => {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const result = await uploadDocument({
        bucket: activeBucket,
        fileName: `${Date.now()}-${file.name}`,
        fileBuffer: buffer,
        contentType: file.type,
      })
      if (result.success) {
        const docs = await listDocuments(activeBucket)
        setDocuments(docs)
      } else {
        alert(`Upload failed: ${result.error}`)
      }
      setLoading(false)
    })()
    e.target.value = ''
  }

  const handleDownload = (url: string | null) => {
    if (!url) return
    window.open(url, '_blank')
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

  const from = Math.min(pageIndex * pageSize + 1, documents.length)
  const to = Math.min((pageIndex + 1) * pageSize, documents.length)
  const visibleRows = documents.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)

  return (
    <div className="p-4 sm:p-8 max-w-[1400px] mx-auto space-y-6 text-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-900 text-white shadow-xs">
            Document Management
          </span>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 font-sans mt-1">
            Secure Document Storage
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Store and manage signed leases, compliance certificates, and invoice PDFs in Supabase Storage.
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

      {/* BUCKET TABS */}
      <div className="flex gap-1 mb-2">
        {BUCKETS.map((b) => (
          <button
            key={b.id}
            onClick={() => setActiveBucket(b.id)}
            className={cn(
              'px-4 py-2 rounded-lg text-xs font-medium transition-colors border',
              activeBucket === b.id
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            )}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* UPLOAD */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs font-medium text-slate-600 hover:border-emerald-500 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Choose file to upload to <span className="font-bold text-slate-900">{activeBucket}</span>
          </label>
          <input
            type="file"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            disabled={loading}
            className={cn(
              'rounded-lg border px-4 py-2.5 text-xs font-semibold transition-colors disabled:opacity-50',
              loading
                ? 'border-slate-200 text-slate-400 bg-slate-50 cursor-wait'
                : 'border-transparent bg-emerald-600 text-white hover:bg-emerald-700'
            )}
          >
            {loading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500">Files</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
              {documents.length}
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            Showing {from} to {to} of {documents.length}
          </div>
        </div>
        <VirtualizedDataTable<DocumentFile>
          columns={COLUMNS}
          data={visibleRows}
          totalCount={documents.length}
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
            if (props.columnId === 'url') {
              const row = props.row as DocumentFile
              return (
                <button
                  onClick={() => handleDownload(row.url)}
                  disabled={!row.url || loading}
                  className={cn(
                    'inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                    row.url
                      ? 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                      : 'border-slate-200 text-slate-400'
                  )}
                >
                  {row.url ? 'Download' : '—'}
                </button>
              )
            }
            return undefined
          }}
        />
        {documents.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-xs text-slate-500">
              No documents in this bucket. Upload a file to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
