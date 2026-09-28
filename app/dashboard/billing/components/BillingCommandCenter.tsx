'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { InvoiceItem, updateInvoiceStatus } from '../actions'
import GenerateInvoicesModal from './GenerateInvoicesModal'

interface PropertyOption {
  id: string
  name: string
}

interface BillingCommandCenterProps {
  invoices: InvoiceItem[]
  properties: PropertyOption[]
  currentPropertyId?: string
  currentMonth?: string
}

export default function BillingCommandCenter({
  invoices = [],
  properties = [],
  currentPropertyId = '',
  currentMonth = '',
}: BillingCommandCenterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all')
  const [isPending, startTransition] = useTransition()

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextMonth = e.target.value
    const params = new URLSearchParams(searchParams.toString())
    if (nextMonth) {
      params.set('month', nextMonth)
    } else {
      params.delete('month')
    }
    router.push(`/dashboard/billing?${params.toString()}`)
  }

  const handlePropertyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextProp = e.target.value
    const params = new URLSearchParams(searchParams.toString())
    if (nextProp && nextProp !== 'ALL') {
      params.set('property_id', nextProp)
    } else {
      params.delete('property_id')
    }
    router.push(`/dashboard/billing?${params.toString()}`)
  }

  const handleToggleStatus = (invoiceId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'paid' ? 'unpaid' : 'paid'
    startTransition(async () => {
      await updateInvoiceStatus(invoiceId, newStatus)
      router.refresh()
    })
  }

  // Filtered invoices list
  const filteredInvoices = invoices.filter((inv) => {
    // Status filter
    if (statusFilter !== 'all' && inv.status !== statusFilter) {
      return false
    }
    // Search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      const matchesName = (inv.tenant_name || '').toLowerCase().includes(q)
      const matchesUnit = (inv.unit_number || '').toLowerCase().includes(q)
      const matchesProp = (inv.property_name || '').toLowerCase().includes(q)
      const matchesEmail = (inv.tenant_email || '').toLowerCase().includes(q)
      if (!matchesName && !matchesUnit && !matchesProp && !matchesEmail) {
        return false
      }
    }
    return true
  })

  return (
    <div className="space-y-6">
      {/* Filter and Command Action Bar */}
      <div className="p-4 bg-white rounded-xl shadow-xs border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Month / Year Picker */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Billing Period
            </label>
            <input
              type="month"
              value={currentMonth || ''}
              onChange={handleMonthChange}
              className="text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
            />
          </div>

          {/* Property Filter Selector */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Filter Building Site
            </label>
            <select
              value={currentPropertyId || 'ALL'}
              onChange={handlePropertyChange}
              className="text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
            >
              <option value="ALL">All Portfolio Properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters Shortcut */}
          {(currentMonth || currentPropertyId) && (
            <div className="self-end pb-1">
              <Link
                href="/dashboard/billing"
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Reset Filters
              </Link>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ease-in-out text-xs font-bold shadow-xs flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Generate Portfolio Invoices</span>
          </button>
        </div>
      </div>

      {/* Main Invoices Section */}
      <section className="bg-white shadow-xs border border-slate-200 rounded-xl overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800">Invoices Ledger</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {filteredInvoices.length} {filteredInvoices.length === 1 ? 'Invoice' : 'Invoices'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search tenant or unit..."
                className="text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all w-full sm:w-48"
              />
              <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Status Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('unpaid')}
                className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  statusFilter === 'unpaid'
                    ? 'bg-white text-amber-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Unpaid
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('paid')}
                className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  statusFilter === 'paid'
                    ? 'bg-white text-emerald-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Paid
              </button>
            </div>
          </div>
        </div>

        {/* Data Table */}
        {filteredInvoices.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="font-semibold text-slate-800 text-sm">No Invoices Found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {currentMonth || currentPropertyId
                ? 'No invoices match your selected period or property site.'
                : 'Click "Generate Portfolio Invoices" above to execute an automated monthly billing run.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 uppercase text-[10px] font-semibold text-slate-500 tracking-wider">
                  <th className="p-4 pl-6">Tenant &amp; Resident</th>
                  <th className="p-4">Unit &amp; Property</th>
                  <th className="p-4">Billing Month</th>
                  <th className="p-4 text-right">Contracted Rent</th>
                  <th className="p-4 text-right">Bundled Utilities</th>
                  <th className="p-4 text-right">Total Invoice</th>
                  <th className="p-4 text-center">Payment Status</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((invoice) => {
                  const monthName = new Date(invoice.billing_month).toLocaleString('en-US', {
                    month: 'short',
                    year: 'numeric',
                  })

                  return (
                    <tr key={invoice.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Tenant */}
                      <td className="p-4 pl-6 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                            {invoice.tenant_name?.[0] || 'R'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">
                              {invoice.tenant_name}
                            </p>
                            <span className="text-[11px] text-slate-400 block font-mono">
                              {invoice.tenant_phone || invoice.tenant_email || '—'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Unit & Property */}
                      <td className="p-4 whitespace-nowrap">
                        <p className="font-semibold text-slate-900">
                          {invoice.property_name}
                        </p>
                        <span className="text-[11px] text-slate-500 block">
                          Unit {invoice.unit_number}
                        </span>
                      </td>

                      {/* Billing Month */}
                      <td className="p-4 whitespace-nowrap font-medium text-slate-700">
                        {monthName}
                      </td>

                      {/* Rent */}
                      <td className="p-4 text-right whitespace-nowrap font-mono text-slate-600 tabular-nums">
                        KES {invoice.base_rent_amount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      {/* Utilities */}
                      <td className="p-4 text-right whitespace-nowrap font-mono tabular-nums">
                        {invoice.utilities_amount > 0 ? (
                          <span className="text-blue-700 font-semibold">
                            KES {invoice.utilities_amount.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Total */}
                      <td className="p-4 text-right whitespace-nowrap font-mono font-bold text-slate-900 tabular-nums text-sm">
                        KES {invoice.total_amount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      {/* Payment Status */}
                      <td className="p-4 text-center whitespace-nowrap">
                        {invoice.status === 'paid' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Paid
                          </span>
                        )}
                        {invoice.status === 'unpaid' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Unpaid
                          </span>
                        )}
                        {invoice.status === 'partial' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Partial
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-4 pr-6 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(invoice.id, invoice.status)}
                          disabled={isPending}
                          className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                            invoice.status === 'paid'
                              ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                              : 'text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 border border-emerald-200'
                          }`}
                        >
                          {invoice.status === 'paid' ? 'Mark Unpaid' : 'Mark as Paid'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Monthly Invoicing Modal */}
      <GenerateInvoicesModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        properties={properties}
        defaultPropertyId={currentPropertyId || 'ALL'}
      />
    </div>
  )
}

