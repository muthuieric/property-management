import React from 'react'
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ReconciliationCommandCenter, { ReconciliationTransaction } from './components/ReconciliationCommandCenter'
import BulkPaymentUploaderTrigger from '../components/BulkPaymentUploaderTrigger'

export const dynamic = 'force-dynamic'

interface ReconciliationPageProps {
  searchParams: Promise<{
    property_id?: string
    message?: string
  }>
}

export default async function ReconciliationPage({ searchParams }: ReconciliationPageProps) {
  const resolvedSearchParams = await searchParams
  const initialPropertyId = resolvedSearchParams.property_id || ''

  const supabase = await createClient()
  const { agencyId, role, userId } = await getUserAgencyContext()

  // Access check: only agency owners and property managers can access reconciliation
  if (role !== 'agency_owner' && role !== 'property_manager') {
    redirect('/dashboard?message=Unauthorized: Access to financial reconciliation is restricted.')
  }

  // 1. Fetch properties for filter dropdown
  const { data: propertiesData } = await supabase
    .from('properties')
    .select('id, name, manager_id')
    .eq('agency_id', agencyId)
    .order('name', { ascending: true })

  const allProperties = propertiesData || []
  // If property coordinator, filter to assigned properties
  const accessibleProperties =
    role === 'agency_owner'
      ? allProperties
      : allProperties.filter((p) => p.manager_id === userId)

  const propertyOptions = accessibleProperties.map((p) => ({
    id: p.id,
    name: p.name,
  }))

  // 2. Fetch income transactions
  const { data: rawTransactions } = await supabase
    .from('transactions')
    .select(`
      id,
      receipt_id,
      property_id,
      unit_id,
      tenant_id,
      transaction_type,
      amount,
      transaction_date,
      description,
      status,
      payment_method,
      external_reference,
      created_at,
      properties ( id, name ),
      units ( id, unit_number ),
      tenants ( id, first_name, last_name, phone_number, email )
    `)
    .eq('agency_id', agencyId)
    .in('transaction_type', ['income', 'payment'])
    .order('transaction_date', { ascending: false })

  const transactions = (rawTransactions || []) as unknown as ReconciliationTransaction[]

  // 3. Compute KPI summary statistics
  const pendingList = transactions.filter((t) => t.status === 'pending')
  const verifiedList = transactions.filter((t) => t.status === 'verified' || t.status === null)

  const totalPendingCount = pendingList.length
  const totalPendingAmount = pendingList.reduce((sum, t) => sum + Number(t.amount || 0), 0)

  const totalVerifiedCount = verifiedList.length
  const totalVerifiedAmount = verifiedList.reduce((sum, t) => sum + Number(t.amount || 0), 0)

  const totalGrossAmount = totalPendingAmount + totalVerifiedAmount
  const reconciliationRate =
    totalGrossAmount > 0
      ? Math.round((totalVerifiedAmount / totalGrossAmount) * 100)
      : 100

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 text-slate-900">
      {/* HEADER SECTION */}
      <header className="flex flex-col md:flex-row md:items-end justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/dashboard/financials"
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors inline-flex items-center gap-1"
            >
              &larr; Financial Ledger
            </Link>
            <span className="text-slate-300">&bull;</span>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-900 text-white shadow-xs">
              Payment Command Center
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Payment Reconciliation Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Review bulk-uploaded M-Pesa &amp; bank settlement statements, filter by estate, and officially verify transactions to reconcile tenant ledgers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <BulkPaymentUploaderTrigger
            properties={propertyOptions}
            defaultPropertyId={initialPropertyId}
          />
        </div>
      </header>

      {/* EXECUTIVE BENTO KPI METRICS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Pending Verification Card */}
        <div className="bg-white border border-amber-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500" />
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Pending Reconciliation
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                Action Required
              </span>
            </div>
            <p className="text-3xl font-black tracking-tight text-amber-950 tabular-nums my-1">
              KES {totalPendingAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Awaiting official signoff</span>
            <span className="font-bold text-amber-800">{totalPendingCount} payments</span>
          </div>
        </div>

        {/* Verified Revenue Card */}
        <div className="bg-white border border-emerald-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-600" />
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Verified &amp; Reconciled
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                Cleared
              </span>
            </div>
            <p className="text-3xl font-black tracking-tight text-emerald-800 tabular-nums my-1">
              KES {totalVerifiedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Credited to tenant ledgers</span>
            <span className="font-bold text-emerald-800">{totalVerifiedCount} verified</span>
          </div>
        </div>

        {/* Reconciliation Health Rate */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Reconciliation Rate
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Ledger Health
              </span>
            </div>
            <div className="flex items-baseline gap-2 my-1">
              <span className="text-3xl font-black tracking-tight text-slate-900 tabular-nums">
                {reconciliationRate}%
              </span>
              <span className="text-xs text-slate-500 font-medium">cleared</span>
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Total portfolio inflows</span>
            <span className="font-bold text-slate-800">
              KES {totalGrossAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* MAIN COMMAND CENTER INTERACTIVE COMPONENT */}
      <ReconciliationCommandCenter
        properties={propertyOptions}
        transactions={transactions}
        initialPropertyId={initialPropertyId}
      />
    </div>
  )
}

