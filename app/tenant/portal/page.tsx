'use client'

import { useEffect, useState } from 'react'
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
import { getTenantProfile, getTenantInvoices, type TenantInvoice, type TenantProfile } from './actions'

const columnHelper = createColumnHelper<TenantInvoice>()

const COLUMNS: any[] = [
  columnHelper.accessor('invoiceNumber', {
    header: 'Invoice No.',
    meta: { width: '140px' },
  }),
  columnHelper.accessor('billingMonth', {
    header: 'Billing Month',
    meta: { width: '120px' },
    cell: (info) => {
      const value = info.getValue() as string
      return new Date(value).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    },
  }),
  columnHelper.accessor('unitNumber', {
    header: 'Unit',
    meta: { width: '100px' },
  }),
  columnHelper.accessor('totalAmount', {
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
  columnHelper.accessor('pdfUrl', {
    header: 'PDF',
    meta: { width: '80px' },
    cell: (info) => {
      const row = info.row.original as TenantInvoice
      return row.pdfUrl ? (
        <Link
          href={row.pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-800 underline underline-offset-4"
        >
          Download
        </Link>
      ) : (
        <span className="text-[10px] text-slate-400">—</span>
      )
    },
  }),
]

export default function TenantPortalPage() {
  const [profile, setProfile] = useState<TenantProfile | null>(null)
  const [invoices, setInvoices] = useState<TenantInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const density = useDashboardStore((s) => s.density)
  const columnVisibility = useDashboardStore((s) => s.columnVisibility)

  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(25)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const [profResult, invResult] = await Promise.all([
          getTenantProfile(),
          getTenantInvoices(),
        ])
        setProfile(profResult.profile)
        setInvoices(invResult.invoices)
        if (profResult.error) setError(profResult.error)
        if (invResult.error) setError(invResult.error)
      } catch (err) {
        console.error(err)
        setError('Failed to load tenant portal')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const from = Math.min(pageIndex * pageSize + 1, invoices.length)
  const to = Math.min((pageIndex + 1) * pageSize, invoices.length)
  const visibleRows = invoices.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)

  const totalOutstanding = invoices
    .filter((i) => i.status !== 'paid')
    .reduce((sum, i) => sum + i.totalAmount, 0)

  const handlePagination = ({ pageIndex: nextIndex, pageSize: nextSize }: { pageIndex: number; pageSize: number }) => {
    setPageIndex(nextIndex)
    setPageSize(nextSize)
  }

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        <p className="mt-4 text-sm text-slate-500">Loading tenant portal...</p>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="p-8 max-w-md mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h2 className="text-lg font-bold text-red-900 mb-2">Access Denied</h2>
          <p className="text-red-700">{error ?? 'Tenant profile not found'}</p>
        </div>
      </div>
    )
  }

  const initials = `${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}`.toUpperCase()

  return (
    <div className="p-4 sm:p-8 max-w-[1400px] mx-auto space-y-6 text-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-900 text-white shadow-xs">
            Tenant Portal
          </span>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 font-sans mt-1">
            Tenant Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            View your invoices, download PDFs, and track your lease.
          </p>
        </div>
        <Link
          href="/auth/signout"
          className="text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors underline underline-offset-4"
        >
          Sign Out
        </Link>
      </div>

      {/* TENANT PROFILE */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-lg">
              {initials}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {profile.first_name} {profile.last_name}
              </h2>
              <p className="text-sm text-slate-500">
                {profile.unitNumber ? `Unit ${profile.unitNumber}` : 'No unit assigned'} •
                {profile.propertyName ?? 'No property'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Outstanding Balance
              </div>
              <div className="text-2xl font-black text-red-600">
                KES {totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-slate-100 pt-4">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Lease Start
            </div>
            <div className="text-sm font-medium text-slate-900 mt-1">
              {profile.leaseStartDate ? new Date(profile.leaseStartDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Lease Expiry
            </div>
            <div className="text-sm font-medium text-slate-900 mt-1">
              {profile.leaseEndDate ? new Date(profile.leaseEndDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Base Rent
            </div>
            <div className="text-sm font-medium text-slate-900 mt-1">
              {profile.baseRent !== null ? `KES ${profile.baseRent.toLocaleString()}` : '—'}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Escalation
            </div>
            <div className="text-sm font-medium text-slate-900 mt-1">
              {profile.escalationPercentage !== null ? `${profile.escalationPercentage}%` : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* OUTSTANDING BALANCE ALERT */}
      {totalOutstanding > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-red-700 font-semibold">⚠️</span>
            <div>
              <div className="text-[11px] font-bold text-red-700 uppercase tracking-wider">
                Outstanding Balance Due
              </div>
              <div className="text-sm text-red-900 font-semibold mt-0.5">
                KES {totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-red-700 mt-1">
                Arrears attract a 2% monthly interest penalty. Please settle promptly to avoid penalties.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INVOICES TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500">Your Invoices</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
              {invoices.length} invoice{invoices.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            Showing {from} to {to} of {invoices.length}
          </div>
        </div>
        <VirtualizedDataTable<TenantInvoice>
          columns={COLUMNS}
          data={visibleRows}
          totalCount={invoices.length}
          pageIndex={pageIndex}
          pageSize={pageSize}
          density={density}
          columnVisibility={columnVisibility}
          loading={false}
          onPaginationChange={handlePagination}
        />
        {invoices.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-xs text-slate-500">
              No invoices found for your account.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
