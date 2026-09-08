// app/dashboard/page.tsx
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'
import Link from 'next/link'
import SlaBadge from './components/SlaBadge'
import LeaseExpiryWidget from './components/LeaseExpiryWidget'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { userId, agencyId, role } = await getUserAgencyContext()

  // Authenticate user
  const { data: { user } } = await supabase.auth.getUser()

  const isOwner = role === 'agency_owner'

  // =========================================================================
  // 1. AGENCY OWNER: EXECUTIVE OVERVIEW (MACRO METRICS & PORTFOLIO HEALTH)
  // =========================================================================
  if (isOwner) {
    // 1a. Fetch all properties across the agency
    const { data: allProperties } = await supabase
      .from('properties')
      .select('id, name, location, manager_id')
      .eq('agency_id', agencyId)
      .order('name', { ascending: true })

    const properties = allProperties || []
    const propertyIds = properties.map((p) => p.id)

    // 1b. Fetch all units
    let units: any[] = []
    if (propertyIds.length > 0) {
      const { data: allUnits } = await supabase
        .from('units')
        .select('id, unit_number, base_rent, is_occupied, property_id')
        .in('property_id', propertyIds)
      units = allUnits || []
    }

    const unitMap = new Map<string, any>()
    units.forEach((u) => unitMap.set(u.id, u))

    // 1c. Fetch active leases and trust deposits
    const { data: allLeases } = await supabase
      .from('leases')
      .select('id, deposit_amount, is_active, unit_id, tenant_id')
      .eq('agency_id', agencyId)

    const leases = allLeases || []
    const activeLeases = leases.filter((l) => l.is_active)
    const totalDepositsInTrust = activeLeases.reduce(
      (sum, l) => sum + Number(l.deposit_amount || 0),
      0
    )

    // 1d. Fetch all transactions across the agency for MTD Revenue and Global Arrears
    const { data: allTransactions } = await supabase
      .from('transactions')
      .select('id, property_id, unit_id, tenant_id, transaction_type, amount, transaction_date')
      .eq('agency_id', agencyId)

    const transactions = allTransactions || []

    // Month-To-Date (MTD) Agency Revenue
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    const mtdRevenue = transactions
      .filter((t) => {
        if (t.transaction_type !== 'income' && t.transaction_type !== 'payment') return false
        const d = new Date(t.transaction_date)
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth
      })
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)

    // Total Arrears (Global Unpaid Rent & Utility Dues)
    const tenantLedgerMap = new Map<string, { debits: number; credits: number }>()
    transactions.forEach((t) => {
      if (!t.tenant_id) return
      const current = tenantLedgerMap.get(t.tenant_id) || { debits: 0, credits: 0 }
      if (['expense', 'deduction', 'repair_cost'].includes(t.transaction_type)) {
        current.debits += Number(t.amount || 0)
      } else if (['income', 'payment'].includes(t.transaction_type)) {
        current.credits += Number(t.amount || 0)
      }
      tenantLedgerMap.set(t.tenant_id, current)
    })

    let totalGlobalArrears = 0
    tenantLedgerMap.forEach((v) => {
      const net = Math.max(0, v.debits - v.credits)
      totalGlobalArrears += net
    })

    // 1e. Fetch all maintenance tickets for Portfolio Health & SLA tracking
    const { data: allTickets } = await supabase
      .from('maintenance_tickets')
      .select(`
        id,
        unit_id,
        status,
        created_at,
        resolved_at,
        cost
      `)
      .eq('agency_id', agencyId)

    const tickets = allTickets || []
    const nowMs = Date.now()

    // 1f. Database Aggregation RPC (High Performance SQL Execution)
    let dbMetrics: any = null
    try {
      const { data: rpcMetrics, error: rpcErr } = await supabase.rpc('get_agency_executive_metrics', {
        p_agency_id: agencyId,
      })
      if (!rpcErr && rpcMetrics) {
        dbMetrics = rpcMetrics
      }
    } catch {
      // Fallback gracefully to selective query aggregations
    }

    // 1g. Unassigned/Orphaned Properties Detection & Arrears at Risk
    const unassignedProperties = properties.filter((p) => !p.manager_id)
    const unassignedPropertyIds = new Set(unassignedProperties.map((p) => p.id))
    const unassignedUnits = units.filter((u) => unassignedPropertyIds.has(u.property_id))
    const unassignedUnitIds = new Set(unassignedUnits.map((u) => u.id))
    const unassignedTickets = tickets.filter(
      (t) => unassignedUnitIds.has(t.unit_id) && t.status !== 'Resolved'
    )

    let unassignedArrears = 0
    transactions.forEach((t) => {
      if (t.property_id && unassignedPropertyIds.has(t.property_id)) {
        if (['expense', 'deduction', 'repair_cost'].includes(t.transaction_type)) {
          unassignedArrears += Number(t.amount || 0)
        } else if (['income', 'payment'].includes(t.transaction_type)) {
          unassignedArrears -= Number(t.amount || 0)
        }
      }
    })
    unassignedArrears = Math.max(0, unassignedArrears)

    const finalMtdRevenue = dbMetrics ? Number(dbMetrics.mtd_revenue || 0) : mtdRevenue
    const finalGlobalArrears = dbMetrics ? Number(dbMetrics.total_arrears || 0) : totalGlobalArrears
    const finalDepositsInTrust = dbMetrics ? Number(dbMetrics.deposits_in_trust || 0) : totalDepositsInTrust
    const finalOccupancyRate = dbMetrics
      ? Number(dbMetrics.occupancy_rate || 0)
      : units.length > 0 ? Math.round((units.filter((u) => u.is_occupied).length / units.length) * 100) : 0
    const finalUnassignedCount = dbMetrics ? Number(dbMetrics.unassigned_sites || 0) : unassignedProperties.length
    const finalUnassignedTickets = dbMetrics ? Number(dbMetrics.unassigned_tickets || 0) : unassignedTickets.length
    const finalUnassignedArrears = dbMetrics ? Number(dbMetrics.unassigned_arrears || 0) : unassignedArrears

    // 1h. Fetch property manager profiles to evaluate coordinator performance
    const { data: managerProfiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, role')
      .eq('agency_id', agencyId)
      .eq('role', 'property_manager')

    const managerMap = new Map<string, string>()
    managerProfiles?.forEach((m) => {
      managerMap.set(m.id, `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'Coordinator')
    })

    // 1i. Portfolio Health & SLA ranking per property
    const propertyHealthList = properties.map((property) => {
      const propUnits = units.filter((u) => u.property_id === property.id)
      const propUnitIds = new Set(propUnits.map((u) => u.id))
      const propTickets = tickets.filter((t) => propUnitIds.has(t.unit_id))

      const openTickets = propTickets.filter((t) => t.status !== 'Resolved')
      const slaBreaches = openTickets.filter((t) => {
        const ageHours = (nowMs - new Date(t.created_at).getTime()) / (1000 * 60 * 60)
        return ageHours >= 48
      })

      const assignedManagerName = property.manager_id
        ? managerMap.get(property.manager_id) || 'Assigned Coordinator'
        : 'Unassigned'

      const occupiedCount = propUnits.filter((u) => u.is_occupied).length

      return {
        property,
        assignedManagerName,
        isAssigned: Boolean(property.manager_id),
        totalUnits: propUnits.length,
        occupiedUnits: occupiedCount,
        openTicketsCount: openTickets.length,
        slaBreachCount: slaBreaches.length,
      }
    })

    // Rank properties with the highest number of SLA breaches first
    propertyHealthList.sort((a, b) => b.slaBreachCount - a.slaBreachCount)

    const totalOccupiedUnits = units.filter((u) => u.is_occupied).length
    const totalSlaBreaches = dbMetrics ? Number(dbMetrics.sla_breaches || 0) : propertyHealthList.reduce((sum, p) => sum + p.slaBreachCount, 0)

    const currentMonthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' })

    return (
      <div className="p-4 md:p-8 text-slate-900 w-full max-w-7xl mx-auto space-y-8">
        {/* Institutional Executive Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between pb-6 border-b border-slate-200 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-900 text-white shadow-xs">
                Agency Executive Oversight
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {properties.length} Sites &bull; {units.length} Units Portfolio
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 font-sans">
              Executive Overview
            </h1>
            <p className="text-xs md:text-sm text-slate-500 mt-1">
              Macro portfolio financials, custodial trust custody, and coordinator SLA compliance monitoring.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/dashboard/team"
              className="bg-slate-900 hover:bg-slate-800 hover:shadow-md text-white px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ease-in-out text-xs font-semibold shadow-xs flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
              <span>Manage & Delegate Team</span>
            </Link>
            <Link
              href="/dashboard/financials"
              className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-all duration-200 ease-in-out text-xs font-semibold shadow-xs"
            >
              Financial Ledger
            </Link>
            <Link
              href="/dashboard/deposits"
              className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-all duration-200 ease-in-out text-xs font-semibold shadow-xs"
            >
              Deposit Vault
            </Link>
          </div>
        </header>

        {/* UNASSIGNED SITES OPERATIONAL ALERT BANNER */}
        {finalUnassignedCount > 0 && (
          <div className="p-5 bg-white border border-rose-200/80 rounded-xl shadow-xs border-l-4 border-l-rose-500 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">
                    Operational Risk: {finalUnassignedCount} Unassigned Portfolio {finalUnassignedCount === 1 ? 'Site' : 'Sites'}
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 uppercase tracking-wider">
                    Delegation Required
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Sites without an assigned coordinator do not trigger daily coordinator action alerts.{' '}
                  <strong className="text-slate-900">{finalUnassignedTickets} open maintenance tickets</strong> and{' '}
                  <strong className="text-slate-900">KES {finalUnassignedArrears.toLocaleString()} in dues</strong> are currently unmonitored.
                </p>
              </div>
            </div>

            <Link
              href="/dashboard/team"
              className="shrink-0 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition shadow-xs flex items-center gap-1.5 self-start md:self-auto"
            >
              <span>Delegate Sites to Coordinators</span>
              <span>&rarr;</span>
            </Link>
          </div>
        )}

        {/* 
          =======================================================================
          MODERN BENTO GRID CSS LAYOUT FOR EXECUTIVE METRICS
          =======================================================================
        */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
          {/* Card 1: Total Agency Revenue (MTD) */}
          <div className="lg:col-span-4 bg-white shadow-sm border border-slate-200 rounded-xl p-6 flex flex-col justify-between hover:border-slate-300 transition-colors">
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Total Agency Revenue (MTD)
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  {currentMonthLabel}
                </span>
              </div>
              <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                KES {finalMtdRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">Rent & billing collected</span>
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Active Inflow
              </span>
            </div>
          </div>

          {/* Card 2: Total Arrears (Global Unpaid Rent) */}
          <div className="lg:col-span-4 bg-white shadow-sm border border-slate-200 rounded-xl p-6 flex flex-col justify-between hover:border-slate-300 transition-colors">
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Total Arrears (Global)
                </span>
                {finalGlobalArrears > 0 ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                    Payment Due
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    Account Settled
                  </span>
                )}
              </div>
              <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                KES {finalGlobalArrears.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">Global unpaid tenant arrears</span>
              {finalGlobalArrears > 0 ? (
                <span className="text-rose-700 font-semibold text-[11px]">
                  Recovery Action Required
                </span>
              ) : (
                <span className="text-emerald-700 font-medium text-[11px]">
                  0 Arrears Portfolio-Wide
                </span>
              )}
            </div>
          </div>

          {/* Card 3: Total Deposits in Trust */}
          <div className="lg:col-span-4 bg-white shadow-sm border border-slate-200 rounded-xl p-6 flex flex-col justify-between hover:border-slate-300 transition-colors">
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Total Deposits in Trust
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  Custodial Escrow
                </span>
              </div>
              <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                KES {finalDepositsInTrust.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">{activeLeases.length} Active Leases</span>
              <span className="text-slate-700 font-medium text-[11px] inline-flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
                </svg>
                100% Segregated
              </span>
            </div>
          </div>

          {/* Bento Sub-row: Card 4 (Occupancy Capacity) */}
          <div className="lg:col-span-6 bg-white shadow-sm border border-slate-200 rounded-xl p-6 flex flex-col justify-between hover:border-slate-300 transition-colors">
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Portfolio Occupancy
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  {finalOccupancyRate}% Occupied
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {totalOccupiedUnits}
                </p>
                <span className="text-sm font-medium text-slate-500">
                  of {units.length} total units occupied
                </span>
              </div>
              {/* Progress Bar */}
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mt-4">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, finalOccupancyRate)}%` }}
                />
              </div>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">Vacant units ready to lease:</span>
              <span className="font-semibold text-slate-800 tabular-nums">
                {units.length - totalOccupiedUnits} Units
              </span>
            </div>
          </div>

          {/* Bento Sub-row: Card 5 (SLA Compliance & Maintenance) */}
          <div className="lg:col-span-6 bg-white shadow-sm border border-slate-200 rounded-xl p-6 flex flex-col justify-between hover:border-slate-300 transition-colors">
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Coordinator SLA Performance
                </span>
                {totalSlaBreaches > 0 ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">
                    {totalSlaBreaches} Critical Breaches
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    100% Compliant
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {tickets.filter((t) => t.status !== 'Resolved').length}
                </p>
                <span className="text-sm font-medium text-slate-500">
                  active maintenance tickets across all sites
                </span>
              </div>
              <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                {totalSlaBreaches > 0 ? (
                  <div className="flex items-center gap-2 text-rose-700">
                    <span className="font-bold text-xs">Action Required:</span>
                    <span>{totalSlaBreaches} unresolved ticket(s) exceed 48-hour resolution standard.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-emerald-700">
                    <span className="font-semibold text-xs">Zero SLA Violations:</span>
                    <span>All open tickets are within the institutional 48-hour window.</span>
                  </div>
                )}
              </div>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">Total tickets handled:</span>
              <span className="font-semibold text-slate-800 tabular-nums">
                {tickets.length} tickets recorded
              </span>
            </div>
          </div>
        </div>

        {/* 
          =======================================================================
          PORTFOLIO HEALTH & COORDINATOR SLA SECTION
          =======================================================================
        */}
        <section className="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                  Portfolio Health
                </span>
                <span className="text-xs text-slate-500 font-medium">SLA Accountability Ranking</span>
              </div>
              <h2 className="text-base md:text-lg font-bold tracking-tight text-slate-900">
                Site Operational Performance & SLA Ranking
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Properties prioritized by overdue maintenance tickets exceeding the 48-hour Service Level Agreement.
              </p>
            </div>

            <Link
              href="/dashboard/team"
              className="text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-lg transition shadow-xs self-start sm:self-auto flex items-center gap-1.5"
            >
              <span>Delegation Roster</span>
              <span>&rarr;</span>
            </Link>
          </div>

          {propertyHealthList.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">
              No property sites registered under your agency yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 font-semibold text-slate-600 uppercase text-[10px] tracking-wider">
                    <th className="p-4 pl-6">Property Site</th>
                    <th className="p-4">Assigned Coordinator</th>
                    <th className="p-4">Occupancy</th>
                    <th className="p-4 text-center">Open Tickets</th>
                    <th className="p-4 text-center">48h SLA Breaches</th>
                    <th className="p-4 text-right">Operational Status</th>
                    <th className="p-4 pr-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {propertyHealthList.map((item) => {
                    const hasBreaches = item.slaBreachCount > 0
                    const isAllClear = item.openTicketsCount === 0

                    return (
                      <tr key={item.property.id} className="hover:bg-slate-50/70 transition">
                        <td className="p-4 pl-6 whitespace-nowrap">
                          <Link
                            href={`/dashboard/property/${item.property.id}`}
                            className="font-bold text-slate-900 text-sm hover:text-emerald-600 transition"
                          >
                            {item.property.name}
                          </Link>
                          <p className="text-slate-400 text-[11px] mt-0.5">{item.property.location}</p>
                        </td>

                        <td className="p-4 whitespace-nowrap">
                          {item.isAssigned ? (
                            <span className="inline-flex items-center gap-1.5 font-medium text-slate-800 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full text-[11px]">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              {item.assignedManagerName}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-100 px-2.5 py-1 rounded-full border border-rose-200 text-[11px]">
                              ⚠️ Unassigned
                            </span>
                          )}
                        </td>

                        <td className="p-4 whitespace-nowrap">
                          <span className="font-semibold text-slate-900 tabular-nums">
                            {item.occupiedUnits} / {item.totalUnits} Units
                          </span>
                          <span className="text-slate-400 block text-[10px] mt-0.5">
                            {item.totalUnits > 0 ? `${Math.round((item.occupiedUnits / item.totalUnits) * 100)}% Occupied` : '0 Units'}
                          </span>
                        </td>

                        <td className="p-4 text-center whitespace-nowrap">
                          <span className="font-bold text-slate-800 tabular-nums text-sm">
                            {item.openTicketsCount}
                          </span>
                        </td>

                        <td className="p-4 text-center whitespace-nowrap">
                          {hasBreaches ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                              <span>{item.slaBreachCount} Breaches</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                              0 Overdue
                            </span>
                          )}
                        </td>

                        <td className="p-4 text-right whitespace-nowrap">
                          {!item.isAssigned ? (
                            <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200">
                              Needs Coordinator
                            </span>
                          ) : hasBreaches ? (
                            <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200">
                              SLA Breach
                            </span>
                          ) : isAllClear ? (
                            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60">
                              100% Compliant
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60">
                              Within 48h SLA
                            </span>
                          )}
                        </td>

                        <td className="p-4 pr-6 text-right whitespace-nowrap">
                          <Link
                            href={`/dashboard/property/${item.property.id}`}
                            className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition hover:underline"
                          >
                            View Site &rarr;
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    )
  }

  // =========================================================================
  // 2. PROPERTY COORDINATOR: TACTICAL DAILY ACTION CENTER
  // =========================================================================

  // Strictly fetch only properties where manager_id matches the logged-in coordinator
  const { data: coordinatorProperties } = await supabase
    .from('properties')
    .select('*')
    .eq('agency_id', agencyId)
    .eq('manager_id', userId)
    .order('name', { ascending: true })

  const assignedProperties = coordinatorProperties || []
  const propertyIds = assignedProperties.map((p) => p.id)
  const propertyMap = new Map<string, string>()
  assignedProperties.forEach((p) => propertyMap.set(p.id, p.name))

  // Fetch all units in coordinator's assigned properties
  let assignedUnits: any[] = []
  if (propertyIds.length > 0) {
    const { data: units } = await supabase
      .from('units')
      .select(`
        id,
        unit_number,
        base_rent,
        is_occupied,
        bedrooms,
        bathrooms,
        property_id
      `)
      .in('property_id', propertyIds)
      .order('unit_number', { ascending: true })

    assignedUnits = units || []
  }

  const unitIds = assignedUnits.map((u) => u.id)
  const unitMap = new Map<string, any>()
  assignedUnits.forEach((u) => unitMap.set(u.id, u))

  const vacantUnits = assignedUnits.filter((u) => !u.is_occupied)

  // Fetch tenants for phone and name mapping
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, first_name, last_name, phone')
    .eq('agency_id', agencyId)

  const tenantMap = new Map<string, any>()
  tenants?.forEach((t) => tenantMap.set(t.id, t))

  // Fetch Pending Maintenance for assigned units
  let pendingTickets: any[] = []
  if (unitIds.length > 0) {
    const { data: tickets } = await supabase
      .from('maintenance_tickets')
      .select(`
        id,
        issue_description,
        status,
        created_at,
        unit_id,
        assigned_to,
        cost,
        contractors ( name, specialty )
      `)
      .in('unit_id', unitIds)
      .neq('status', 'Resolved')
      .order('created_at', { ascending: true })

    pendingTickets = tickets || []
  }

  // Fetch Overdue Rent & Bills for assigned properties
  let overdueBills: any[] = []
  if (propertyIds.length > 0) {
    const { data: transactions } = await supabase
      .from('transactions')
      .select(`
        id,
        property_id,
        unit_id,
        tenant_id,
        transaction_type,
        amount,
        transaction_date,
        description
      `)
      .in('property_id', propertyIds)
      .in('transaction_type', ['expense', 'deduction', 'repair_cost'])
      .order('transaction_date', { ascending: true })

    overdueBills = transactions || []
  }

  // Fetch Expiring Leases within next 60 days for coordinator's assigned units
  let expiringLeases: any[] = []
  if (unitIds.length > 0) {
    const { data: rawLeases, error: leaseErr } = await supabase
      .from('leases')
      .select(`
        id,
        start_date,
        end_date,
        deposit_amount,
        renewal_status,
        is_active,
        unit_id,
        tenant_id,
        units (
          id,
          unit_number,
          base_rent,
          property_id,
          properties ( id, name, location )
        ),
        tenants (
          id,
          first_name,
          last_name,
          email,
          phone
        )
      `)
      .in('unit_id', unitIds)
      .eq('is_active', true)
      .not('end_date', 'is', null)
      .order('end_date', { ascending: true })

    let fetchedLeases = (rawLeases as any[]) || []

    // Defensive fallback if renewal_status column not yet migrated
    if (leaseErr && leaseErr.message?.includes('renewal_status')) {
      const { data: fallbackLeases } = await supabase
        .from('leases')
        .select(`
          id,
          start_date,
          end_date,
          deposit_amount,
          is_active,
          unit_id,
          tenant_id,
          units (
            id,
            unit_number,
            base_rent,
            property_id,
            properties ( id, name, location )
          ),
          tenants (
            id,
            first_name,
            last_name,
            email,
            phone
          )
        `)
        .in('unit_id', unitIds)
        .eq('is_active', true)
        .not('end_date', 'is', null)
        .order('end_date', { ascending: true })

      fetchedLeases = ((fallbackLeases as any[]) || []).map((l: any) => ({ ...l, renewal_status: 'active' }))
    }

    // Filter for end_date coming up within next 60 days (or expired / expiring soon)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const sixtyDaysFromNow = new Date(now)
    sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60)

    expiringLeases = fetchedLeases.filter((lease: any) => {
      if (!lease.end_date) return false
      const end = new Date(lease.end_date)
      return end <= sixtyDaysFromNow
    })
  }

  const nowMs = Date.now()
  const slaBreachedTickets = pendingTickets.filter((t) => {
    const openHours = (nowMs - new Date(t.created_at).getTime()) / (1000 * 60 * 60)
    return openHours >= 48
  })

  const urgentExpiries = expiringLeases.filter((l) => {
    if (!l.end_date) return false
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const end = new Date(l.end_date)
    end.setHours(0, 0, 0, 0)
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diff <= 30
  }).length

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full max-w-7xl mx-auto">
      {/* Coordinator Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between mb-8 pb-4 border-b gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
              Property Coordinator
            </span>
            <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              Assigned Sites Only
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Daily Action Center</h1>
          <p className="text-sm text-gray-500 mt-1">
            Welcome back, {user?.email}. Take ownership of outstanding rents, water bills, and maintenance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/dashboard/clearance"
            className="bg-emerald-600 hover:bg-emerald-700 hover:shadow-md text-white px-4 py-2 rounded-xl cursor-pointer transition-all duration-200 ease-in-out font-medium text-xs shadow-xs flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Batch Utilities & Move-Out</span>
          </Link>
          <Link
            href="/dashboard/maintenance"
            className="border border-slate-200 bg-white text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-all duration-200 ease-in-out font-medium text-xs shadow-xs"
          >
            Maintenance Hub
          </Link>
        </div>
      </header>

      {/* QUICK STATUS METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
            Assigned Sites
          </span>
          <p className="text-3xl font-bold text-slate-800">{assignedProperties.length}</p>
          <span className="text-xs text-gray-400 mt-1 block">
            {assignedUnits.length} total managed units
          </span>
        </div>

        <div className="bg-white border rounded-xl p-5 shadow-sm border-b-4 border-b-amber-500">
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider block mb-1">
            Overdue Dues
          </span>
          <p className="text-3xl font-bold text-amber-900">{overdueBills.length}</p>
          <span className="text-xs text-amber-700 mt-1 block font-medium">
            Rent & utility follow-ups
          </span>
        </div>

        <div className="bg-white border rounded-xl p-5 shadow-sm border-b-4 border-b-rose-500">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider block">
              Open Maintenance
            </span>
            {slaBreachedTickets.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 animate-pulse">
                {slaBreachedTickets.length} Overdue
              </span>
            )}
          </div>
          <p className="text-3xl font-bold text-rose-900">{pendingTickets.length}</p>
          <span className="text-xs text-rose-600 mt-1 block">
            {slaBreachedTickets.length > 0
              ? `${slaBreachedTickets.length} breached 48h SLA`
              : 'All within 48h SLA'}
          </span>
        </div>

        <div className="bg-white border rounded-xl p-5 shadow-sm border-b-4 border-b-blue-600">
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider block mb-1">
            Vacant Units
          </span>
          <p className="text-3xl font-bold text-blue-950">{vacantUnits.length}</p>
          <span className="text-xs text-blue-600 mt-1 block">
            Available for immediate leasing
          </span>
        </div>

        <div className="bg-white border rounded-xl p-5 shadow-sm border-b-4 border-b-indigo-500 col-span-2 lg:col-span-1">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider block">
              Lease Expiries
            </span>
            {urgentExpiries > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                {urgentExpiries} &le; 30d
              </span>
            )}
          </div>
          <p className="text-3xl font-bold text-indigo-950">{expiringLeases.length}</p>
          <span className="text-xs text-indigo-700 mt-1 block font-medium">
            Within 60-day horizon
          </span>
        </div>
      </div>

      {/* LEASE RENEWALS & EXPIRIES PIPELINE (HIGH-PRIORITY DATA TABLE) */}
      <LeaseExpiryWidget leases={expiringLeases} />

      {/* DAILY ACTION CENTER (3 PRIORITY COLUMNS) */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span>Daily Action Center</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </h2>
            <p className="text-xs text-gray-500">
              Immediate operational priorities requiring coordinator follow-up across your assigned sites.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* COLUMN 1: Overdue Rent & Bills */}
          <div className="bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b bg-gradient-to-r from-amber-50 to-orange-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg text-xs">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                <h3 className="font-bold text-sm text-slate-900">Overdue Rent & Bills</h3>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900">
                {overdueBills.length}
              </span>
            </div>

            <div className="p-3 divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
              {overdueBills.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500">
                  <svg className="w-8 h-8 text-emerald-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="font-semibold text-slate-700">All Accounts Settled</p>
                  <p className="text-gray-400 mt-0.5">No pending rent or water bills in your assigned sites.</p>
                </div>
              ) : (
                overdueBills.map((bill) => {
                  const propName = propertyMap.get(bill.property_id) || 'Assigned Site'
                  const unit = unitMap.get(bill.unit_id)
                  const tenant = tenantMap.get(bill.tenant_id)
                  const tenantName = tenant ? `${tenant.first_name} ${tenant.last_name}` : 'Tenant'

                  return (
                    <div key={bill.id} className="py-3 first:pt-1 last:pb-1 text-xs">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <div>
                          <p className="font-bold text-slate-900 text-sm tabular-nums">
                            KES {Number(bill.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-gray-600 font-medium">{bill.description}</p>
                        </div>
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                          Payment Due
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1">
                        <span>
                          {propName} {unit ? `• Unit #${unit.unit_number}` : ''}
                        </span>
                        <span className="font-medium text-slate-700">{tenantName}</span>
                      </div>

                      <div className="mt-2 flex items-center justify-between pt-1 border-t border-gray-50">
                        <span className="text-[10px] text-gray-400">
                          Posted: {new Date(bill.transaction_date).toLocaleDateString()}
                        </span>
                        <Link
                          href="/dashboard/clearance"
                          className="text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                        >
                          Follow Up &rarr;
                        </Link>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* COLUMN 2: Pending Maintenance */}
          <div className="bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b bg-gradient-to-r from-rose-50 to-orange-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-rose-100 text-rose-800 rounded-lg text-xs">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </span>
                <h3 className="font-bold text-sm text-slate-900">Pending Maintenance</h3>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-200/80 text-rose-900">
                {pendingTickets.length}
              </span>
            </div>

            <div className="p-3 divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
              {pendingTickets.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500">
                  <svg className="w-8 h-8 text-emerald-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="font-semibold text-slate-700">Zero Pending Tickets</p>
                  <p className="text-gray-400 mt-0.5">All repairs on assigned sites have been resolved.</p>
                </div>
              ) : (
                pendingTickets.map((ticket) => {
                  const unit = unitMap.get(ticket.unit_id)
                  const propName = unit ? propertyMap.get(unit.property_id) || 'Site' : 'Site'
                  const openHours = Math.floor(
                    (nowMs - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60)
                  )
                  const isSlaBreach = openHours >= 48

                  return (
                    <div key={ticket.id} className="py-3 first:pt-1 last:pb-1 text-xs">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <h4 className="font-bold text-slate-900 text-sm line-clamp-1">
                          {ticket.issue_description}
                        </h4>
                        <SlaBadge createdAt={ticket.created_at} />
                      </div>

                      <p className="text-gray-600 text-[11px] mb-1.5">
                        {propName} • Unit #{unit?.unit_number || 'N/A'}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-gray-500 border-t border-gray-50 pt-1.5 mt-1">
                        <span className="text-slate-600 font-medium">
                          {ticket.contractors?.name ? `Contractor: ${ticket.contractors.name}` : '⚠️ Unassigned Contractor'}
                        </span>
                        <Link
                          href="/dashboard/maintenance"
                          className="text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                        >
                          Manage Ticket &rarr;
                        </Link>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* COLUMN 3: Vacant Units */}
          <div className="bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-100 text-blue-800 rounded-lg text-xs">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </span>
                <h3 className="font-bold text-sm text-slate-900">Vacant Units</h3>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-200/80 text-blue-950">
                {vacantUnits.length}
              </span>
            </div>

            <div className="p-3 divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
              {vacantUnits.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500">
                  <svg className="w-8 h-8 text-emerald-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="font-semibold text-slate-700">100% Occupancy</p>
                  <p className="text-gray-400 mt-0.5">No vacant units across your assigned sites.</p>
                </div>
              ) : (
                vacantUnits.map((unit) => {
                  const propName = propertyMap.get(unit.property_id) || 'Site'

                  return (
                    <div key={unit.id} className="py-3 first:pt-1 last:pb-1 text-xs">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">
                            Unit #{unit.unit_number}
                          </p>
                          <p className="text-gray-600">{propName}</p>
                        </div>
                        <span className="font-bold text-slate-900 text-sm tabular-nums">
                          KES {Number(unit.base_rent || 0).toLocaleString()}
                          <span className="text-[10px] text-gray-400 font-normal">/mo</span>
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1 border-t border-gray-50 pt-1.5">
                        <span>
                          {unit.bedrooms || 0} Bed &bull; {unit.bathrooms || 0} Bath
                        </span>
                        <Link
                          href="/dashboard/leases/new"
                          className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-semibold px-2 py-0.5 rounded transition"
                        >
                          + Create Lease
                        </Link>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </section>

      {/* COORDINATOR ASSIGNED SITES ROSTER */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Your Assigned Sites</h2>
            <p className="text-xs text-gray-500">Properties delegated to your coordinator management.</p>
          </div>
        </div>

        {assignedProperties.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500 bg-gray-50 rounded-xl border border-dashed">
            <p className="font-semibold text-slate-700 text-sm">No Sites Delegated Yet</p>
            <p className="text-gray-400 mt-1">
              Your Agency Owner has not assigned any properties to your account yet. Contact them to delegate site portfolios.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {assignedProperties.map((property) => {
              const propUnits = assignedUnits.filter((u) => u.property_id === property.id)
              const propVacancies = propUnits.filter((u) => !u.is_occupied).length

              return (
                <Link
                  href={`/dashboard/property/${property.id}`}
                  key={property.id}
                  className="block p-5 border rounded-xl shadow-sm hover:shadow-md hover:border-blue-300 transition bg-gray-50/50"
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-lg text-slate-900">{property.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-800">
                      Assigned Site
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{property.location}</p>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-200/80 text-gray-600">
                    <span>{propUnits.length} Units</span>
                    <span className={propVacancies > 0 ? 'text-amber-700 font-semibold' : 'text-emerald-700 font-medium'}>
                      {propVacancies > 0 ? `${propVacancies} Vacant` : 'Fully Occupied'}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}