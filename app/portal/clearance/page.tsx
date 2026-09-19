// app/portal/clearance/page.tsx
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PrintCertificateButton from './PrintCertificateButton'

export default async function TenantClearancePage() {
  const supabase = await createClient()

  // 1. Authenticate user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  // 2. Fetch tenant profile for auth.uid()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle()

  let lease: any = null
  let deductions: any[] = []
  let billedTickets: any[] = []
  let settlementRecord: any = null

  if (tenant) {
    // 3. Fetch the tenant's lease (active or most recent)
    const { data: tenantLeases } = await supabase
      .from('leases')
      .select(`
        id,
        start_date,
        end_date,
        deposit_amount,
        deposit_months,
        is_active,
        refund_status,
        refund_amount,
        refund_deductions,
        refund_payout_method,
        refund_payout_ref,
        refund_payout_date,
        refund_recipient_details,
        units (
          id,
          unit_number,
          base_rent,
          water_meter_number,
          kplc_meter_number,
          properties (
            name,
            location
          )
        )
      `)
      .or(`tenant_id.eq.${tenant.id},tenant_id.eq.${user.id}`)
      .order('start_date', { ascending: false })
      .limit(1)

    if (tenantLeases && tenantLeases.length > 0) {
      lease = tenantLeases[0]
    }

    // 4. Fetch deductions from transactions table (Authoritative Ledger)
    const { data: rawTransactions } = await supabase
      .from('transactions')
      .select(`
        id,
        transaction_type,
        amount,
        transaction_date,
        description
      `)
      .or(`tenant_id.eq.${tenant.id},tenant_id.eq.${user.id}`)
      .order('transaction_date', { ascending: false })

    if (rawTransactions) {
      deductions = rawTransactions.filter(
        (t) =>
          t.transaction_type === 'deduction' ||
          t.transaction_type === 'repair_cost' ||
          t.transaction_type === 'expense'
      )
    }

    // 5. Fetch resolved maintenance tickets where cost > 0 for supporting documentary evidence
    const { data: rawTickets } = await supabase
      .from('maintenance_tickets')
      .select(`
        id,
        issue_description,
        status,
        cost,
        created_at,
        resolved_at
      `)
      .or(`reported_by.eq.${tenant.id},tenant_id.eq.${tenant.id}`)
      .eq('status', 'Resolved')
      .gt('cost', 0)
      .order('created_at', { ascending: false })

    billedTickets = rawTickets || []

    // 6. Check for immutable deposit_settlements record
    if (lease) {
      try {
        const { data: settlement } = await supabase
          .from('deposit_settlements')
          .select('*')
          .eq('lease_id', lease.id)
          .maybeSingle()

        if (settlement) {
          settlementRecord = settlement
        }
      } catch {
        // Ignore if table not yet migrated
      }
    }
  }

  const tenantName = tenant
    ? `${tenant.first_name || ''} ${tenant.last_name || ''}`.trim() || 'Resident'
    : 'Resident'

  const initialDeposit = Number(lease?.deposit_amount || 0)

  // FIX: Authoritative deductions are derived strictly from transactions to permanently
  // eliminate double-counting turnover repairs!
  const totalDeductions = deductions.reduce(
    (sum, d) => sum + Number(d.amount || 0),
    0
  )

  const isDisbursed =
    settlementRecord?.payout_status === 'completed' ||
    lease?.refund_status === 'refund_disbursed' ||
    Boolean(lease?.refund_payout_ref)

  const payoutReference =
    settlementRecord?.payout_reference || lease?.refund_payout_ref || null
  const payoutMethod =
    settlementRecord?.payout_method || lease?.refund_payout_method || 'mpesa'
  const payoutDate =
    settlementRecord?.payout_date || lease?.refund_payout_date || lease?.end_date || null
  const recipientInfo =
    settlementRecord?.recipient_name || lease?.refund_recipient_details || tenantName

  const finalCalculatedRefund =
    settlementRecord?.net_refund_amount != null
      ? Number(settlementRecord.net_refund_amount)
      : lease?.refund_amount != null && !lease.is_active
      ? Number(lease.refund_amount)
      : initialDeposit - totalDeductions

  const isFinalized = lease ? !lease.is_active : false

  const statementDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full max-w-5xl mx-auto space-y-6">
      {/* TOP NAVIGATION & ACTIONS */}
      <div className="flex items-center justify-between">
        <Link
          href="/portal"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3.5 py-2 rounded-xl shadow-xs hover:bg-slate-100 cursor-pointer transition-all duration-200 ease-in-out"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to Portal</span>
        </Link>

        <div className="flex items-center gap-3">
          <PrintCertificateButton />
          <span className="text-xs font-mono text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs">
            Ref: {payoutReference ? `#${payoutReference}` : lease ? `#CLR-${lease.id.slice(0, 8).toUpperCase()}` : '#CLR-PENDING'}
          </span>
        </div>
      </div>

      {/* STATUS BANNER */}
      {isDisbursed ? (
        /* Payout Verified Banner: Refund Completed & Disbursed via M-Pesa / Bank */
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shrink-0 shadow-xs">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Refund Disbursed & Completed
                </span>
                <span className="text-xs font-mono text-emerald-700">
                  {payoutDate ? `Paid on ${payoutDate}` : ''}
                </span>
              </div>
              <h2 className="text-sm md:text-base font-bold text-emerald-950 mt-1">
                Security Deposit Disbursed: KES {finalCalculatedRefund.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </h2>
              <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                Electronic settlement sent via <strong className="font-semibold">{payoutMethod.toUpperCase()}</strong> to{' '}
                <strong className="font-semibold">{recipientInfo}</strong>. Transaction Ref:{' '}
                <span className="font-mono font-bold bg-white/70 px-1.5 py-0.5 rounded border border-emerald-200">
                  {payoutReference}
                </span>
              </p>
            </div>
          </div>
          <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-emerald-600 text-white shrink-0 self-start sm:self-auto shadow-xs">
            Paid & Settled
          </span>
        </div>
      ) : isFinalized ? (
        /* Clearance Finalized - Refund Processing */
        <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-700 shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-blue-900">
                Turnover Clearance Approved - Awaiting Electronic Disbursement
              </h2>
              <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                Turnover inspections and bills are settled. Your net escrow refund of KES{' '}
                <strong className="font-bold tabular-nums">{finalCalculatedRefund.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong> is queued for M-Pesa / Bank transfer.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-300 shrink-0">
            Approved
          </span>
        </div>
      ) : (
        /* Active Tenancy */
        <div className="bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-200 rounded-lg text-slate-700 shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Active Tenancy - Escrow Locked in Statutory Trust
              </h2>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                Your deposit is fully secured in escrow. The ledger below reflects current meter charges and held collateral.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-slate-200 text-slate-800 shrink-0">
            Active Lease
          </span>
        </div>
      )}

      {/* THE STATEMENT CARD (INSTITUTIONAL CLEARANCE STATEMENT & PRINTABLE VOUCHER) */}
      <div id="clearance-certificate" className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden print:border-none print:shadow-none">
        
        {/* BANK-GRADE STATEMENT HEADER */}
        <div className="p-6 md:p-8 border-b border-slate-800 bg-slate-900 text-white">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                  Statutory Trust Certificate
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {lease ? `Lease ID: #${lease.id.slice(0, 8).toUpperCase()}` : 'ID: N/A'}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white font-sans">
                Tenancy Clearance & Deposit Settlement Certificate
              </h1>
              <p className="text-slate-400 text-xs mt-1 max-w-2xl leading-relaxed">
                Official itemized financial reconciliation for residential tenancy exit. In accordance with statutory trust custody standards, arbitrary deductions are prohibited and every entry is backed by verified utility meters or contractor work orders.
              </p>
            </div>

            <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700 text-right shrink-0">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">Statement Date</span>
              <span className="text-xs font-bold text-white font-mono">{statementDate}</span>
              {payoutReference && (
                <div className="mt-2 pt-2 border-t border-slate-700">
                  <span className="text-[10px] uppercase text-emerald-400 block font-bold">Disbursement Code</span>
                  <span className="text-xs font-mono font-bold text-white">{payoutReference}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tenancy Metadata Strip */}
          {lease && (
            <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-400 text-[11px] block mb-0.5">Resident</span>
                <span className="font-bold text-white text-sm">{tenantName}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block mb-0.5">Residence & Unit</span>
                <span className="font-semibold text-white text-sm">
                  {lease.units?.properties?.name}, Unit #{lease.units?.unit_number}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block mb-0.5">Tenancy Period</span>
                <span className="font-semibold text-white text-sm">
                  {new Date(lease.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} – {lease.end_date ? new Date(lease.end_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Ongoing'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block mb-0.5">Escrow Custody Status</span>
                <span className={`font-semibold text-sm ${isDisbursed ? 'text-emerald-400' : lease.is_active ? 'text-blue-400' : 'text-amber-400'}`}>
                  {isDisbursed ? 'Refund Disbursed' : lease.is_active ? 'Held in Escrow' : 'Clearance Pending'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* FINANCIAL SUMMARY BENTO ROW */}
        <div className="p-6 md:p-8 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* 1. Initial Deposit */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                Starting Security Deposit
              </span>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">
                KES {initialDeposit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-emerald-700 font-medium mt-1 block">
                + Fully ring-fenced collateral
              </span>
            </div>

            {/* 2. Total Subtracted Deductions */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                Total Itemized Deductions
              </span>
              <p className="text-2xl font-bold text-rose-600 tabular-nums">
                - KES {totalDeductions.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <span className="text-[11px] text-slate-400 mt-1 block">
                {deductions.length} verified itemized entries
              </span>
            </div>

            {/* 3. Final Calculated Refund */}
            <div className={`p-5 rounded-xl border shadow-xs ${
              finalCalculatedRefund >= 0
                ? 'bg-emerald-50/70 border-emerald-200'
                : 'bg-rose-50/70 border-rose-200'
            }`}>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 block mb-1">
                {isDisbursed ? 'Net Amount Refunded' : 'Net Refund Payable'}
              </span>
              <p className={`text-2xl font-bold tabular-nums ${
                finalCalculatedRefund >= 0 ? 'text-emerald-800' : 'text-rose-700'
              }`}>
                KES {Math.abs(finalCalculatedRefund).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <span className={`text-[11px] font-semibold mt-1 block ${
                isDisbursed ? 'text-emerald-700' : finalCalculatedRefund >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                {isDisbursed ? 'Electronic Payout Verified' : finalCalculatedRefund >= 0 ? 'Payable to Resident' : 'Tenant Balance Due'}
              </span>
            </div>

          </div>
        </div>

        {/* ITEMIZED LINE ITEMS LEDGER TABLE */}
        <div className="p-6 md:p-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Itemized Financial Ledger</h2>
              <p className="text-xs text-slate-500">
                Statutory accounting of deposited funds, water utility meter readings, and verified turnover repairs.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
              Currency: KES
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Description & Audit Reference</th>
                  <th className="py-3 px-4">Posting Date</th>
                  <th className="py-3 px-4 text-right">Debit / Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* 1. Base Deposit Credit Entry */}
                <tr className="bg-emerald-50/30">
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Escrow Credit
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-900">
                    Security Deposit Received in Custody
                    <span className="block text-[11px] text-slate-500 font-normal mt-0.5">
                      Deposited at inception &bull; Unit #{lease?.units?.unit_number || 'N/A'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                    {lease ? new Date(lease.start_date).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-emerald-700 whitespace-nowrap tabular-nums">
                    + KES {initialDeposit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>

                {/* 2. Itemized Deductions from Authoritative Transactions Table */}
                {deductions.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        {d.transaction_type === 'repair_cost' ? 'Turnover Repair' : 'Utility Arrears'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      {d.description}
                      <span className="block text-[11px] text-slate-400 font-mono font-normal mt-0.5">
                        Tx Ref #{d.id.slice(0, 8)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                      {new Date(d.transaction_date).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-rose-600 whitespace-nowrap tabular-nums">
                      - KES {Number(d.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}

                {/* Empty deductions notice */}
                {deductions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400 text-xs italic">
                      Zero deductions recorded. No turnover repair fees or unpaid utility arrears were posted.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* NET SETTLEMENT SUMMARY AT BOTTOM */}
          <div className="mt-6 p-6 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                {isDisbursed
                  ? 'Total Reconciled & Refunded'
                  : finalCalculatedRefund >= 0
                  ? 'Final Calculated Escrow Refund'
                  : 'Final Balance Due by Resident'}
              </span>
              <p className="text-xs text-slate-600 mt-0.5">
                {isDisbursed
                  ? `Disbursed via ${payoutMethod.toUpperCase()} (Ref: ${payoutReference || 'Completed'})`
                  : finalCalculatedRefund >= 0
                  ? 'Payable to resident upon turnover departure via electronic transfer.'
                  : 'Pending arrears require settlement prior to closing tenant clearance.'}
              </p>
            </div>

            <div className="text-right">
              <span
                className={`text-3xl sm:text-4xl font-extrabold tabular-nums tracking-tight ${
                  finalCalculatedRefund >= 0 ? 'text-emerald-800' : 'text-rose-700'
                }`}
              >
                KES {Math.abs(finalCalculatedRefund).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Dispute-Free Guarantee Notice */}
          <div className="mt-6 p-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-600 flex items-start gap-3 shadow-xs">
            <svg className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div>
              <p className="font-bold text-slate-900 mb-0.5">
                Full Financial Transparency & Zero Arbitrary Withholdings
              </p>
              <p className="text-slate-500 leading-normal">
                High-end residential lease standards require complete escrow transparency. Every deduction above is verified with a timestamped meter reading or contractor repair invoice. To request supporting documentation or verify an electronic disbursement, contact management.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
