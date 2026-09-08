// app/dashboard/clearance/page.tsx
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'
import Link from 'next/link'
import { postWaterBill, initiateMoveOut } from './actions'
import ActiveLeasesSection from './components/ActiveLeasesSection'

export default async function CoordinatorClearancePage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const message = resolvedSearchParams.message

  const supabase = await createClient()
  const { userId, agencyId, role } = await getUserAgencyContext()

  // 1. Fetch coordinator's assigned properties
  let propertiesQuery = supabase
    .from('properties')
    .select('id, name')
    .eq('agency_id', agencyId)

  if (role === 'property_manager') {
    propertiesQuery = propertiesQuery.eq('manager_id', userId)
  }

  const { data: properties } = await propertiesQuery
  let assignedProperties = properties || []

  if (role === 'agency_owner' && assignedProperties.length === 0) {
    const { data: allProps } = await supabase
      .from('properties')
      .select('id, name')
      .eq('agency_id', agencyId)
    assignedProperties = allProps || []
  }

  const propertyIds = assignedProperties.map((p) => p.id)

  // 2. Fetch active leases in coordinator's assigned properties
  let leasesQuery = supabase
    .from('leases')
    .select(`
      id,
      start_date,
      end_date,
      deposit_amount,
      is_active,
      tenant_id,
      unit_id,
      units!inner (
        id,
        unit_number,
        base_rent,
        property_id,
        properties!inner ( id, name )
      ),
      tenants ( id, first_name, last_name, email, phone )
    `)
    .eq('agency_id', agencyId)
    .eq('is_active', true)
    .order('start_date', { ascending: false })

  if (propertyIds.length > 0) {
    leasesQuery = leasesQuery.in('units.property_id', propertyIds)
  }

  const { data: activeLeases } = await leasesQuery
  const leasesList = activeLeases || []

  // 3. Fetch transactions for these tenants to compute current outstanding rent/bills
  const tenantIds = leasesList.map((l: any) => l.tenant_id).filter(Boolean)
  let tenantTransactions: any[] = []

  if (tenantIds.length > 0) {
    const { data: txs } = await supabase
      .from('transactions')
      .select('id, tenant_id, transaction_type, amount, description, transaction_date')
      .in('tenant_id', tenantIds)

    tenantTransactions = txs || []
  }

  // 4. Fetch open maintenance tickets for units to allow linking deductions to documented tickets
  const unitIds = leasesList.map((l: any) => l.unit_id).filter(Boolean)
  let unitTickets: any[] = []
  if (unitIds.length > 0) {
    const { data: tickets } = await supabase
      .from('maintenance_tickets')
      .select('id, unit_id, issue_description, cost, status, created_at')
      .in('unit_id', unitIds)
      .neq('status', 'Resolved')

    unitTickets = tickets || []
  }

  // Calculate outstanding dues per tenant
  const tenantBalanceMap = new Map<string, number>()

  tenantIds.forEach((tId) => {
    const tTxs = tenantTransactions.filter((tx) => tx.tenant_id === tId)
    const expenses = tTxs
      .filter((tx) => ['expense', 'deduction', 'repair_cost'].includes(tx.transaction_type))
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
    const income = tTxs
      .filter((tx) => ['income', 'payment'].includes(tx.transaction_type))
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)

    const netDues = Math.max(0, expenses - income)
    tenantBalanceMap.set(tId, netDues)
  })

  // Format leases with computed unpaid dues for child components
  const leasesWithUnpaidDues = leasesList.map((lease: any) => ({
    ...lease,
    unpaidDues: tenantBalanceMap.get(lease.tenant_id) || 0,
  }))

  const currentMonth = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const defaultWaterDescription = `Monthly Water Utility Bill - ${currentMonth}`
  const isSuccess = message && message.toLowerCase().includes('success')

  const totalEscrowDeposits = leasesList.reduce(
    (sum: number, l: any) => sum + Number(l.deposit_amount || 0),
    0
  )
  const totalArrears = Array.from(tenantBalanceMap.values()).reduce((sum, v) => sum + v, 0)

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full max-w-7xl mx-auto space-y-8">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-end justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              Institutional Clearance & Escrow
            </span>
            <span className="text-xs text-slate-500 font-mono">
              {assignedProperties.length} Sites Under Management
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Utility Billing & Move-Out Clearance
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Batch-bill monthly utility meters, reconcile deposit escrow, and execute tenant turnover clearances.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="border border-slate-300 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-100 px-4 py-2 rounded-xl transition-all duration-200 ease-in-out font-semibold text-xs shadow-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <span>&larr; Action Center</span>
          </Link>
        </div>
      </header>

      {/* MESSAGE FEEDBACK BANNER */}
      {message && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold border flex items-center justify-between ${
            isSuccess
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <span>{message}</span>
        </div>
      )}

      {/* QUICK KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
            Active Leases
          </span>
          <p className="text-3xl font-bold text-slate-900 tabular-nums tracking-tight">
            {leasesList.length}
          </p>
          <span className="text-xs text-slate-400 mt-1 block">Tenants eligible for billing</span>
        </div>

        <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 block mb-1">
            Total Funds in Escrow
          </span>
          <p className="text-3xl font-bold text-emerald-800 tabular-nums tracking-tight">
            KES {totalEscrowDeposits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-xs text-slate-400 mt-1 block">Locked security deposits</span>
        </div>

        <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 block mb-1">
            Total Outstanding Arrears
          </span>
          <p className="text-3xl font-bold text-amber-800 tabular-nums tracking-tight">
            KES {totalArrears.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-xs text-amber-700 mt-1 block font-medium">Unpaid rent & utility expenses</span>
        </div>
      </div>

      {/* CARD 1: BATCH UTILITY BILLING */}
      <section className="bg-white shadow-sm border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-slate-100 text-slate-800 rounded-lg text-xs">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </span>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Batch Utility Billing
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Tabulate monthly water consumption. Submitting immediately records an expense against the tenant&apos;s ledger.
            </p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 shrink-0 self-start sm:self-auto">
            Billing Period: {currentMonth}
          </span>
        </div>

        {leasesList.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 italic">
            No active leases found eligible for utility billing.
          </div>
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200 font-semibold text-slate-600 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Tenant</th>
                  <th className="py-3 px-4">Property & Unit</th>
                  <th className="py-3 px-4 text-right">Current Arrears</th>
                  <th className="py-3 px-4 text-right w-36">Water Bill (KES)</th>
                  <th className="py-3 px-4">Billing Description</th>
                  <th className="py-3 px-4 text-right w-28">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leasesList.map((lease: any) => {
                  const tenant = lease.tenants
                  const tenantName = tenant
                    ? `${tenant.first_name || ''} ${tenant.last_name || ''}`.trim() || 'Tenant'
                    : 'Tenant'
                  const currentDues = tenantBalanceMap.get(lease.tenant_id) || 0

                  return (
                    <tr key={`water-${lease.id}`} className="hover:bg-slate-50/70 transition-colors">
                      {/* Tenant */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="font-bold text-slate-900 text-sm">{tenantName}</p>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          {tenant?.phone || tenant?.email || 'No contact on file'}
                        </p>
                      </td>

                      {/* Property & Unit */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="font-semibold text-slate-800">
                          {lease.units?.properties?.name || 'Assigned Property'}
                        </p>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          Unit #{lease.units?.unit_number}
                        </p>
                      </td>

                      {/* Current Arrears */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <span
                          className={`font-semibold tabular-nums ${
                            currentDues > 0 ? 'text-amber-700 font-bold' : 'text-emerald-700'
                          }`}
                        >
                          KES {currentDues.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {currentDues > 0 ? 'Arrears pending' : 'Zero balance'}
                        </span>
                      </td>

                      {/* Spreadsheet Inputs Form spanning Amount, Description, Action */}
                      <td colSpan={3} className="py-3.5 px-4">
                        <form
                          action={postWaterBill}
                          className="flex items-center gap-3 w-full"
                        >
                          <input type="hidden" name="lease_id" value={lease.id} />
                          <input type="hidden" name="tenant_id" value={lease.tenant_id} />
                          <input type="hidden" name="unit_id" value={lease.unit_id} />
                          <input
                            type="hidden"
                            name="property_id"
                            value={lease.units?.properties?.id || lease.units?.property_id || ''}
                          />

                          {/* Water Bill Amount (KES) */}
                          <div className="w-36 shrink-0 relative">
                            <input
                              type="number"
                              name="amount"
                              step="0.01"
                              min="1"
                              required
                              placeholder="0.00"
                              className="w-full text-right text-xs font-semibold tabular-nums rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-slate-900 focus:outline-none focus:border-slate-900 transition"
                            />
                          </div>

                          {/* Billing Description */}
                          <div className="flex-1">
                            <input
                              type="text"
                              name="description"
                              defaultValue={defaultWaterDescription}
                              required
                              className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-slate-900 focus:outline-none focus:border-slate-900 transition"
                            />
                          </div>

                          {/* Post Bill Submit Button */}
                          <div className="shrink-0">
                            <button
                              type="submit"
                              className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-800 hover:bg-slate-100 hover:border-slate-400 cursor-pointer transition-all duration-200 ease-in-out shadow-xs whitespace-nowrap"
                            >
                              Post Bill
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* CARD 2: ACTIVE LEASES (MOVE-OUT INITIATION) */}
      <ActiveLeasesSection
        leases={leasesWithUnpaidDues}
        unitTickets={unitTickets}
        initiateMoveOutAction={initiateMoveOut}
      />
    </div>
  )
}
