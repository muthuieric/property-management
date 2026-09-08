// app/portal/clearance/page.tsx
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function TenantClearancePage() {
  const supabase = await createClient()

  // 1. Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  // 2. Fetch tenant profile for auth.uid()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('user_id', user.id)
    .single()

  let lease: any = null
  let deductions: any[] = []
  let billedTickets: any[] = []

  if (tenant) {
    // 3. Fetch the tenant's lease (active or most recent) to retrieve deposit_amount
    const { data: tenantLeases } = await supabase
      .from('leases')
      .select(`
        id,
        start_date,
        end_date,
        deposit_amount,
        is_active,
        units (
          id,
          unit_number,
          base_rent,
          properties (
            name,
            location
          )
        )
      `)
      .eq('tenant_id', tenant.id)
      .order('start_date', { ascending: false })
      .limit(1)

    if (tenantLeases && tenantLeases.length > 0) {
      lease = tenantLeases[0]
    }

    // 4. Fetch deductions from transactions table
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

    // 5. Fetch resolved maintenance tickets where cost > 0
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
  }

  const tenantName = tenant
    ? `${tenant.first_name} ${tenant.last_name}`
    : user.email

  const initialDeposit = Number(lease?.deposit_amount || 0)
  const totalTransactionDeductions = deductions.reduce(
    (sum, d) => sum + Number(d.amount || 0),
    0
  )
  const totalRepairDeductions = billedTickets.reduce(
    (sum, t) => sum + Number(t.cost || 0),
    0
  )
  const totalDeductions = totalTransactionDeductions + totalRepairDeductions
  const finalCalculatedRefund = initialDeposit - totalDeductions

  const statementDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full max-w-5xl mx-auto">
      {/* Top Navigation & Back Link */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/portal"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-4 py-2 rounded-lg shadow-sm hover:bg-slate-50 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to My Lease</span>
        </Link>

        <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2.5 py-1 rounded">
          Document Ref: {lease ? `#CLR-${lease.id.slice(0, 8).toUpperCase()}` : '#CLR-PENDING'}
        </span>
      </div>

      {/* Main Statement Document Container */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        
        {/* Document Header */}
        <div className="p-6 md:p-8 border-b border-slate-700 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-3 py-0.5 rounded-full">
                  Verified Clearance Statement
                </span>
                <span className="text-xs text-slate-400">Exit Settlement</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Deposit Clearance & Refund Statement
              </h1>
              <p className="text-slate-300 text-sm mt-1 max-w-2xl">
                Official itemized financial reconciliation for vacating tenants. Every deduction is backed by timestamped records to ensure 100% dispute-free transparency.
              </p>
            </div>

            <div className="text-right self-start md:self-auto bg-slate-800/80 p-3.5 rounded-xl border border-slate-700">
              <span className="text-xs uppercase tracking-wider text-slate-400 block font-medium">Statement Date</span>
              <span className="text-sm font-semibold text-white">{statementDate}</span>
            </div>
          </div>

          {/* Tenancy Metadata Strip */}
          {lease && (
            <div className="mt-6 pt-6 border-t border-slate-700/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Tenant</span>
                <span className="font-semibold text-white text-sm">{tenantName}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Property & Unit</span>
                <span className="font-semibold text-white text-sm">
                  {lease.units?.properties?.name}, Unit #{lease.units?.unit_number}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Lease Status</span>
                <span className={`font-semibold ${lease.is_active ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {lease.is_active ? 'Active Tenancy' : 'Vacated / Terminated'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Tenancy Window</span>
                <span className="font-semibold text-white text-sm">
                  {new Date(lease.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} – {lease.end_date ? new Date(lease.end_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Present'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* FINANCIAL SUMMARY HIGHLIGHT CARD */}
        <div className="p-6 md:p-8 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* 1. Initial Deposit */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                Starting Security Deposit
              </span>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                KES {initialDeposit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <span className="text-xs text-emerald-600 font-medium mt-1 block">
                + Fully paid into escrow
              </span>
            </div>

            {/* 2. Total Deductions */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                Total Approved Deductions
              </span>
              <p className="text-2xl sm:text-3xl font-extrabold text-rose-600 tabular-nums">
                - KES {totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <span className="text-xs text-rose-500 font-medium mt-1 block">
                {deductions.length + billedTickets.length} itemized charges
              </span>
            </div>

            {/* 3. Final Calculated Refund */}
            <div
              className={`p-6 rounded-xl border shadow-sm flex flex-col justify-between ${
                finalCalculatedRefund >= 0
                  ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                  : 'bg-rose-50/80 border-rose-300 text-rose-950'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Final Calculated Refund
                  </span>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-200/60 text-emerald-800">
                    {finalCalculatedRefund >= 0 ? 'Payable to Tenant' : 'Balance Due'}
                  </span>
                </div>
                <p className="text-2xl sm:text-3xl font-black text-emerald-900 tabular-nums">
                  KES {finalCalculatedRefund.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <span className="text-[11px] text-emerald-700 mt-2 font-medium">
                {finalCalculatedRefund >= 0
                  ? 'Ready for electronic refund upon key handover'
                  : 'Requires settlement prior to final clearance sign-off'}
              </span>
            </div>

          </div>
        </div>

        {/* ITEMIZED DEDUCTIONS & CREDITS STATEMENT */}
        <div className="p-6 md:p-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Itemized Financial Ledger</h2>
              <p className="text-xs text-gray-500">
                Comprehensive accounting of original funds, utility clearings, and tenant-chargeable maintenance.
              </p>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              KES Currency
            </span>
          </div>

          <div className="overflow-x-auto border rounded-xl">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b text-xs uppercase font-semibold text-slate-600">
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Item Description & Record Reference</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5 text-right">Debit / Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {/* 1. Base Deposit Credit Entry */}
                <tr className="bg-emerald-50/30">
                  <td className="p-3.5 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                      Escrow Credit
                    </span>
                  </td>
                  <td className="p-3.5 font-medium text-slate-900">
                    Initial Security Deposit Received
                    <span className="block text-xs text-slate-500 font-normal">
                      Paid upon lease execution &bull; Unit #{lease?.units?.unit_number || 'N/A'}
                    </span>
                  </td>
                  <td className="p-3.5 text-xs text-slate-500 whitespace-nowrap">
                    {lease ? new Date(lease.start_date).toLocaleDateString() : '—'}
                  </td>
                  <td className="p-3.5 text-right font-bold text-emerald-700 whitespace-nowrap tabular-nums">
                    + KES {initialDeposit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>

                {/* 2. Itemized Deductions from Transactions */}
                {deductions.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                        {d.transaction_type === 'repair_cost' ? 'Repair Deduction' : 'Utility / Charge'}
                      </span>
                    </td>
                    <td className="p-3.5 font-medium text-slate-900">
                      {d.description}
                      <span className="block text-xs text-slate-400 font-mono font-normal">
                        Ledger Tx #{d.id.slice(0, 8)}
                      </span>
                    </td>
                    <td className="p-3.5 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(d.transaction_date).toLocaleDateString()}
                    </td>
                    <td className="p-3.5 text-right font-semibold text-rose-600 whitespace-nowrap tabular-nums">
                      - KES {Number(d.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}

                {/* 3. Itemized Resolved Maintenance Tickets with Cost > 0 */}
                {billedTickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900">
                        Maintenance Charge
                      </span>
                    </td>
                    <td className="p-3.5 font-medium text-slate-900">
                      {ticket.issue_description}
                      <span className="block text-xs text-slate-400 font-mono font-normal">
                        Ticket #{ticket.id.slice(0, 8)} &bull; Resolved {ticket.resolved_at ? new Date(ticket.resolved_at).toLocaleDateString() : ''}
                      </span>
                    </td>
                    <td className="p-3.5 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3.5 text-right font-semibold text-rose-600 whitespace-nowrap tabular-nums">
                      - KES {Number(ticket.cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}

                {/* If no deductions exist */}
                {deductions.length === 0 && billedTickets.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-gray-500 text-xs italic bg-white">
                      Zero deductions recorded. No tenant repair fees or pending utility bills were posted against this lease.
                    </td>
                  </tr>
                )}
              </tbody>

              {/* Totals Footer */}
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-900">
                  <td colSpan={3} className="p-4 text-right">
                    Final Net Refund Payable:
                  </td>
                  <td className="p-4 text-right text-lg font-bold text-emerald-700 whitespace-nowrap tabular-nums">
                    KES {finalCalculatedRefund.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Dispute-Free Transparency Policy Box */}
          <div className="mt-8 p-5 rounded-xl border border-blue-100 bg-blue-50/60 flex items-start gap-4 text-xs text-blue-900 leading-relaxed">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-700 shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-blue-950 text-sm mb-1">
                Zero Agent Conflict & Full Transparency Guarantee
              </p>
              <p className="text-blue-800">
                In compliance with residential lease guidelines, security deposits may not be withheld arbitrarily. Any repair deductions shown above correspond to closed coordinator maintenance tickets verified by property inspection. If you have inquiries or wish to review photographic documentation for any item, please contact property management prior to final checkout.
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}

