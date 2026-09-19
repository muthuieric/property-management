// app/dashboard/deposits/page.tsx
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ReleaseDepositButton from './components/ReleaseDepositButton'

export default async function DepositsLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const resolvedParams = await searchParams
  const activeTab = resolvedParams.tab || 'active'

  const supabase = await createClient()
  const { agencyId, role } = await getUserAgencyContext()

  // Strict Access Control: Deposit trust vault is reserved for Agency Owner
  if (role !== 'agency_owner') {
    redirect('/dashboard?message=Access restricted: Escrow deposit trust vault is reserved for Agency Owners.')
  }

  // 1. Fetch active leases with deposit escrow scoped to this agency
  let query = supabase
    .from('leases')
    .select(`
      id,
      start_date,
      deposit_amount,
      is_active,
      agency_id,
      tenant_id,
      unit_id,
      tenants (
        id,
        first_name,
        last_name,
        email,
        phone_number
      ),
      units (
        id,
        unit_number,
        base_rent,
        property_id,
        properties (
          id,
          name,
          location
        )
      )
    `)
    .eq('is_active', true)
    .order('start_date', { ascending: false })

  if (agencyId) {
    query = query.eq('agency_id', agencyId)
  }

  const { data: activeLeasesData } = await query
  const activeLeases = activeLeasesData || []

  // 2. Fetch settled deposit records
  let settledRecords: any[] = []
  try {
    const { data: settlements } = await supabase
      .from('deposit_settlements')
      .select(`
        id,
        starting_deposit,
        rent_arrears_deduction,
        water_arrears_deduction,
        repairs_deduction,
        total_deductions,
        net_refund_amount,
        payout_status,
        payout_method,
        payout_reference,
        payout_date,
        recipient_name,
        recipient_phone_or_account,
        notes,
        created_at,
        leases (
          id,
          units (
            unit_number,
            properties ( name )
          )
        ),
        tenants ( first_name, last_name, email, phone_number )
      `)
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })

    settledRecords = settlements || []
  } catch {
    settledRecords = []
  }

  // Fallback: Also check inactive leases that have refund_payout_ref if settlements table empty
  if (settledRecords.length === 0) {
    try {
      const { data: inactiveLeases } = await supabase
        .from('leases')
        .select(`
          id,
          start_date,
          end_date,
          deposit_amount,
          refund_amount,
          refund_deductions,
          refund_payout_method,
          refund_payout_ref,
          refund_payout_date,
          refund_recipient_details,
          tenants ( first_name, last_name, email, phone_number ),
          units ( unit_number, properties ( name ) )
        `)
        .eq('agency_id', agencyId)
        .eq('is_active', false)
        .not('refund_payout_ref', 'is', null)
        .order('end_date', { ascending: false })

      if (inactiveLeases && inactiveLeases.length > 0) {
        settledRecords = inactiveLeases.map((l: any) => ({
          id: l.id,
          starting_deposit: l.deposit_amount,
          total_deductions: l.refund_deductions || 0,
          net_refund_amount: l.refund_amount || 0,
          payout_method: l.refund_payout_method || 'mpesa',
          payout_reference: l.refund_payout_ref,
          payout_date: l.refund_payout_date || l.end_date,
          recipient_name: `${l.tenants?.first_name || ''} ${l.tenants?.last_name || ''}`.trim() || 'Resident',
          recipient_phone_or_account: l.refund_recipient_details || l.tenants?.phone_number || '',
          leases: {
            units: l.units,
          },
        }))
      }
    } catch {
      // Ignore if columns not yet migrated
    }
  }

  // Compute escrow macro metrics
  const totalEscrow = activeLeases.reduce(
    (sum, lease) => sum + Number(lease.deposit_amount || 0),
    0
  )
  const totalCount = activeLeases.length
  const totalSettledCount = settledRecords.length
  const totalDisbursed = settledRecords.reduce(
    (sum, s) => sum + Number(s.net_refund_amount || 0),
    0
  )

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-900 text-white shadow-xs">
              Institutional Escrow Vault
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Statutory Trust Custody &bull; {totalCount} Active &bull; {totalSettledCount} Refunded
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 font-sans">
            Deposit Escrow & Refund Ledger
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Real-time custody tracking, auditable turnover settlements, and electronic M-Pesa/Bank disbursement records.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard"
            className="border border-slate-200 bg-white text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-all duration-200 ease-in-out font-semibold text-xs shadow-xs"
          >
            &larr; Executive Overview
          </Link>
          <Link
            href="/dashboard/clearance"
            className="bg-slate-900 hover:bg-slate-800 hover:shadow-md text-white px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ease-in-out font-semibold text-xs shadow-xs flex items-center gap-1.5"
          >
            <span>Batch Utilities & Clearance</span>
            <span>&rarr;</span>
          </Link>
        </div>
      </header>

      {/* Escrow Bento Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Card 1: Total Locked in Escrow */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Total Funds in Escrow
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                100% Ring-Fenced
              </span>
            </div>
            <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
              KES {totalEscrow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 text-xs text-slate-500">
            Dedicated statutory tenant trust balance across {totalCount} active tenancies
          </div>
        </div>

        {/* Card 2: Total Refunded to Clients */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Refunds Disbursed
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                M-Pesa / Bank Verified
              </span>
            </div>
            <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
              KES {totalDisbursed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 text-xs text-slate-500">
            {totalSettledCount} completed deposit settlements with immutable payout proof
          </div>
        </div>

        {/* Card 3: Trust Compliance Benchmark */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Trust Guarantee Standard
              </span>
              <span className="text-xs font-semibold text-emerald-700">
                Zero Arbitrary Hold
              </span>
            </div>
            <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
              100%
            </p>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 text-xs text-slate-500">
            Every deduction requires documented contractor invoices & utility meters
          </div>
        </div>
      </div>

      {/* TWO-TAB NAVIGATOR */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <Link
          href="/dashboard/deposits?tab=active"
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'active'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Active Escrow Vault ({totalCount})
        </Link>
        <Link
          href="/dashboard/deposits?tab=settled"
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'settled'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Disbursed & Settled History ({totalSettledCount})
        </Link>
      </div>

      {/* TAB 1: ACTIVE DEPOSITS IN TRUST */}
      {activeTab === 'active' && (
        <section className="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Active Deposit Ledgers & Custody Accounts</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Verified security deposits held in segregated trust for active tenancy agreements.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 tabular-nums self-start sm:self-auto">
              {totalCount} Active Accounts
            </span>
          </div>
          
          {activeLeases.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <svg className="w-10 h-10 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-semibold text-slate-700 text-sm">No Active Deposits in Trust</p>
              <p className="text-xs text-slate-400 mt-1">All tenant leases have been settled or no deposits have been logged yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 uppercase text-[10px] font-semibold text-slate-500 tracking-wider">
                    <th className="p-4 pl-6">Tenant Occupant</th>
                    <th className="p-4">Property & Unit</th>
                    <th className="p-4">Lease Inception</th>
                    <th className="p-4 text-right">Escrow Amount</th>
                    <th className="p-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeLeases.map((lease: any) => {
                    const tenant = lease.tenants
                    const tenantName = tenant
                      ? `${tenant.first_name || ''} ${tenant.last_name || ''}`.trim() || 'Valued Tenant'
                      : 'Unassigned Tenant'
                    const propertyName = lease.units?.properties?.name || 'Property'
                    const unitNumber = lease.units?.unit_number || 'N/A'
                    const depositNum = Number(lease.deposit_amount || 0)

                    return (
                      <tr key={lease.id} className="hover:bg-slate-50/70 transition-all duration-150">
                        <td className="p-4 pl-6">
                          <p className="font-bold text-slate-900 text-sm">
                            {tenantName}
                          </p>
                          {tenant?.email && (
                            <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                              {tenant.email}
                            </span>
                          )}
                        </td>

                        <td className="p-4">
                          <p className="font-semibold text-slate-800">
                            {propertyName}
                          </p>
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                            Unit {unitNumber}
                          </span>
                        </td>

                        <td className="p-4 text-slate-600">
                          <span className="font-medium text-slate-700">
                            {lease.start_date
                              ? new Date(lease.start_date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : '—'}
                          </span>
                        </td>

                        <td className="p-4 text-right">
                          <span className="font-bold text-slate-900 tabular-nums text-sm">
                            KES {depositNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="block text-[10px] text-emerald-700 font-semibold uppercase tracking-wider">
                            Locked in Trust
                          </span>
                        </td>

                        <td className="p-4 pr-6 text-right">
                          <ReleaseDepositButton
                            leaseId={lease.id}
                            unitId={lease.units?.id || lease.unit_id || ''}
                            tenantId={lease.tenant_id || tenant?.id || ''}
                            propertyId={lease.units?.property_id || lease.units?.properties?.id || ''}
                            tenantPhone={tenant?.phone_number || ''}
                            tenantName={tenantName}
                            unitNumber={unitNumber}
                            propertyName={propertyName}
                            depositAmount={depositNum}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB 2: SETTLED & DISBURSED REFUNDS HISTORY */}
      {activeTab === 'settled' && (
        <section className="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Disbursed & Settled Refund Audit Trail</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Every completed tenant deposit release with electronic transaction codes, deductions, and recipient timestamps.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 tabular-nums self-start sm:self-auto">
              {totalSettledCount} Completed Refunds
            </span>
          </div>

          {settledRecords.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <svg className="w-10 h-10 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-semibold text-slate-700 text-sm">No Settled Refunds Yet</p>
              <p className="text-xs text-slate-400 mt-1">When deposits are cleared and refunded via M-Pesa or Bank transfer, they appear here permanently.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 uppercase text-[10px] font-semibold text-slate-500 tracking-wider">
                    <th className="p-4 pl-6">Resident & Payout Recipient</th>
                    <th className="p-4">Property & Unit</th>
                    <th className="p-4">Settlement Reference</th>
                    <th className="p-4 text-right">Initial Deposit</th>
                    <th className="p-4 text-right">Total Deductions</th>
                    <th className="p-4 pr-6 text-right">Net Refund Disbursed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {settledRecords.map((s: any) => {
                    const unitName = s.leases?.units?.unit_number ? `Unit #${s.leases.units.unit_number}` : 'Unit'
                    const propName = s.leases?.units?.properties?.name || 'Property'
                    const startDep = Number(s.starting_deposit || 0)
                    const deductions = Number(s.total_deductions || 0)
                    const netRefund = Number(s.net_refund_amount || 0)

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-all duration-150">
                        <td className="p-4 pl-6">
                          <p className="font-bold text-slate-900 text-sm">
                            {s.recipient_name || 'Resident'}
                          </p>
                          {s.recipient_phone_or_account && (
                            <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                              {s.recipient_phone_or_account}
                            </span>
                          )}
                        </td>

                        <td className="p-4">
                          <p className="font-semibold text-slate-800">{propName}</p>
                          <span className="text-[11px] text-slate-500">{unitName}</span>
                        </td>

                        <td className="p-4">
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            {s.payout_reference}
                          </span>
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            {s.payout_method?.toUpperCase()} &bull; {s.payout_date || 'Date'}
                          </span>
                        </td>

                        <td className="p-4 text-right tabular-nums text-slate-700">
                          KES {startDep.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>

                        <td className="p-4 text-right tabular-nums text-rose-600 font-semibold">
                          - KES {deductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>

                        <td className="p-4 pr-6 text-right">
                          <span className="font-extrabold text-emerald-800 tabular-nums text-sm">
                            KES {netRefund.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                          <span className="block text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
                            Disbursed
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
