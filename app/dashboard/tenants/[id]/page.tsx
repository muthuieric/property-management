import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTenantLedger } from './actions'
import TenantFinancialTabs from './components/TenantFinancialTabs'
import RecordPaymentTrigger from './components/RecordPaymentTrigger'

export const dynamic = 'force-dynamic'

interface TenantDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function TenantFinancialProfilePage({ params }: TenantDetailPageProps) {
  const { id } = await params

  const data = await getTenantLedger(id)

  if (!data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-lg">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-rose-200">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Tenant Profile Not Found</h2>
          <p className="text-xs text-slate-500 mb-6">
            The requested resident record could not be found or you do not have permission to view it.
          </p>
          <Link
            href="/dashboard/tenants"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs"
          >
            &larr; Return to Tenants Directory
          </Link>
        </div>
      </div>
    )
  }

  const { tenant, activeLease, invoices, transactions, kpi } = data

  const fullName = `${tenant.first_name || ''} ${tenant.last_name || ''}`.trim() || 'Resident'
  const hasArrears = kpi.outstanding_balance > 0

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 text-slate-900">
      {/* TOP NAVIGATION & PROFILE HEADER */}
      <header className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 gap-6">
        <div>
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
            <Link href="/dashboard/tenants" className="hover:text-slate-900 transition-colors">
              Tenants Directory
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-bold">{fullName}</span>
            <span>/</span>
            <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px]">
              Financial Ledger
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white font-black text-base flex items-center justify-center shadow-xs">
              {tenant.first_name?.[0] || 'T'}
              {tenant.last_name?.[0] || ''}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                  {fullName}
                </h1>
                {tenant.is_active ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Active Tenant
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    Inactive
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {activeLease ? (
                  <span className="font-semibold text-slate-800">
                    Unit #{activeLease.unit_number} &bull; {activeLease.property_name}
                  </span>
                ) : (
                  <span className="italic text-slate-400">No active premises lease</span>
                )}
                {tenant.email && <span>{tenant.email}</span>}
                {tenant.phone_number && <span className="font-mono">{tenant.phone_number}</span>}
                {tenant.id_number && (
                  <span className="font-mono text-slate-400">ID: {tenant.id_number}</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Action Button: Record Manual Payment */}
        <div className="flex items-center gap-3">
          <RecordPaymentTrigger
            tenantId={tenant.id}
            tenantName={fullName}
            unitNumber={activeLease?.unit_number}
            propertyName={activeLease?.property_name}
          />
        </div>
      </header>

      {/* =====================================================================
          PART 2: BENTO KPI HEADER (TOTAL BILLED, TOTAL PAID, OUTSTANDING BALANCE)
          ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Total Billed Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Invoiced (Billed)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                {invoices.length} cycles
              </span>
            </div>
            <div className="text-3xl font-black tracking-tight text-slate-900 tabular-nums my-1">
              KES {kpi.total_invoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Cumulative rent &amp; metered utilities</span>
            <span className="font-mono text-[11px] text-slate-400">Gross Due</span>
          </div>
        </div>

        {/* Total Paid Card (Green Emerald) */}
        <div className="bg-white border border-emerald-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-600" />
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Settled (Paid)
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Verified Inflows
              </span>
            </div>
            <div className="text-3xl font-black tracking-tight text-emerald-700 tabular-nums my-1">
              KES {kpi.total_paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Reconciled on institutional ledger</span>
            <span className="font-bold text-emerald-800">{transactions.length} payments</span>
          </div>
        </div>

        {/* Outstanding Balance Card (Styled RED if > 0, GREEN if 0) */}
        <div
          className={`border rounded-2xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all ${
            hasArrears
              ? 'bg-rose-50/40 border-rose-300'
              : 'bg-emerald-50/40 border-emerald-300'
          }`}
        >
          <div
            className={`absolute top-0 left-0 right-0 h-1.5 ${
              hasArrears ? 'bg-rose-600' : 'bg-emerald-500'
            }`}
          />
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Outstanding Balance
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  hasArrears
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}
              >
                {hasArrears ? 'Arrears Due' : 'Fully Settled'}
              </span>
            </div>
            <div
              className={`text-3xl font-black tracking-tight tabular-nums my-1 ${
                hasArrears ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              KES {kpi.outstanding_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-200/80 flex items-center justify-between text-xs">
            <span className={hasArrears ? 'text-rose-700 font-medium' : 'text-emerald-700 font-medium'}>
              {hasArrears ? 'Unpaid rent / utility charges' : 'Zero outstanding balance'}
            </span>
            <span className="font-mono text-[11px] text-slate-400">Net Position</span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          PART 2: FINANCIAL DRILL-DOWN TABS (INVOICES VS PAYMENTS)
          ===================================================================== */}
      <TenantFinancialTabs
        invoices={invoices}
        transactions={transactions}
        unitNumber={activeLease?.unit_number}
      />
    </div>
  )
}

