'use client'

import { useState } from 'react'
import Papa from 'papaparse'

export interface UnpaidTenantItem {
  name: string
  unit: string
  property: string
  phone: string
  expectedRent: number
  amountDue: number
}

export interface PartialPaymentItem {
  name: string
  unit: string
  property: string
  phone: string
  expectedRent: number
  paidAmount: number
  amountDue: number
  txCodes: string
}

export interface UntracedTransactionItem {
  description: string
  date: string
  amount: number
  txCode: string
}

export interface PaidOverpaidItem {
  name: string
  unit: string
  property: string
  phone: string
  expectedRent: number
  paidAmount: number
  txCodes: string
  status: 'Fully Paid' | 'Overpaid'
}

export interface RentReportData {
  billingPeriod: string
  generatedAt: string
  agencyName?: string
  summaryMetrics: {
    expectedRent: number
    collectedRent: number
    collectionRate: number
    fullyPaidCount: number
    partialPayCount: number
    unpaidCount: number
    untracedCount: number
  }
  unpaidTenants: UnpaidTenantItem[]
  partialPayments: PartialPaymentItem[]
  untracedTransactions: UntracedTransactionItem[]
  paidOverpaid: PaidOverpaidItem[]
}

interface ExportReportButtonProps {
  reportData: RentReportData
  className?: string
}

export default function ExportReportButton({ reportData, className = '' }: ExportReportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = () => {
    try {
      setIsExporting(true)

      const rows: (string | number)[][] = [
        ['REAL ESTATE RENT PAYMENT SUMMARY REPORT'],
        ['Billing Period', reportData.billingPeriod],
        ['Generated At', reportData.generatedAt],
        ['Agency / Portfolio', reportData.agencyName || 'Institutional Property Portfolio'],
        [],
        ['==================== SUMMARY METRICS ===================='],
        ['Metric', 'Value'],
        ['Expected Rent (KES)', reportData.summaryMetrics.expectedRent.toFixed(2)],
        ['Collected Rent (KES)', reportData.summaryMetrics.collectedRent.toFixed(2)],
        ['Collection Rate (%)', `${reportData.summaryMetrics.collectionRate.toFixed(1)}%`],
        ['Fully Paid Accounts', reportData.summaryMetrics.fullyPaidCount],
        ['Partial Pay Accounts', reportData.summaryMetrics.partialPayCount],
        ['Unpaid Accounts', reportData.summaryMetrics.unpaidCount],
        ['Untraced / Unmatched Transactions', reportData.summaryMetrics.untracedCount],
        [],
        ['==================== SECTION 1: UNPAID TENANTS ===================='],
        ['Tenant Name', 'Leased Unit', 'Property Site', 'Phone Number', 'Expected Rent (KES)', 'Amount Due (KES)'],
      ]

      if (reportData.unpaidTenants.length === 0) {
        rows.push(['No unpaid tenants recorded for this billing cycle.', '', '', '', '', ''])
      } else {
        reportData.unpaidTenants.forEach((t) => {
          rows.push([
            t.name,
            t.unit,
            t.property,
            t.phone || 'N/A',
            t.expectedRent.toFixed(2),
            t.amountDue.toFixed(2),
          ])
        })
      }

      rows.push([])
      rows.push(['==================== SECTION 2: PARTIAL PAYMENTS ===================='])
      rows.push([
        'Tenant Name',
        'Leased Unit',
        'Property Site',
        'Phone Number',
        'Expected Rent (KES)',
        'Amount Paid (KES)',
        'Amount Due (KES)',
        'Tx Code(s)',
      ])

      if (reportData.partialPayments.length === 0) {
        rows.push(['No partial payments recorded for this billing cycle.', '', '', '', '', '', '', ''])
      } else {
        reportData.partialPayments.forEach((p) => {
          rows.push([
            p.name,
            p.unit,
            p.property,
            p.phone || 'N/A',
            p.expectedRent.toFixed(2),
            p.paidAmount.toFixed(2),
            p.amountDue.toFixed(2),
            p.txCodes || 'N/A',
          ])
        })
      }

      rows.push([])
      rows.push(['==================== SECTION 3: NEEDS REVIEW / UNTRACED TRANSACTIONS ===================='])
      rows.push(['Payer / Memo Description', 'Transaction Date', 'Amount Paid (KES)', 'Tx Code'])

      if (reportData.untracedTransactions.length === 0) {
        rows.push(['No untraced or unmatched transactions found.', '', '', ''])
      } else {
        reportData.untracedTransactions.forEach((u) => {
          rows.push([
            u.description,
            u.date,
            u.amount.toFixed(2),
            u.txCode || 'N/A',
          ])
        })
      }

      rows.push([])
      rows.push(['==================== SECTION 4: PAID & OVERPAID ===================='])
      rows.push([
        'Tenant Name',
        'Leased Unit',
        'Property Site',
        'Phone Number',
        'Expected Rent (KES)',
        'Amount Paid (KES)',
        'Tx Code(s)',
        'Settlement Status',
      ])

      if (reportData.paidOverpaid.length === 0) {
        rows.push(['No settled or overpaid tenants recorded for this billing cycle.', '', '', '', '', '', '', ''])
      } else {
        reportData.paidOverpaid.forEach((p) => {
          rows.push([
            p.name,
            p.unit,
            p.property,
            p.phone || 'N/A',
            p.expectedRent.toFixed(2),
            p.paidAmount.toFixed(2),
            p.txCodes || 'N/A',
            p.status,
          ])
        })
      }

      // Convert rows to CSV string with quotes where necessary
      const csvContent = Papa.unparse(rows, {
        quotes: false,
        skipEmptyLines: false,
      })

      // Include UTF-8 Byte Order Mark (BOM) for seamless Microsoft Excel rendering
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const sanitizedPeriod = reportData.billingPeriod.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
      const timestamp = new Date().toISOString().split('T')[0]
      const fileName = `Rent_Payment_Summary_Report_${sanitizedPeriod}_${timestamp}.csv`

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', fileName)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error exporting rent summary report:', err)
      alert('Failed to generate the report CSV. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={isExporting}
      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 shadow-xs cursor-pointer transition-all duration-200 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      title="Download Real Estate Rent Payment Summary Report (CSV)"
    >
      {isExporting ? (
        <svg
          className="w-3.5 h-3.5 animate-spin text-slate-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        <svg
          className="w-3.5 h-3.5 text-emerald-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
          />
        </svg>
      )}
      <span>{isExporting ? 'Generating CSV...' : 'Export Rent Summary'}</span>
    </button>
  )
}

