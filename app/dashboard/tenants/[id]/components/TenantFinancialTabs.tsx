'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { TenantInvoice, TenantPaymentTransaction } from '../actions'

interface TenantFinancialTabsProps {
  invoices: TenantInvoice[]
  transactions: TenantPaymentTransaction[]
  unitNumber?: string
}

export default function TenantFinancialTabs({
  invoices = [],
  transactions = [],
  unitNumber = 'N/A',
}: TenantFinancialTabsProps) {
  const [activeTab, setActiveTab] = useState<'invoices' | 'payments'>('invoices')

  return (
    <div className="space-y-4">
      {/* Tabs Switcher */}
      <div className="flex items-center p-1 bg-slate-100/90 rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('invoices')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer ${
            activeTab === 'invoices'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Invoice History (The Debt)</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'invoices'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {invoices.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('payments')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer ${
            activeTab === 'payments'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span>Payment History (The Income)</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'payments'
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {transactions.length}
          </span>
        </button>
      </div>

      {/* =====================================================================
          TAB 1: INVOICE HISTORY (THE DEBT)
          ===================================================================== */}
      {activeTab === 'invoices' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Billed Invoice Statement</h3>
              <p className="text-xs text-slate-500">Record of monthly contractual rent and bundled utility meter readings.</p>
            </div>
            <span className="text-xs font-medium text-slate-400 font-mono">
              Unit #{unitNumber}
            </span>
          </div>

          {invoices.length === 0 ? (
            <div className="py-14 text-center text-xs text-slate-400 italic">
              No formal invoices generated for this tenant yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Billing Month</th>
                    <th className="py-3 px-4 text-right">Base Rent (KES)</th>
                    <th className="py-3 px-4 text-right">Utilities (KES)</th>
                    <th className="py-3 px-4 text-right">Total Billed (KES)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Generated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => {
                    const formattedMonth = new Date(inv.billing_month).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {formattedMonth}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-slate-700 tabular-nums">
                          {inv.base_rent_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums">
                          {inv.utilities_amount > 0 ? (
                            <span className="font-semibold text-cyan-700">
                              {inv.utilities_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">0.00</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                          KES {inv.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {inv.status === 'paid' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              Paid
                            </span>
                          ) : inv.status === 'partial' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                              Partial
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                              Unpaid
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-400 whitespace-nowrap">
                          {new Date(inv.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2: PAYMENT HISTORY (THE INCOME)
          ===================================================================== */}
      {activeTab === 'payments' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Payment &amp; Inflow Ledger</h3>
              <p className="text-xs text-slate-500">Chronological history of rent, utilities, and deposit payments made by the resident.</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              Verified Receipts
            </span>
          </div>

          {transactions.length === 0 ? (
            <div className="py-14 text-center text-xs text-slate-400 italic">
              No payments logged for this tenant yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Payment Date</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-center">Channel</th>
                    <th className="py-3 px-4">Reference Code</th>
                    <th className="py-3 px-4 text-right">Amount Paid (KES)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Digital Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx) => {
                    const isCredit = tx.transaction_type === 'income' || tx.transaction_type === 'payment'
                    const isVerified = tx.status === 'verified' || tx.status === null
                    const isPending = tx.status === 'pending'

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                          {new Date(tx.transaction_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {tx.description}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {tx.payment_method || 'MPESA'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-700 text-[11px] whitespace-nowrap">
                          {tx.external_reference ? (
                            <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200 font-medium">
                              {tx.external_reference}
                            </span>
                          ) : (
                            <span className="text-slate-400">&mdash;</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                          KES {Number(tx.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {isVerified ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              Verified
                            </span>
                          ) : isPending ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse mr-1" />
                              Pending
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                              Bounced
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {isCredit ? (
                            <Link
                              href={`/portal/receipts/${tx.receipt_id || tx.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span>Receipt</span>
                            </Link>
                          ) : (
                            <span className="text-slate-300">&mdash;</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

