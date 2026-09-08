// app/portal/page.tsx
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function TenantDashboardPage() {
  const supabase = await createClient()

  // 1. Get logged-in user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  // 2. Fetch the tenant record linked to this user_id
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('user_id', user.id)
    .single()

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
      .eq('tenant_id', tenant.id)
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
    ? `${tenant.first_name} ${tenant.last_name}`
    : user.email

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full max-w-6xl mx-auto">
      {/* Header */}
      <header className="mb-8 pb-4 border-b">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Lease & Financial Portal</h1>
            <p className="text-sm text-gray-500 mt-1">
              Welcome back, {tenantName}. Review your deposit escrow status, balance, and unit details.
            </p>
          </div>
          <Link
            href="/portal/clearance"
            className="inline-flex items-center gap-2 self-start md:self-auto text-sm font-semibold bg-white border border-slate-300 hover:border-slate-400 text-slate-700 px-4 py-2 rounded-lg shadow-sm hover:bg-slate-50 transition"
          >
            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Exit Clearance Statement</span>
          </Link>
        </div>
      </header>

      {!activeLease ? (
        <div className="bg-white border rounded-lg p-8 shadow-sm text-center max-w-2xl mx-auto my-8">
          <div className="h-12 w-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">No Active Lease Found</h2>
          <p className="text-gray-600 text-sm max-w-md mx-auto mb-6">
            We couldn&apos;t find an active lease associated with your tenant account. If you have recently moved in or believe this is an error, please reach out to your property management office.
          </p>
          <div className="text-xs text-gray-500">
            Account email: <span className="font-mono text-slate-700">{user.email}</span>
          </div>
        </div>
      ) : (
        <>
          {/* TOP FINANCIAL STATUS ROW (TRUST & CLARITY) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            
            {/* 1. Security Deposit Status Card (Trust-Building Aesthetic) */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-700 relative overflow-hidden flex flex-col justify-between">
              {/* Background ambient glow */}
              <div className="absolute -right-8 -top-8 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-950/70 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Protected Escrow Deposit
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Unit #{activeLease.units?.unit_number}
                  </span>
                </div>

                <p className="text-xs text-slate-300 uppercase tracking-wider font-medium">
                  Security Deposit Status
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white tabular-nums">
                    KES {Number(activeLease.deposit_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="mt-3 p-3 bg-slate-800/80 rounded-lg border border-slate-700/80">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs sm:text-sm">
                    <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Fully Refundable Upon Exit (subject to clearance)</span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                    Held safely in isolated escrow. All deductions require verifiable proof and are itemized on your exit clearance statement.
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-700/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">100% Refund Guarantee</span>
                <Link
                  href="/portal/clearance"
                  className="text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1 transition"
                >
                  <span>View Statement</span>
                  <span>&rarr;</span>
                </Link>
              </div>
            </div>

            {/* 2. Current Balance Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span
                    className={`text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5 ${
                      currentBalance === 0
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
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
                  <span className="text-xs text-gray-500">Live Ledger</span>
                </div>

                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                  Current Balance
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span
                    className={`text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums ${
                      currentBalance === 0 ? 'text-slate-900' : 'text-amber-700'
                    }`}
                  >
                    KES {currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100 text-xs text-gray-600">
                  {currentBalance === 0 ? (
                    <div className="flex items-center gap-2 text-emerald-800 font-medium">
                      <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>No unpaid rent or pending utility bills (KPLC / Water).</span>
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold text-amber-900 mb-1">
                        Pending payment items:
                      </p>
                      <ul className="space-y-1">
                        {pendingCharges.slice(0, 2).map((item, idx) => (
                          <li key={item.id || idx} className="flex justify-between items-center text-[11px]">
                            <span className="truncate max-w-[200px]">{item.description}</span>
                            <span className="font-semibold text-slate-800 tabular-nums">
                              KES {Number(item.amount).toLocaleString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-[11px] text-gray-400 mt-2">
                    Rent is due on the 1st of each calendar month. Utility bills are posted upon meter readings.
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>Monthly Rent: <strong className="text-slate-700 font-semibold tabular-nums">KES {Number(activeLease.units?.base_rent || 0).toLocaleString()}</strong></span>
                <span className="text-slate-400">Due on 1st</span>
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Lease Card */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-700 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-800/60">
                      Active Lease
                    </span>
                    <h2 className="text-2xl font-bold mt-2">
                      {activeLease.units?.properties?.name || 'Property'}
                    </h2>
                    <p className="text-slate-300 text-sm mt-0.5">
                      {activeLease.units?.properties?.location || 'Address not listed'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs uppercase tracking-wider text-slate-400 block">Unit</span>
                    <span className="text-2xl font-extrabold text-white">
                      #{activeLease.units?.unit_number}
                    </span>
                  </div>
                </div>
              </div>

              {/* Lease Details Grid */}
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6 bg-white">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Monthly Rent
                  </span>
                  <p className="text-2xl font-bold text-slate-900 tabular-nums">
                    KES {Number(activeLease.units?.base_rent || 0).toLocaleString()}
                  </p>
                  <span className="text-xs text-slate-500 mt-0.5 block">Due on the 1st of each month</span>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Security Deposit
                  </span>
                  <p className="text-2xl font-bold text-slate-900 tabular-nums">
                    KES {Number(activeLease.deposit_amount || 0).toLocaleString()}
                  </p>
                  <span className="text-xs text-slate-500 mt-0.5 block">Held in escrow ledger</span>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                    Lease Start Date
                  </span>
                  <p className="text-lg font-semibold text-slate-800">
                    {new Date(activeLease.start_date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                    Lease End Date
                  </span>
                  <p className="text-lg font-semibold text-slate-800">
                    {activeLease.end_date
                      ? new Date(activeLease.end_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                      : 'Ongoing / Periodic'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions & Contact Sidebar */}
          <div className="flex flex-col gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Need a Repair?</h3>
              <p className="text-sm text-gray-600 mb-4">
                Experiencing maintenance issues in Unit #{activeLease.units?.unit_number}? Report plumbing, electrical, or structural issues directly to property management.
              </p>
              <Link
                href="/portal/maintenance"
                className="inline-flex items-center justify-center w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 px-4 rounded-xl transition shadow-sm text-sm gap-2"
              >
                <span>Submit Maintenance Request</span>
                <span>&rarr;</span>
              </Link>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-3">
                Tenant Information
              </h3>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-xs text-gray-500">Name</dt>
                  <dd className="font-medium text-slate-900">{tenantName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Email</dt>
                  <dd className="font-medium text-slate-900">{tenant?.email || user.email}</dd>
                </div>
                {tenant?.phone && (
                  <div>
                    <dt className="text-xs text-gray-500">Phone</dt>
                    <dd className="font-medium text-slate-900">{tenant.phone}</dd>
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

