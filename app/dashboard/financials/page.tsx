// app/dashboard/financials/page.tsx
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'
import { redirect } from 'next/navigation'
import { addTransaction, deleteTransaction } from './actions'
import ExportReportButton, { RentReportData } from '@/app/dashboard/components/ExportReportButton'

export default async function FinancialsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const message = resolvedSearchParams.message

  const supabase = await createClient()
  const { agencyId, role } = await getUserAgencyContext()

  // Strict Access Control: Financial ledger is reserved for Agency Owner
  if (role !== 'agency_owner') {
    redirect('/dashboard?message=Access restricted: Global financials are reserved for Agency Owners.')
  }

  // 1. Fetch agency profile for report header
  const { data: agencyData } = await supabase
    .from('agencies')
    .select('name')
    .eq('id', agencyId)
    .single()

  // 2. Fetch properties for dropdown and label mapping
  const { data: properties } = await supabase
    .from('properties')
    .select('id, name')
    .eq('agency_id', agencyId)
    .order('name', { ascending: true })

  const propertyMap = new Map<string, string>()
  properties?.forEach((p) => {
    propertyMap.set(p.id, p.name)
  })

  // 3. Fetch all historical transactions
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
    .eq('agency_id', agencyId)
    .order('transaction_date', { ascending: false })

  const transactionList = transactions || []

  // 4. Fetch active leases and occupants for billing cycle reconciliation
  const { data: activeLeasesData } = await supabase
    .from('leases')
    .select(`
      id,
      unit_id,
      tenant_id,
      deposit_amount,
      start_date,
      end_date,
      is_active,
      units (
        id,
        unit_number,
        base_rent,
        property_id,
        properties ( id, name )
      ),
      tenants (
        id,
        first_name,
        last_name,
        phone_number,
        email
      )
    `)
    .eq('agency_id', agencyId)
    .eq('is_active', true)

  const activeLeases = activeLeasesData || []

  // 5. Calculate summary metrics for ledger
  const totalIncome = transactionList
    .filter((t) => ['income', 'payment'].includes(t.transaction_type))
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)

  const totalExpenses = transactionList
    .filter((t) => ['expense', 'deduction', 'repair_cost'].includes(t.transaction_type))
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)

  const netProfit = totalIncome - totalExpenses
  const todayDate = new Date().toISOString().split('T')[0]
  const isSuccess = message && message.toLowerCase().includes('success')

  // 6. Compute Real Estate Rent Payment Summary Report (Current Billing Period)
  const now = new Date()
  const currentMonthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  // Filter income payments recorded in current billing month
  const currentPeriodIncome = transactionList.filter((t) => {
    const isIncome = ['income', 'payment'].includes(t.transaction_type)
    const isThisPeriod = t.transaction_date && t.transaction_date >= startOfMonth
    return isIncome && isThisPeriod
  })

  // Map and reconcile transactions against leases
  const matchedTxIds = new Set<string>()

  const unpaidTenants: RentReportData['unpaidTenants'] = []
  const partialPayments: RentReportData['partialPayments'] = []
  const paidOverpaid: RentReportData['paidOverpaid'] = []

  activeLeases.forEach((lease: any) => {
    const tenant = lease.tenants
    const unit = lease.units
    const property = unit?.properties
    const tenantName = tenant
      ? `${tenant.first_name || ''} ${tenant.last_name || ''}`.trim()
      : 'Unnamed Occupant'
    const unitNumber = unit?.unit_number ? `Unit ${unit.unit_number}` : 'Unassigned Unit'
    const propertyName = property?.name || 'Property Site'
    const phone = tenant?.phone_number || ''
    const expectedRent = Number(unit?.base_rent || 0)

    // Match criteria: explicit tenant_id, unit_id, or description heuristic
    const matchedTxs = currentPeriodIncome.filter((t) => {
      if (matchedTxIds.has(t.id)) return false
      if (t.tenant_id && lease.tenant_id && t.tenant_id === lease.tenant_id) return true
      if (t.unit_id && lease.unit_id && t.unit_id === lease.unit_id) return true
      if (t.description) {
        const desc = t.description.toLowerCase()
        if (tenantName.length > 2 && desc.includes(tenantName.toLowerCase())) return true
        if (unit?.unit_number && desc.includes(`unit ${unit.unit_number.toLowerCase()}`)) return true
      }
      return false
    })

    matchedTxs.forEach((t) => matchedTxIds.add(t.id))

    const paidAmount = matchedTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0)
    const txCodes = matchedTxs
      .map((t) => (t.id ? `TX-${t.id.slice(0, 8).toUpperCase()}` : 'TX-PAID'))
      .join(', ')

    if (paidAmount === 0) {
      unpaidTenants.push({
        name: tenantName,
        unit: unitNumber,
        property: propertyName,
        phone,
        expectedRent,
        amountDue: expectedRent,
      })
    } else if (paidAmount < expectedRent) {
      partialPayments.push({
        name: tenantName,
        unit: unitNumber,
        property: propertyName,
        phone,
        expectedRent,
        paidAmount,
        amountDue: expectedRent - paidAmount,
        txCodes,
      })
    } else {
      paidOverpaid.push({
        name: tenantName,
        unit: unitNumber,
        property: propertyName,
        phone,
        expectedRent,
        paidAmount,
        txCodes,
        status: paidAmount > expectedRent ? 'Overpaid' : 'Fully Paid',
      })
    }
  })

  // Identify untraced transactions in current period not bound to an active lease
  const untracedTransactions: RentReportData['untracedTransactions'] = currentPeriodIncome
    .filter((t) => !matchedTxIds.has(t.id))
    .map((t) => ({
      description: t.description || 'Unidentified Payment Receipt',
      date: t.transaction_date,
      amount: Number(t.amount || 0),
      txCode: t.id ? `TX-${t.id.slice(0, 8).toUpperCase()}` : 'TX-UNKNOWN',
    }))

  const totalExpectedRent = activeLeases.reduce(
    (sum: number, l: any) => sum + Number(l.units?.base_rent || 0),
    0
  )
  const totalCollectedRent =
    paidOverpaid.reduce((sum, p) => sum + p.paidAmount, 0) +
    partialPayments.reduce((sum, p) => sum + p.paidAmount, 0) +
    untracedTransactions.reduce((sum, u) => sum + u.amount, 0)

  const collectionRate =
    totalExpectedRent > 0 ? (totalCollectedRent / totalExpectedRent) * 100 : 0

  const rentReportData: RentReportData = {
    billingPeriod: currentMonthName,
    generatedAt: new Date().toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }),
    agencyName: agencyData?.name || 'Institutional Real Estate Portfolio',
    summaryMetrics: {
      expectedRent: totalExpectedRent,
      collectedRent: totalCollectedRent,
      collectionRate,
      fullyPaidCount: paidOverpaid.length,
      partialPayCount: partialPayments.length,
      unpaidCount: unpaidTenants.length,
      untracedCount: untracedTransactions.length,
    },
    unpaidTenants,
    partialPayments,
    untracedTransactions,
    paidOverpaid,
  }

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-900 text-white shadow-xs">
              Executive Financial Audit
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Institutional Trust Tier &bull; {transactionList.length} Ledger Records
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 font-sans">
            Financial Ledger
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Portfolio cash flow ledger, verified rent collections, operating expenses, and net profit audit.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <ExportReportButton reportData={rentReportData} />
        </div>
      </header>

      {/* Message Feedback Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl text-xs font-medium border flex items-center justify-between ${
            isSuccess
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span>{message}</span>
        </div>
      )}

      {/* 
        =======================================================================
        TOP ROW: THREE PREMIUM SUMMARY CARDS
        =======================================================================
      */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Income */}
        <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6 flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Income
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                Verified Receipts
              </span>
            </div>
            <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums my-2">
              KES {totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Gross revenue collected</span>
            <span className="text-emerald-700 font-semibold inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Active Inflows
            </span>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6 flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Expenses
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                Disbursements
              </span>
            </div>
            <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums my-2">
              KES {totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Operational expenditures</span>
            <span className="text-rose-700 font-semibold">Repairs & Utilities</span>
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6 flex flex-col justify-between hover:border-slate-300 transition-colors">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Net Profit
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                  netProfit >= 0
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {netProfit >= 0 ? 'Surplus' : 'Deficit'}
              </span>
            </div>
            <p
              className={`text-3xl font-bold tracking-tight tabular-nums my-2 ${
                netProfit >= 0 ? 'text-slate-900' : 'text-rose-700'
              }`}
            >
              {netProfit < 0 ? '-' : '+'}KES{' '}
              {Math.abs(netProfit).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Net Operating Income</span>
            <span className="text-slate-700 font-medium">Income minus Expenses</span>
          </div>
        </div>
      </div>

      {/* 
        =======================================================================
        RECORD ENTRY FORM
        =======================================================================
      */}
      <section className="bg-white shadow-sm border border-slate-200 rounded-xl p-6">
        <div className="pb-4 mb-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Record Ledger Entry</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Log verified income, maintenance contractor payments, or municipal utility disbursements.
            </p>
          </div>
        </div>

        <form action={addTransaction} className="space-y-4">
          {/* Income / Expense Toggle */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Transaction Classification <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <label className="flex items-center justify-center gap-2 p-3 border border-slate-200 rounded-lg cursor-pointer transition has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50/70 hover:bg-slate-50">
                <input
                  type="radio"
                  name="transaction_type"
                  value="income"
                  defaultChecked
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-xs text-emerald-800">Income (+)</span>
              </label>
              <label className="flex items-center justify-center gap-2 p-3 border border-slate-200 rounded-lg cursor-pointer transition has-[:checked]:border-rose-600 has-[:checked]:bg-rose-50/70 hover:bg-slate-50">
                <input
                  type="radio"
                  name="transaction_type"
                  value="expense"
                  className="text-rose-600 focus:ring-rose-500"
                />
                <span className="font-semibold text-xs text-rose-800">Expense (-)</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="amount">
                Amount (KES) <span className="text-rose-500">*</span>
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g. 50000.00"
                required
                className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition font-mono font-bold"
              />
            </div>

            {/* Date Picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="transaction_date">
                Transaction Date <span className="text-rose-500">*</span>
              </label>
              <input
                id="transaction_date"
                name="transaction_date"
                type="date"
                defaultValue={todayDate}
                required
                className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
              />
            </div>

            {/* Property Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="property_id">
                Property Site (Optional)
              </label>
              <select
                id="property_id"
                name="property_id"
                className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                defaultValue=""
              >
                <option value="">-- Portfolio Wide / General --</option>
                {properties?.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="description">
              Entry Description <span className="text-rose-500">*</span>
            </label>
            <input
              id="description"
              name="description"
              type="text"
              placeholder="e.g. Monthly rent Unit 4B, Elevator maintenance contractor, KPLC site meter"
              required
              className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="bg-slate-900 hover:bg-slate-800 hover:shadow-md text-white font-semibold text-xs py-2.5 px-6 rounded-lg cursor-pointer transition-all duration-200 ease-in-out shadow-xs"
            >
              Record Transaction Entry
            </button>
          </div>
        </form>
      </section>

      {/* 
        =======================================================================
        THE LEDGER TABLE (CLEAN WHITE CONTAINER & COLOR-CODED CASH FLOW)
        =======================================================================
      */}
      <section className="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 bg-white flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Historical Ledger Records</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Auditable record of all income receipts and operational disbursements.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 tabular-nums">
            {transactionList.length} Transactions
          </span>
        </div>

        {transactionList.length === 0 ? (
          /* Beautiful Minimalist Empty State */
          <div className="p-16 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900">No Transactions Recorded</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No ledger entries have been logged yet. Use the record entry form above to log the first verified income receipt or operational expense.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 tracking-wider text-[10px] font-semibold text-slate-500 uppercase">
                  <th className="p-4 pl-6 text-left">Transaction Date</th>
                  <th className="p-4 text-left">Description</th>
                  <th className="p-4 text-left">Property Scope</th>
                  <th className="p-4 text-center">Cash Flow Type</th>
                  <th className="p-4 text-right">Amount (KES)</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactionList.map((t) => {
                  const isIncome = ['income', 'payment'].includes(t.transaction_type)
                  const propertyName = t.property_id
                    ? propertyMap.get(t.property_id) || 'Assigned Property'
                    : 'Portfolio Wide'

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-4 pl-6 text-slate-700 whitespace-nowrap tabular-nums font-medium">
                        {new Date(t.transaction_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>

                      <td className="p-4 font-semibold text-slate-900">
                        {t.description}
                      </td>

                      <td className="p-4 text-slate-600 whitespace-nowrap">
                        {t.property_id ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-800">
                            {propertyName}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Portfolio General</span>
                        )}
                      </td>

                      <td className="p-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            isIncome
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {isIncome ? 'Income' : 'Expense'}
                        </span>
                      </td>

                      {/* Color-Coded Cash Flow with tabular-nums */}
                      <td
                        className={`p-4 text-right font-bold whitespace-nowrap tabular-nums text-sm ${
                          isIncome ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {isIncome ? '+KES ' : '-KES '}
                        {Number(t.amount).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      <td className="p-4 pr-6 text-right whitespace-nowrap">
                        <form action={deleteTransaction} className="inline-block">
                          <input type="hidden" name="id" value={t.id} />
                          <button
                            type="submit"
                            className="text-xs text-slate-400 hover:text-rose-600 hover:bg-slate-100 px-2.5 py-1 rounded-md cursor-pointer transition-all duration-200 ease-in-out"
                            title="Delete ledger entry"
                          >
                            Delete
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
    </div>
  )
}
