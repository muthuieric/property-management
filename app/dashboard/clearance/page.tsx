// app/dashboard/clearance/page.tsx
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'
import Link from 'next/link'
import { postWaterBill, initiateMoveOut } from './actions'
import ActiveLeasesSection from './components/ActiveLeasesSection'

export default async function CoordinatorClearancePage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; property_id?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const message = resolvedSearchParams.message
  const selectedPropertyId = resolvedSearchParams.property_id || ''

  const supabase = await createClient()
  const { userId, agencyId, role } = await getUserAgencyContext()

  // 1. Fetch coordinator's assigned properties
  let propertiesQuery = supabase
    .from('properties')
    .select('id, name, location')
    .eq('agency_id', agencyId)

  if (role === 'property_manager') {
    propertiesQuery = propertiesQuery.eq('manager_id', userId)
  }

  const { data: properties } = await propertiesQuery
  let assignedProperties = properties || []

  if (role === 'agency_owner' && assignedProperties.length === 0) {
    const { data: allProps } = await supabase
      .from('properties')
      .select('id, name, location')
      .eq('agency_id', agencyId)
    assignedProperties = allProps || []
  }

  const allPropertyIds = assignedProperties.map((p) => p.id)
  const targetPropertyIds = selectedPropertyId
    ? [selectedPropertyId]
    : allPropertyIds

  // 2. Fetch active leases in targeted properties
  let leasesQuery = supabase
    .from('leases')
    .select(`
      id,
      start_date,
      end_date,
      deposit_amount,
      deposit_months,
      is_active,
      tenant_id,
      unit_id,
      units!inner (
        id,
        unit_number,
        base_rent,
        property_id,
        properties!inner ( id, name, location )
      ),
      tenants ( id, first_name, last_name, email, phone_number )
    `)
    .eq('agency_id', agencyId)
    .eq('is_active', true)
    .order('start_date', { ascending: false })

  if (targetPropertyIds.length > 0) {
    leasesQuery = leasesQuery.in('units.property_id', targetPropertyIds)
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

  // 4. Fetch open maintenance tickets for units
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
  const isSuccess = message && message.toLowerCase().includes('success')

  const totalEscrowDeposits = leasesList.reduce(
    (sum: number, l: any) => sum + Number(l.deposit_amount || 0),
    0
  )
  const totalArrears = Array.from(tenantBalanceMap.values()).reduce((sum, v) => sum + v, 0)

  const activePropertyName =
    assignedProperties.find((p) => p.id === selectedPropertyId)?.name || 'All Assigned Sites'

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
            Site-level water tabulation (Kannan, Nirkav, Joshi, Prosper), meter reading ledger, and verified tenant turnover.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="border border-slate-300 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-100 px-4 py-2 rounded-xl transition-all duration-200 ease-in-out font-semibold text-xs shadow-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <span>&larr; Action Center</span>
          </Link>
          <Link
            href="/dashboard/deposits"
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl transition-all duration-200 ease-in-out font-bold text-xs shadow-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <span>Deposit Escrow Vault</span>
            <span>&rarr;</span>
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

      {/* SITE-SPECIFIC FILTER TABS (Kannan, Nirkav, Joshi, Prosper) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-2 shrink-0">
          Target Site:
        </span>
        <Link
          href="/dashboard/clearance"
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            !selectedPropertyId
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          All Sites ({assignedProperties.length})
        </Link>
        {assignedProperties.map((p) => {
          const isSelected = selectedPropertyId === p.id
          const isProsper = p.name.toLowerCase().includes('prosper')
          return (
            <Link
              key={p.id}
              href={`/dashboard/clearance?property_id=${p.id}`}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-xs'
                  : isProsper
                  ? 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>{p.name}</span>
              {isProsper && (
                <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-amber-200 text-amber-950 font-bold">
                  Priority
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {/* QUICK KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
            Active Leases in Scope
          </span>
          <p className="text-3xl font-bold text-slate-900 tabular-nums tracking-tight">
            {leasesList.length}
          </p>
          <span className="text-xs text-slate-400 mt-1 block">
            {activePropertyName} &bull; Eligible for utility tabulation
          </span>
        </div>

        <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 block mb-1">
            Escrow Held in Trust
          </span>
          <p className="text-3xl font-bold text-emerald-800 tabular-nums tracking-tight">
            KES {totalEscrowDeposits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-xs text-slate-400 mt-1 block">Locked refundable security collateral</span>
        </div>

        <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 block mb-1">
            Total Outstanding Arrears
          </span>
          <p className="text-3xl font-bold text-amber-800 tabular-nums tracking-tight">
            KES {totalArrears.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-xs text-amber-700 mt-1 block font-medium">Unpaid rent & water meter arrears</span>
        </div>
      </div>

      {/* CARD 1: SITE-SPECIFIC MONTHLY WATER METER TABULATION */}
      <section className="bg-white shadow-sm border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-lg text-xs font-bold">
                Water Utility Tabulation
              </span>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Monthly Meter Readings & Billing
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Tabulate water consumption for {activePropertyName}. Entering meter readings auto-computes consumption and records an auditable utility debit.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 shrink-0">
              Billing Month: {currentMonth}
            </span>
          </div>
        </div>

        {leasesList.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400 italic">
            No active leases found for {activePropertyName}.
          </div>
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200 font-semibold text-slate-600 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Resident</th>
                  <th className="py-3 px-4">Property & Unit</th>
                  <th className="py-3 px-4 text-right">Current Arrears</th>
                  <th className="py-3 px-4">Meter Tabulation ($m^3$) & Post Bill</th>
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
                      {/* Resident */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="font-bold text-slate-900 text-sm">{tenantName}</p>
                        <p className="text-slate-500 text-[11px] mt-0.5 font-mono">
                          {tenant?.phone_number || tenant?.email || 'No contact on file'}
                        </p>
                      </td>

                      {/* Property & Unit */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="font-semibold text-slate-800">
                          {lease.units?.properties?.name || 'Property'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-slate-600 font-bold">
                            Unit #{lease.units?.unit_number}
                          </span>
                        </div>
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
                          {currentDues > 0 ? 'Pending dues' : 'Settled'}
                        </span>
                      </td>

                      {/* Meter Tabulation Spreadsheet Form */}
                      <td className="py-3.5 px-4">
                        <form
                          action={postWaterBill}
                          className="flex flex-wrap items-center gap-2.5"
                        >
                          <input type="hidden" name="lease_id" value={lease.id} />
                          <input type="hidden" name="tenant_id" value={lease.tenant_id} />
                          <input type="hidden" name="unit_id" value={lease.unit_id} />
                          <input
                            type="hidden"
                            name="property_id"
                            value={lease.units?.properties?.id || selectedPropertyId || ''}
                          />

                          <div className="flex items-center gap-1.5">
                            <div>
                              <span className="text-[9px] uppercase font-bold text-slate-400 block">Prev</span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                name="previous_reading"
                                placeholder="Prev m³"
                                className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-right font-mono text-xs"
                              />
                            </div>

                            <div>
                              <span className="text-[9px] uppercase font-bold text-slate-400 block">Curr</span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                name="current_reading"
                                placeholder="Curr m³"
                                className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-right font-mono text-xs"
                              />
                            </div>

                            <div>
                              <span className="text-[9px] uppercase font-bold text-slate-400 block">Rate</span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                name="rate_per_unit"
                                defaultValue="150"
                                className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-right font-mono text-xs"
                              />
                            </div>

                            <div>
                              <span className="text-[9px] uppercase font-bold text-slate-400 block">Or Total (KES)</span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                name="amount"
                                placeholder="KES Bill"
                                className="w-24 px-2 py-1 border border-slate-200 rounded-lg text-right font-bold tabular-nums text-xs"
                              />
                            </div>
                          </div>

                          <button
                            type="submit"
                            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-xs cursor-pointer transition-all duration-150 self-end"
                          >
                            Post Bill
                          </button>
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

      {/* CARD 2: MOVE-OUT CLEARANCE & DEPOSIT TURNOVER SECTION */}
      <ActiveLeasesSection
        leases={leasesWithUnpaidDues}
        unitTickets={unitTickets}
        initiateMoveOutAction={initiateMoveOut}
      />
    </div>
  )
}
