// app/portal/page.tsx
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function TenantDashboardPage() {
  const supabase = await createClient()

  // 1. Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  // 2. Fetch the tenant record linked to this user_id or id
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle()

  // 3. Fetch active lease(s) for this tenant
  let activeLease: any = null
  let tenantTransactions: any[] = []
  let currentBalance = 0
  let pendingCharges: any[] = []

  if (tenant) {
    const { data: leases } = await supabase
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
      .or(`tenant_id.eq.${tenant.id},tenant_id.eq.${user.id}`)
      .eq('is_active', true)
      .order('start_date', { ascending: false })

    if (leases && leases.length > 0) {
      activeLease = leases[0]
    }

    // 4. Fetch tenant financial transactions (rent, bills, utilities)
    const { data: txList } = await supabase
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

    tenantTransactions = txList || []

    const chargesList = tenantTransactions.filter(
      (t) =>
        t.transaction_type === 'expense' ||
        t.transaction_type === 'deduction' ||
        t.transaction_type === 'repair_cost'
    )
    pendingCharges = chargesList

    const totalCharges = chargesList.reduce(
      (sum, t) => sum + Number(t.amount || 0),
      0
    )

    const totalPayments = tenantTransactions
      .filter((t) => t.transaction_type === 'income' || t.transaction_type === 'payment')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)

    currentBalance = Math.max(0, totalCharges - totalPayments)
  }

  const tenantName = tenant
    ? `${tenant.first_name || ''} ${tenant.last_name || ''}`.trim() || 'Resident'
    : 'Resident'

  const nextRentAmount = activeLease ? Number(activeLease.units?.base_rent || 0) : 0
  const displayDueAmount = currentBalance > 0 ? currentBalance : nextRentAmount

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full max-w-7xl mx-auto space-y-8">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-end justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              Institutional Escrow & Resident Portal
            </span>
            {activeLease && (
              <span className="text-xs text-slate-500 font-mono">
                Unit #{activeLease.units?.unit_number} &bull; {activeLease.units?.properties?.name}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Resident Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Welcome back, {tenantName}. Review your active lease agreement, real-time balance, and segregated security deposit.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/portal/clearance"
            className="border border-slate-300 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-100 px-4 py-2 rounded-xl transition-all duration-200 ease-in-out font-semibold text-xs shadow-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Exit Clearance Statement</span>
          </Link>
        </div>
      </header>

      {!activeLease ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 shadow-sm text-center max-w-xl mx-auto my-12">
          <div className="h-12 w-12 bg-amber-50 text-amber-600 border border-amber-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">No Active Tenancy on File</h2>
          <p className="text-slate-500 text-xs leading-relaxed max-w-md mx-auto mb-6">
            We couldn&apos;t identify an active lease associated with your tenant account. If you recently moved in or believe this is an error, please reach out to property management.
          </p>
          <div className="text-xs text-slate-400">
            Account email: <span className="font-mono text-slate-700">{user.email}</span>
          </div>
        </div>
      ) : (
        <>
          {/* 
            ===================================================================
            PRIMARY BENTO GRID ROW: 3 KEY INSTITUTIONAL CARDS
            ===================================================================
          */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* CARD 1: NEXT RENT DUE */}
            <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span
                    className={`text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                      currentBalance === 0
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        currentBalance === 0 ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                      }`}
                    />
                    {currentBalance === 0 ? 'Account Settled' : 'Payment Due'}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">Due 1st of Month</span>
                </div>

                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                  Next Rent Due
                </span>
                <div className="mt-1">
                  <p className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 tabular-nums">
                    KES {displayDueAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500">Monthly Unit Base Rent:</span>
                    <span className="font-bold text-slate-900 tabular-nums">
                      KES {nextRentAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {currentBalance > 0 && (
                    <div className="flex justify-between items-center text-[11px] text-amber-700">
                      <span>Unpaid Utilities & Arrears:</span>
                      <span className="font-bold tabular-nums">
                        KES {currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Prominent Solid Deep Slate Blue CTA Button */}
              <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
                <button
                  type="button"
                  className="w-full bg-slate-900 hover:bg-slate-800 hover:shadow-md text-white font-semibold py-2.5 px-4 rounded-xl cursor-pointer transition-all duration-200 ease-in-out flex items-center justify-center gap-2 shadow-xs text-xs"
                >
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>Pay Rent (M-Pesa / Card)</span>
                </button>
              </div>
            </div>

            {/* CARD 2: ACTIVE LEASE */}
            <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Active Tenancy
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    Unit #{activeLease.units?.unit_number}
                  </span>
                </div>

                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                  Active Lease
                </span>
                <div className="mt-1">
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight leading-snug">
                    {activeLease.units?.properties?.name || 'Property'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeLease.units?.properties?.location || 'Address unlisted'}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                      Term Start
                    </span>
                    <span className="font-semibold text-slate-800">
                      {new Date(activeLease.start_date).toLocaleDateString('en-US', {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                      Term End
                    </span>
                    <span className="font-semibold text-slate-800">
                      {activeLease.end_date
                        ? new Date(activeLease.end_date).toLocaleDateString('en-US', {
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'Periodic'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Base Rent:</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  KES {Number(activeLease.units?.base_rent || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* CARD 3: SECURITY DEPOSIT IN ESCROW */}
            <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    100% Protected Escrow
                  </span>
                  <span className="text-[11px] text-emerald-700 font-semibold">Segregated Trust</span>
                </div>

                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                  Security Deposit in Escrow
                </span>
                <div className="mt-1">
                  <p className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 tabular-nums">
                    KES {Number(activeLease.deposit_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="mt-4 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-semibold text-[11px] mb-1">
                    <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Full Dispute-Free Refund Guarantee</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Locked securely in institutional escrow. Arbitrary deductions are blocked; any turnover repairs require documented contractor invoices.
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400">Exit Reconciliation:</span>
                <Link
                  href="/portal/clearance"
                  className="text-slate-900 hover:text-emerald-700 font-semibold inline-flex items-center gap-1 cursor-pointer transition-all duration-200 ease-in-out"
                >
                  <span>View Statement</span>
                  <span>&rarr;</span>
                </Link>
              </div>
            </div>

          </div>

          {/* 
            ===================================================================
            SECONDARY BENTO ROW: RECENT TRANSACTIONS & RESIDENT SUPPORT
            ===================================================================
          */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* LEDGER TRANSACTIONS TABLE */}
            <div className="lg:col-span-2 bg-white shadow-sm border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Recent Account Activity</h3>
                  <p className="text-xs text-slate-500">Live ledger record of billed rent, water utilities, and received payments.</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                  {tenantTransactions.length} records
                </span>
              </div>

              {tenantTransactions.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 italic">
                  No transaction activity logged yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-y border-slate-200 font-semibold text-slate-600 uppercase tracking-wider text-[11px]">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3 text-right">Amount (KES)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tenantTransactions.slice(0, 5).map((tx) => {
                        const isCredit = tx.transaction_type === 'income' || tx.transaction_type === 'payment'
                        return (
                          <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                              {new Date(tx.transaction_date).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-3 font-medium text-slate-800">
                              {tx.description}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  isCredit
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                                }`}
                              >
                                {isCredit ? 'Payment' : 'Expense / Bill'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-bold tabular-nums whitespace-nowrap">
                              <span className={isCredit ? 'text-emerald-700' : 'text-slate-900'}>
                                {isCredit ? '+ ' : '- '}
                                KES {Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* MAINTENANCE & CONTACT ASSISTANCE */}
            <div className="space-y-6">
              {/* Quick Repair Request CTA */}
              <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="p-1.5 bg-slate-100 text-slate-800 rounded-lg text-xs">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </span>
                  <h3 className="text-base font-bold text-slate-900">Need a Repair?</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  Experiencing plumbing, electrical, or appliance issues in Unit #{activeLease.units?.unit_number}? Report maintenance directly to property coordinators.
                </p>
                <Link
                  href="/portal/maintenance"
                  className="w-full bg-slate-900 hover:bg-slate-800 hover:shadow-md text-white font-semibold py-2.5 px-4 rounded-xl cursor-pointer transition-all duration-200 ease-in-out flex items-center justify-center gap-2 shadow-xs text-xs"
                >
                  <span>Submit Maintenance Request</span>
                  <span>&rarr;</span>
                </Link>
              </div>

              {/* Resident Profile Information */}
              <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Resident Profile
                </h3>
                <dl className="space-y-2.5 text-xs">
                  <div>
                    <dt className="text-slate-400 text-[11px]">Primary Tenant</dt>
                    <dd className="font-semibold text-slate-900 text-sm">{tenantName}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400 text-[11px]">Registered Email</dt>
                    <dd className="font-mono text-slate-800 text-xs">{tenant?.email || user.email}</dd>
                  </div>
                  {tenant?.phone_number && (
                    <div>
                      <dt className="text-slate-400 text-[11px]">Phone Contact</dt>
                      <dd className="font-semibold text-slate-800">{tenant.phone_number}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  )
}
