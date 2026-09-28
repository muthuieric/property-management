'use client'

import React, { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import SlideOverDrawer from '@/app/dashboard/components/SlideOverDrawer'
import { processBulkPayments, BulkPaymentsResult } from '../actions'

export interface PropertyOption {
  id: string
  name: string
}

interface BulkPaymentUploaderProps {
  isOpen: boolean
  onClose: () => void
  properties: PropertyOption[]
  defaultPropertyId?: string
}

interface ParsedPaymentRow {
  'Unit Number'?: string
  'Amount Paid'?: string | number
  'Payment Method'?: string
  'Reference Code'?: string
  'Date'?: string
  [key: string]: unknown
}

interface PreviewRow {
  index: number
  unitNumber: string
  amount: number
  paymentMethod: string
  referenceCode: string
  date: string
  isValid: boolean
  warning?: string
}

export default function BulkPaymentUploader({
  isOpen,
  onClose,
  properties = [],
  defaultPropertyId,
}: BulkPaymentUploaderProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(
    defaultPropertyId || properties[0]?.id || ''
  )

  const [parsedRows, setParsedRows] = useState<ParsedPaymentRow[]>([])
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<BulkPaymentsResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Reset state on open/close
  const handleClose = () => {
    setParsedRows([])
    setPreviewRows([])
    setFileName(null)
    setResult(null)
    setErrorMessage(null)
    onClose()
  }

  // 1. Download CSV Template
  const handleDownloadTemplate = () => {
    const headers = 'Unit Number,Amount Paid,Payment Method,Reference Code,Date\n'
    const sampleData =
      'A101,35000,MPESA,QKD8391KLP,2026-10-02\n' +
      'B202,42000,BANK_TRANSFER,FT262788192,2026-10-03\n' +
      'C303,28500,MPESA,QKJ9921MNO,2026-10-04\n' +
      'D404,50000,CASH,CSH-REC-004,2026-10-05\n'

    const csvContent = headers + sampleData
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'luffi_payments_import_template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // 2. Parse uploaded CSV file
  const handleParseFile = (file: File) => {
    setErrorMessage(null)
    setResult(null)

    if (!file.name.endsWith('.csv') && !file.type.includes('csv') && !file.type.includes('sheet')) {
      setErrorMessage('Please upload a standard .csv spreadsheet file.')
      return
    }

    setFileName(file.name)

    Papa.parse<ParsedPaymentRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          console.warn('PapaParse warnings:', results.errors)
        }

        const data = results.data || []
        if (data.length === 0) {
          setErrorMessage('The uploaded CSV file contains no data rows.')
          setParsedRows([])
          setPreviewRows([])
          return
        }

        setParsedRows(data)

        // Generate preview mapping
        const previews: PreviewRow[] = data.map((row, idx) => {
          const unit =
            row['Unit Number'] ??
            row['unit_number'] ??
            row['Unit'] ??
            row['unitNumber'] ??
            row['unit'] ??
            ''
          const rawAmount =
            row['Amount Paid'] ??
            row['Amount'] ??
            row['amount'] ??
            row['amount_paid'] ??
            row['amountPaid'] ??
            ''
          const method =
            row['Payment Method'] ??
            row['payment_method'] ??
            row['Method'] ??
            row['paymentMethod'] ??
            'MPESA'
          const ref =
            row['Reference Code'] ??
            row['reference_code'] ??
            row['Reference'] ??
            row['reference'] ??
            row['referenceCode'] ??
            ''
          const rawDate =
            row['Date'] ??
            row['date'] ??
            row['Payment Date'] ??
            row['transaction_date'] ??
            new Date().toISOString().split('T')[0]

          const cleanUnit = String(unit).trim()
          const cleanAmountStr = String(rawAmount).replace(/[^0-9.-]+/g, '')
          const amount = parseFloat(cleanAmountStr)

          let isValid = true
          let warning = ''

          if (!cleanUnit) {
            isValid = false
            warning = 'Missing unit'
          } else if (isNaN(amount) || amount <= 0) {
            isValid = false
            warning = 'Invalid amount'
          }

          return {
            index: idx + 1,
            unitNumber: cleanUnit || 'N/A',
            amount: isNaN(amount) ? 0 : amount,
            paymentMethod: String(method).trim().toUpperCase() || 'MPESA',
            referenceCode: String(ref).trim() || '—',
            date: String(rawDate).trim() || new Date().toISOString().split('T')[0],
            isValid,
            warning,
          }
        })

        setPreviewRows(previews)
      },
      error: (err) => {
        console.error('CSV parse error:', err)
        setErrorMessage(`Failed to parse CSV file: ${err.message}`)
      },
    })
  }

  // 3. Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleParseFile(e.dataTransfer.files[0])
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleParseFile(e.target.files[0])
    }
  }

  // 4. Submit Bulk Payments
  const handleSubmitImport = () => {
    if (!selectedPropertyId) {
      setErrorMessage('Please select a target property for payment reconciliation.')
      return
    }

    if (parsedRows.length === 0) {
      setErrorMessage('No payment records to import. Please upload a populated CSV file.')
      return
    }

    setErrorMessage(null)
    setResult(null)

    startTransition(async () => {
      try {
        const res = await processBulkPayments(selectedPropertyId, parsedRows)
        setResult(res)
        if (res.success) {
          router.refresh()
        } else {
          setErrorMessage(res.error || 'Failed to import payment transactions.')
        }
      } catch (err: any) {
        console.error('Import failed:', err)
        setErrorMessage(err?.message || 'Server error occurred during payment import.')
      }
    })
  }

  // Compute summary stats from preview
  const validRowCount = previewRows.filter((r) => r.isValid).length
  const totalPreviewAmount = previewRows
    .filter((r) => r.isValid)
    .reduce((sum, r) => sum + r.amount, 0)

  return (
    <SlideOverDrawer
      isOpen={isOpen}
      onClose={handleClose}
      title="Bulk CSV Payment Reconciliation"
      subtitle="Upload your M-Pesa Paybill or Bank Statement to mass-reconcile tenant rent payments."
      maxWidth="max-w-2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmitImport}
            disabled={isPending || parsedRows.length === 0 || !selectedPropertyId}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-2 shadow-sm disabled:cursor-not-allowed cursor-pointer"
          >
            {isPending ? (
              <>
                <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Reconciling Ledger...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>Import {validRowCount > 0 ? `${validRowCount} Payments` : 'Payments'}</span>
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-2.5">
            <svg className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="flex-1 leading-relaxed">
              <span className="font-bold">Error: </span>
              {errorMessage}
            </div>
          </div>
        )}

        {/* Post-Import Result Card */}
        {result && (
          <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
              <svg className="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Batch Reconciliation Complete!</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
              <div className="p-2.5 bg-white/80 rounded-xl border border-emerald-100">
                <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Processed</span>
                <span className="text-base font-bold text-slate-900">{result.totalProcessed}</span>
              </div>
              <div className="p-2.5 bg-white/80 rounded-xl border border-emerald-100">
                <span className="text-emerald-700 block text-[10px] uppercase tracking-wider">Saved</span>
                <span className="text-base font-bold text-emerald-700">{result.insertedCount}</span>
              </div>
              <div className="p-2.5 bg-white/80 rounded-xl border border-emerald-100">
                <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Total Value</span>
                <span className="text-sm font-black text-slate-900">KES {result.totalAmount.toLocaleString()}</span>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="mt-3 p-3 bg-white/90 rounded-xl border border-amber-200 text-xs">
                <span className="font-bold text-amber-900 block mb-1">Row Notice ({result.errors.length}):</span>
                <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11px] max-h-28 overflow-y-auto">
                  {result.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* STEP 1: PROPERTY SELECTION & TEMPLATE DOWNLOAD */}
        <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              1. Target Property &amp; Template
            </span>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-white hover:bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl transition-all inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Download CSV Template</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="propertySelect">
              Select Property Site
            </label>
            <select
              id="propertySelect"
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="w-full text-xs bg-white border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* STEP 2: DRAG & DROP CSV FILE */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
            2. Upload Statement (.CSV)
          </span>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              isDragOver
                ? 'border-emerald-500 bg-emerald-50/50 scale-[0.99]'
                : 'border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,application/vnd.ms-excel"
              onChange={handleFileInputChange}
              className="hidden"
            />

            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>

            {fileName ? (
              <div>
                <p className="text-xs font-bold text-slate-900">{fileName}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Click or drag a new file to replace</p>
              </div>
            ) : (
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  Click to browse or drag and drop statement CSV
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Required columns: Unit Number, Amount Paid, Payment Method, Reference Code, Date
                </p>
              </div>
            )}
          </div>
        </div>

        {/* STEP 3: PREVIEW TABLE */}
        {previewRows.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  3. Batch Preview ({previewRows.length} Rows)
                </span>
                <span className="text-[11px] text-slate-500">
                  {validRowCount} valid entries ready for ingestion &bull; KES {totalPreviewAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono font-medium">
                Pending Verification
              </span>
            </div>

            <div className="overflow-hidden border border-slate-200 rounded-xl shadow-xs">
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold uppercase text-[10px] tracking-wider z-10">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Unit</th>
                      <th className="py-2.5 px-3 text-right">Amount (KES)</th>
                      <th className="py-2.5 px-3 text-center">Channel</th>
                      <th className="py-2.5 px-3">Reference</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {previewRows.map((row) => (
                      <tr key={row.index} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{row.index}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">{row.unitNumber}</td>
                        <td className="py-2 px-3 text-right font-semibold tabular-nums text-emerald-700">
                          {row.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {row.paymentMethod}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600 text-[11px] truncate max-w-[100px]">
                          {row.referenceCode}
                        </td>
                        <td className="py-2 px-3 text-slate-500 whitespace-nowrap">{row.date}</td>
                        <td className="py-2 px-3 text-center">
                          {row.isValid ? (
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              Valid
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                              {row.warning}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </SlideOverDrawer>
  )
}

