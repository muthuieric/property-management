'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import SlideOverDrawer from '@/app/dashboard/components/SlideOverDrawer'
import { bulkImportTenants } from '../actions'

interface BulkTenantUploaderProps {
  isOpen: boolean
  onClose: () => void
  properties: Array<{ id: string; name: string }>
}

interface ParsedTenantRow {
  'Full Name'?: string
  'Phone'?: string
  'Unit Number'?: string
  'Lease Start (YYYY-MM-DD)'?: string
  'Deposit Paid KES'?: string | number
  [key: string]: unknown
}

export default function BulkTenantUploader({
  isOpen,
  onClose,
  properties = [],
}: BulkTenantUploaderProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(
    properties[0]?.id || ''
  )
  const [parsedRows, setParsedRows] = useState<ParsedTenantRow[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleDownloadTemplate = () => {
    const csvContent =
      'Full Name,Phone,Unit Number,Lease Start (YYYY-MM-DD),Deposit Paid KES\n' +
      'Jane Wanjiku Kariuki,0712345678,A101,2026-04-01,35000\n' +
      'David Kiprono,0722987654,B202,2026-04-01,40000\n' +
      'Alice Mwangi,+254711223344,C303,2026-04-01,28000\n'

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'luffi_tenant_import_template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const parseFile = (file: File) => {
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!file.name.endsWith('.csv')) {
      setErrorMessage('Please upload a valid CSV file (.csv).')
      return
    }

    setFileName(file.name)

    Papa.parse<ParsedTenantRow>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          console.warn('CSV Parse Warnings/Errors:', results.errors)
        }

        const valid = results.data.filter(
          (row) =>
            (row['Full Name'] || (row as any)['name'] || (row as any)['Tenant Name']) &&
            (row['Phone'] || (row as any)['phone_number'] || (row as any)['Mobile'])
        )

        if (valid.length === 0) {
          setErrorMessage(
            'No valid tenant rows detected. Ensure columns match "Full Name", "Phone", "Unit Number", "Lease Start (YYYY-MM-DD)", "Deposit Paid KES".'
          )
          setParsedRows([])
          return
        }

        setParsedRows(valid)
      },
      error: (err) => {
        setErrorMessage(`CSV Parsing Error: ${err.message}`)
      },
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      parseFile(file)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      parseFile(file)
    }
  }

  const handleImport = () => {
    if (!selectedPropertyId) {
      setErrorMessage('Please select the target property for these units and leases.')
      return
    }

    if (parsedRows.length === 0) {
      setErrorMessage('No valid tenant records to import.')
      return
    }

    setErrorMessage(null)

    startTransition(async () => {
      try {
        const res = await bulkImportTenants(selectedPropertyId, parsedRows)
        if (res.success) {
          setSuccessMessage(
            `Successfully imported ${res.count || parsedRows.length} tenants with active leases!`
          )
          setTimeout(() => {
            setParsedRows([])
            setFileName(null)
            onClose()
            router.refresh()
          }, 1200)
        } else {
          setErrorMessage(res.error || 'Failed to complete bulk tenant import.')
        }
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error ? err.message : 'An error occurred during bulk tenant import.'
        )
      }
    })
  }

  const resetSelection = () => {
    setParsedRows([])
    setFileName(null)
    setErrorMessage(null)
    setSuccessMessage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk CSV Tenant Importer"
      subtitle="Instantly onboard dozens of tenants and provision their active leases via CSV batch."
      maxWidth="max-w-2xl"
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

          <div className="flex items-center gap-2">
            {parsedRows.length > 0 && (
              <button
                type="button"
                onClick={resetSelection}
                disabled={isPending}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Clear File
              </button>
            )}

            <button
              type="button"
              onClick={handleImport}
              disabled={isPending || parsedRows.length === 0 || !selectedPropertyId}
              className="px-5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isPending ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Importing {parsedRows.length} Tenants...</span>
                </>
              ) : (
                <>
                  <span>Import {parsedRows.length > 0 ? `${parsedRows.length} Tenants` : 'Tenants'}</span>
                  <span>&rarr;</span>
                </>
              )}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 text-slate-900">
        {/* Template & Target Property Bar */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-800">CSV Template Reference</div>
              <div className="text-[11px] text-slate-500">
                Download the standardized CSV schema with sample records.
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg shadow-2xs transition-colors shrink-0"
            >
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Download Template (.csv)</span>
            </button>
          </div>

          <div className="border-t border-slate-200 pt-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Target Property for Batch Allocation <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
            >
              <option value="">-- Choose Target Property Site --</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Feedback Messages */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
            <span className="font-bold text-red-500">!</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
            <span className="font-bold text-emerald-600">&check;</span>
            <span>{successMessage}</span>
          </div>
        )}

        {/* Drag and Drop Zone */}
        {parsedRows.length === 0 ? (
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragOver
                ? 'border-slate-900 bg-slate-50'
                : 'border-slate-300 hover:border-slate-400 bg-white'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv"
              className="hidden"
            />
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div className="text-xs font-semibold text-slate-800">
              Click to browse or drag and drop your completed CSV
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Supports .csv files with standard columns: Full Name, Phone, Unit Number, Lease Start, Deposit Paid.
            </p>
          </div>
        ) : (
          /* Parsed Rows Preview Table */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">Parsed Batch Preview</span>
                <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  {parsedRows.length} Tenants Ready
                </span>
              </div>
              <span className="text-xs text-slate-500 font-mono">{fileName}</span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">#</th>
                    <th className="py-2.5 px-3 font-semibold">Full Name</th>
                    <th className="py-2.5 px-3 font-semibold">Phone</th>
                    <th className="py-2.5 px-3 font-semibold">Unit</th>
                    <th className="py-2.5 px-3 font-semibold">Start Date</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Deposit (KES)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {parsedRows.map((row, idx) => {
                    const name =
                      row['Full Name'] || (row as any)['name'] || (row as any)['Tenant Name'] || '—'
                    const phone =
                      row['Phone'] || (row as any)['phone_number'] || (row as any)['Mobile'] || '—'
                    const unit =
                      row['Unit Number'] || (row as any)['unit'] || (row as any)['Unit'] || '—'
                    const start =
                      row['Lease Start (YYYY-MM-DD)'] ||
                      (row as any)['lease_start'] ||
                      (row as any)['Start Date'] ||
                      '—'
                    const deposit =
                      row['Deposit Paid KES'] || (row as any)['deposit'] || (row as any)['Deposit'] || '0'

                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                        <td className="py-2 px-3 font-medium text-slate-900">{name}</td>
                        <td className="py-2 px-3 text-slate-600 font-mono">{phone}</td>
                        <td className="py-2 px-3 text-slate-800 font-semibold">{unit}</td>
                        <td className="py-2 px-3 text-slate-600">{start}</td>
                        <td className="py-2 px-3 text-slate-900 text-right font-medium">
                          {Number(String(deposit).replace(/[^0-9.]/g, '') || 0).toLocaleString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-slate-500 italic">
              Units that do not yet exist will be automatically created under this property and marked as occupied upon lease provisioning.
            </p>
          </div>
        )}
      </div>
    </SlideOverDrawer>
  )
}

