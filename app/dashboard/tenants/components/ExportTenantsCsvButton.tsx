'use client'

import { useState } from 'react'
import Papa from 'papaparse'

export interface ExportTenantRecord {
  id: string
  first_name: string
  last_name: string
  email: string
  phone_number: string
  is_active: boolean
  unit_number?: string
  property_name?: string
  rent?: number | null
  deposit?: number | null
}

interface ExportTenantsCsvButtonProps {
  tenants: ExportTenantRecord[]
}

export default function ExportTenantsCsvButton({ tenants }: ExportTenantsCsvButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = () => {
    setIsExporting(true)

    try {
      // Map tenant data ensuring masked numbers remain masked for privacy compliance
      const rows = tenants.map((t) => ({
        'Tenant ID': t.id,
        'Full Name': `${t.first_name || ''} ${t.last_name || ''}`.trim(),
        'Email Address': t.email || '',
        'Phone Number': t.phone_number || 'N/A',
        'Property Site': t.property_name || 'No assigned property',
        'Unit Number': t.unit_number || 'No active lease',
        'Monthly Rent (KES)': t.rent ?? 0,
        'Deposit in Trust (KES)': t.deposit ?? 0,
        'Account Status': t.is_active ? 'Active' : 'Suspended',
      }))

      const csvString = Papa.unparse(rows, {
        header: true,
      })

      const blob = new Blob(['\uFEFF' + csvString], {
        type: 'text/csv;charset=utf-8;',
      })

      const url = URL.createObjectURL(blob)
      const downloadLink = document.createElement('a')
      const timestamp = new Date().toISOString().slice(0, 10)

      downloadLink.href = url
      downloadLink.setAttribute('download', `Tenant_Directory_Export_${timestamp}.csv`)
      document.body.appendChild(downloadLink)
      downloadLink.click()
      document.body.removeChild(downloadLink)
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      console.error('Failed to generate tenant CSV export:', err)
      alert('Failed to export tenant directory CSV. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={isExporting || tenants.length === 0}
      className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
      title="Download Tenant Directory CSV (Respects coordinator PII privacy masking)"
    >
      <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <span>{isExporting ? 'Exporting...' : 'Export Directory (CSV)'}</span>
    </button>
  )
}

