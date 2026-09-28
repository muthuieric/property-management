'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import SlideOverDrawer from '@/app/dashboard/components/SlideOverDrawer'
import {
  processBulkMeterReadings,
  getPropertyUnitsForTemplate,
  BulkMeterReadingsResponse,
  ProcessedReadingResult,
} from '../actions'

export interface PropertyOption {
  id: string
  name: string
  standard_water_rate: number
  unitsCount?: number
}

interface BulkUtilityUploaderProps {
  isOpen: boolean
  onClose: () => void
  properties: PropertyOption[]
  selectedPropertyId?: string
}

interface ParsedCsvRow {
  'Unit Number'?: string
  'Current Reading'?: string | number
  unitNumber?: string
  currentReading?: string | number
  [key: string]: unknown
}

interface PreviewRow {
  unitNumber: string
  currentReading: number
  previousReading: number
  consumption: number
  totalCharge: number
  isValid: boolean
  warning?: string
}

export default function BulkUtilityUploader({
  isOpen,
  onClose,
  properties = [],
  selectedPropertyId: initialPropertyId,
}: BulkUtilityUploaderProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(
    initialPropertyId || properties[0]?.id || ''
  )
  const [readingDate, setReadingDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  )

  const [propertyUnits, setPropertyUnits] = useState<
    Array<{ id: string; unit_number: string; latest_reading: number }>
  >([])
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)

  const [parsedRows, setParsedRows] = useState<ParsedCsvRow[]>([])
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const [isPending, startTransition] = useTransition()
  const [batchResponse, setBatchResponse] = useState<BulkMeterReadingsResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Current selected property object
  const activeProperty = properties.find((p) => p.id === selectedPropertyId)
  const waterRate = activeProperty?.standard_water_rate ?? 150.0

  // Fetch unit references when property changes or modal opens
  useEffect(() => {
    if (isOpen && selectedPropertyId) {
      setIsLoadingUnits(true)
      getPropertyUnitsForTemplate(selectedPropertyId)
        .then((units) => {
          setPropertyUnits(units)
        })
        .catch((err) => console.error('Failed to load property units:', err))
        .finally(() => setIsLoadingUnits(false))
    }
  }, [isOpen, selectedPropertyId])

  // Reset state when opening or closing
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null)
      setBatchResponse(null)
      if (initialPropertyId) {
        setSelectedPropertyId(initialPropertyId)
      } else if (!selectedPropertyId && properties.length > 0) {
        setSelectedPropertyId(properties[0].id)
      }
    }
  }, [isOpen, initialPropertyId, properties])

  // Re-calculate preview rows whenever parsedRows or propertyUnits change
  useEffect(() => {
    if (parsedRows.length === 0) {
      setPreviewRows([])
      return
    }

    const unitMap = new Map<string, number>()
    propertyUnits.forEach((u) => {
      unitMap.set(u.unit_number.trim().toLowerCase(), u.latest_reading)
    })

    const calculated: PreviewRow[] = parsedRows.map((row) => {
      const unitNum = String(
        row['Unit Number'] ?? row.unitNumber ?? row['unit'] ?? row['Unit'] ?? ''
      ).trim()
      const rawCurrent =
        row['Current Reading'] ?? row.currentReading ?? row['reading'] ?? row['Reading']

      const current = parseFloat(String(rawCurrent).replace(/[^0-9.]/g, ''))
      const prev = unitMap.get(unitNum.toLowerCase()) ?? 0.0

      if (!unitNum) {
        return {
          unitNumber: 'Missing',
          currentReading: 0,
          previousReading: 0,
          consumption: 0,
          totalCharge: 0,
          isValid: false,
          warning: 'Unit number is missing',
        }
      }

      if (!unitMap.has(unitNum.toLowerCase())) {
        return {
          unitNumber: unitNum,
          currentReading: isNaN(current) ? 0 : current,
          previousReading: 0,
          consumption: 0,
          totalCharge: 0,
          isValid: false,
          warning: `Unit not found in ${activeProperty?.name || 'building'}`,
        }
      }

      if (isNaN(current)) {
        return {
          unitNumber: unitNum,
          currentReading: 0,
          previousReading: prev,
          consumption: 0,
          totalCharge: 0,
          isValid: false,
          warning: 'Invalid numeric reading',
        }
      }

      if (current < prev) {
        return {
          unitNumber: unitNum,
          currentReading: current,
          previousReading: prev,
          consumption: 0,
          totalCharge: 0,
          isValid: false,
          warning: `Reading reversal! Current (${current}) < Previous (${prev})`,
        }
      }

      const consumption = Math.round((current - prev) * 100) / 100
      const totalCharge = Math.round(consumption * waterRate * 100) / 100

      return {
        unitNumber: unitNum,
        currentReading: current,
        previousReading: prev,
        consumption,
        totalCharge,
        isValid: true,
      }
    })

    setPreviewRows(calculated)
  }, [parsedRows, propertyUnits, waterRate, activeProperty])

  const handleDownloadTemplate = () => {
    let csvContent = 'Unit Number,Current Reading\n'

    if (propertyUnits.length > 0) {
      // Pre-populate actual unit numbers of this building with suggested current reading placeholder
      propertyUnits.forEach((u) => {
        const suggested = (u.latest_reading + 5.0).toFixed(2)
        csvContent += `${u.unit_number},${suggested}\n`
      })
    } else {
      csvContent += '101,145.50\n102,180.20\n201,95.00\n202,112.40\n'
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const propertySlug = (activeProperty?.name || 'building')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
    link.setAttribute('download', `water_meter_template_${propertySlug}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const parseFile = (file: File) => {
    setErrorMessage(null)
    setBatchResponse(null)

    if (!file.name.endsWith('.csv')) {
      setErrorMessage('Please upload a valid CSV file (.csv).')
      return
    }

    setFileName(file.name)

    Papa.parse<ParsedCsvRow>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          console.warn('CSV Parse Warnings:', results.errors)
        }

        const valid = results.data.filter(
          (row) =>
            row['Unit Number'] ||
            row.unitNumber ||
            row['unit'] ||
            row['Unit'] ||
            row['Current Reading'] ||
            row.currentReading
        )

        if (valid.length === 0) {
          setErrorMessage(
            'No valid rows detected. Ensure header includes "Unit Number" and "Current Reading".'
          )
          setParsedRows([])
          return
        }

        setParsedRows(valid)
      },
      error: (err) => {
        setErrorMessage(`Failed to parse CSV file: ${err.message}`)
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

  const handleReset = () => {
    setParsedRows([])
    setPreviewRows([])
    setFileName(null)
    setErrorMessage(null)
    setBatchResponse(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = () => {
    if (!selectedPropertyId) {
      setErrorMessage('Please choose a target property for the meter readings.')
      return
    }

    if (parsedRows.length === 0) {
      setErrorMessage('No parsed meter readings to commit.')
      return
    }

    setErrorMessage(null)
    setBatchResponse(null)

    startTransition(async () => {
      try {
        const payload = parsedRows.map((r) => ({
          unitNumber: String(
            r['Unit Number'] ?? r.unitNumber ?? r['unit'] ?? r['Unit'] ?? ''
          ),
          currentReading: String(
            r['Current Reading'] ?? r.currentReading ?? r['reading'] ?? r['Reading'] ?? ''
          ),
        }))

        const res = await processBulkMeterReadings(selectedPropertyId, payload, readingDate)
        setBatchResponse(res)

        if (res.success && res.savedCount > 0 && res.failedCount === 0) {
          setTimeout(() => {
            handleReset()
            onClose()
            router.refresh()
          }, 1400)
        } else if (res.success && res.savedCount > 0) {
          // Partial success: refresh background data but keep drawer open to inspect isolated errors
          router.refresh()
        } else if (!res.success) {
          setErrorMessage(res.error || 'Batch meter readings processing encountered an error.')
        }
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Unexpected server error during batch processing.'
        )
      }
    })
  }

  const validCount = previewRows.filter((r) => r.isValid).length
  const warningCount = previewRows.length - validCount
  const totalEstimatedConsumption = previewRows.reduce((sum, r) => sum + r.consumption, 0)
  const totalEstimatedCharge = previewRows.reduce((sum, r) => sum + r.totalCharge, 0)

  return (
    <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk CSV Water Meter Reader"
      subtitle="Batch upload monthly meter readings, calculate consumption server-side, and stage draft bills."
      maxWidth="max-w-3xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {parsedRows.length > 0 && (
              <button
                type="button"
                onClick={handleReset}
                disabled={isPending}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Clear
              </button>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || parsedRows.length === 0 || !selectedPropertyId}
              className="px-5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isPending ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Processing {parsedRows.length} Readings...</span>
                </>
              ) : (
                <>
                  <span>Stage {validCount > 0 ? `${validCount} Draft Readings` : 'Readings'}</span>
                  <span>&rarr;</span>
                </>
              )}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 text-slate-900">
        {/* Controls Bar: Target Property, Reading Date, and Water Rate */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-900">Meter Batch Configuration</div>
              <div className="text-[11px] text-slate-500">
                Billing rate is governed by property specifications ({waterRate} KES/m³).
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              disabled={isLoadingUnits}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg shadow-2xs transition-colors shrink-0"
              title="Download customized CSV template with building unit numbers"
            >
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Download Building Template (.csv)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Building Site <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedPropertyId}
                onChange={(e) => {
                  setSelectedPropertyId(e.target.value)
                  handleReset()
                }}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.standard_water_rate} KES/m³)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reading Date
              </label>
              <input
                type="date"
                value={readingDate}
                onChange={(e) => setReadingDate(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
            <span className="font-bold text-red-500">!</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Error-Isolated Batch Response Banner */}
        {batchResponse && (
          <div
            className={`p-4 rounded-xl border space-y-2 ${
              batchResponse.failedCount === 0
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold">
              <div className="flex items-center gap-2">
                <span>{batchResponse.failedCount === 0 ? '✓' : '⚠️'}</span>
                <span>
                  Batch Results: {batchResponse.savedCount} Saved in Draft Status &bull;{' '}
                  {batchResponse.failedCount} Skipped / Isolated
                </span>
              </div>
            </div>

            {batchResponse.failedCount > 0 && (
              <div className="pt-2 border-t border-amber-200/80 space-y-1">
                <span className="text-[11px] font-semibold block text-amber-800">
                  Isolated Unit Anomalies (Other units were saved successfully):
                </span>
                <ul className="text-xs space-y-1 pl-2">
                  {batchResponse.results
                    .filter((r) => !r.success)
                    .map((fail, fIdx) => (
                      <li key={fIdx} className="flex items-start gap-1.5 text-red-700">
                        <span className="font-mono font-bold">{fail.unitNumber}:</span>
                        <span>{fail.error}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
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
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div className="text-xs font-semibold text-slate-800">
              Click to browse or drop your meter readings spreadsheet
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Supports CSV format with columns: <strong>Unit Number</strong>, <strong>Current Reading</strong>.
            </p>
          </div>
        ) : (
          /* Live Calculation & Preview Table */
          <div className="space-y-3 animate-in fade-in">
            {/* Aggregate Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Units</span>
                <span className="text-sm font-bold text-slate-900">{previewRows.length} Units</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Valid vs Warning</span>
                <span className="text-sm font-bold text-slate-900">
                  <span className="text-emerald-600">{validCount}</span> /{' '}
                  <span className={warningCount > 0 ? 'text-amber-600' : 'text-slate-400'}>
                    {warningCount}
                  </span>
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Est. Consumption</span>
                <span className="text-sm font-bold text-blue-700">
                  {totalEstimatedConsumption.toFixed(1)} m³
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Est. Billable Charge</span>
                <span className="text-sm font-bold text-emerald-700">
                  KES {totalEstimatedCharge.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Table */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">
                Spreadsheet Preview &bull; {fileName}
              </span>
              <span className="text-[11px] text-slate-500">
                Rate: KES {waterRate}/m³
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Unit</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Previous</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Current</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Consumption</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Total (KES)</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {previewRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={
                        row.isValid
                          ? 'hover:bg-slate-50/80'
                          : 'bg-red-50/40 hover:bg-red-50/60'
                      }
                    >
                      <td className="py-2 px-3 font-bold text-slate-900">{row.unitNumber}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-500">
                        {row.previousReading.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800">
                        {row.currentReading.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-blue-700">
                        {row.isValid ? `${row.consumption.toFixed(2)} m³` : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-800">
                        {row.isValid
                          ? row.totalCharge.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })
                          : '—'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {row.isValid ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/50">
                            <span>✓</span> Ready
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200"
                            title={row.warning}
                          >
                            <span>!</span> {row.warning}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-slate-400 italic">
              Readings will be saved in <strong>draft</strong> status for auditing before being bundled into monthly tenant invoices or deducted from utility reserves.
            </p>
          </div>
        )}
      </div>
    </SlideOverDrawer>
  )
}

