// app/dashboard/financials/page.tsx
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'
import { addTransaction, deleteTransaction } from './actions'

export default async function FinancialsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const message = resolvedSearchParams.message

  const supabase = await createClient()
  const { agencyId } = await getUserAgencyContext()

  // 1. Fetch properties for dropdown and label mapping
  const { data: properties } = await supabase
    .from('properties')
    .select('id, name')
    .eq('agency_id', agencyId)
    .order('name', { ascending: true })

  const propertyMap = new Map<string, string>()
  properties?.forEach((p) => {
    propertyMap.set(p.id, p.name)
  })

  // 2. Fetch all historical transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select(`
      id,
      property_id,
      transaction_type,
      amount,
      transaction_date,
      description
    `)
    .eq('agency_id', agencyId)
    .order('transaction_date', { ascending: false })

  const transactionList = transactions || []

  // 3. Calculate summary metrics
  const totalIncome = transactionList
    .filter((t) => t.transaction_type === 'income')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)

  const totalExpenses = transactionList
    .filter((t) => t.transaction_type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)

  const netProfit = totalIncome - totalExpenses
  const todayDate = new Date().toISOString().split('T')[0]
  const isSuccess = message && message.toLowerCase().includes('success')

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full max-w-7xl mx-auto">
      {/* Page Header */}
      <header className="mb-8 pb-4 border-b">
        <h1 className="text-3xl font-bold">Financial Ledger</h1>
        <p className="text-sm text-gray-500 mt-1">
          Monitor income, track operational expenses, and analyze cash flow.
        </p>
      </header>

      {/* Message Feedback Banner */}
      {message && (
        <div
          className={`mb-6 p-3 rounded-md text-sm border ${
            isSuccess
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {message}
        </div>
      )}

      {/* TOP ROW: SUMMARY METRIC CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Total Income */}
        <div className="bg-white border rounded-lg p-6 shadow-sm border-b-4 border-b-emerald-600">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Total Income
            </h3>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold">
              +
            </span>
          </div>
          <p className="text-3xl font-bold text-emerald-700">
            KES {totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400 mt-1">Total revenue collected</p>
        </div>

        {/* Total Expenses */}
        <div className="bg-white border rounded-lg p-6 shadow-sm border-b-4 border-b-rose-600">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Total Expenses
            </h3>
            <span className="p-2 bg-rose-50 text-rose-600 rounded-full text-xs font-bold">
              -
            </span>
          </div>
          <p className="text-3xl font-bold text-rose-700">
            KES {totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400 mt-1">Maintenance, bills & operations</p>
        </div>

        {/* Net Profit */}
        <div
          className={`bg-white border rounded-lg p-6 shadow-sm border-b-4 ${
            netProfit >= 0 ? 'border-b-blue-600' : 'border-b-amber-600'
          }`}
        >
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Net Profit
            </h3>
            <span
              className={`p-2 rounded-full text-xs font-bold ${
                netProfit >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
              }`}
            >
              =
            </span>
          </div>
          <p
            className={`text-3xl font-bold ${
              netProfit >= 0 ? 'text-slate-900' : 'text-amber-700'
            }`}
          >
            {netProfit < 0 ? '-' : ''}KES{' '}
            {Math.abs(netProfit).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="text-xs text-gray-400 mt-1">Income minus Expenses</p>
        </div>
      </div>

      {/* MIDDLE: 'ADD RECORD' FORM */}
      <section className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-slate-900">Add Record</h2>
        <form action={addTransaction} className="flex flex-col gap-4">
          
          {/* Income / Expense Toggle */}
          <div>
            <label className="block text-sm font-medium mb-2 text-slate-800">
              Transaction Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <label className="flex items-center justify-center gap-2 p-3 border rounded-md cursor-pointer transition has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50 hover:bg-gray-50">
                <input
                  type="radio"
                  name="transaction_type"
                  value="income"
                  defaultChecked
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-semibold text-sm text-emerald-800">Income (+)</span>
              </label>
              <label className="flex items-center justify-center gap-2 p-3 border rounded-md cursor-pointer transition has-[:checked]:border-rose-600 has-[:checked]:bg-rose-50 hover:bg-gray-50">
                <input
                  type="radio"
                  name="transaction_type"
                  value="expense"
                  className="text-rose-600 focus:ring-rose-500"
                />
                <span className="font-semibold text-sm text-rose-800">Expense (-)</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Amount */}
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-800" htmlFor="amount">
                Amount (KES) <span className="text-red-500">*</span>
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="e.g. 45000"
                required
                className="w-full rounded-md px-3 py-2 border bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Date Picker */}
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-800" htmlFor="transaction_date">
                Transaction Date <span className="text-red-500">*</span>
              </label>
              <input
                id="transaction_date"
                name="transaction_date"
                type="date"
                defaultValue={todayDate}
                required
                className="w-full rounded-md px-3 py-2 border bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Property Dropdown (Optional) */}
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-800" htmlFor="property_id">
                Property (Optional)
              </label>
              <select
                id="property_id"
                name="property_id"
                className="w-full rounded-md px-3 py-2 border bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                defaultValue=""
              >
                <option value="">-- General / Unassigned --</option>
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
            <label className="block text-sm font-medium mb-1 text-slate-800" htmlFor="description">
              Description <span className="text-red-500">*</span>
            </label>
            <input
              id="description"
              name="description"
              type="text"
              placeholder="e.g. Rent payment Unit 4B, Plumbing repair supplies, Municipal water bill"
              required
              className="w-full rounded-md px-3 py-2 border bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 px-6 rounded-md transition text-sm shadow-sm"
            >
              Record Transaction
            </button>
          </div>
        </form>
      </section>

      {/* BOTTOM: HISTORICAL TRANSACTIONS DATA TABLE */}
      <section className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-900">Historical Transactions</h2>
          <span className="text-xs text-gray-500">
            {transactionList.length} {transactionList.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        {transactionList.length === 0 ? (
          <div className="p-8 text-center text-gray-500 italic">
            No transactions recorded yet. Use the form above to add your first entry.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b text-gray-500 bg-white">
                  <th className="p-4 font-semibold">Date</th>
                  <th className="p-4 font-semibold">Description</th>
                  <th className="p-4 font-semibold">Property</th>
                  <th className="p-4 font-semibold">Type</th>
                  <th className="p-4 font-semibold text-right">Amount</th>
                  <th className="p-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactionList.map((t) => {
                  const isIncome = t.transaction_type === 'income'
                  const propertyName = t.property_id
                    ? propertyMap.get(t.property_id) || 'Assigned Property'
                    : 'General'

                  return (
                    <tr key={t.id} className="hover:bg-gray-50/75 transition">
                      <td className="p-4 text-gray-600 whitespace-nowrap">
                        {new Date(t.transaction_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="p-4 font-medium text-slate-900">{t.description}</td>
                      <td className="p-4 text-gray-600">
                        {t.property_id ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                            {propertyName}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">General</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isIncome
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isIncome ? 'Income' : 'Expense'}
                        </span>
                      </td>
                      <td
                        className={`p-4 text-right font-bold whitespace-nowrap ${
                          isIncome ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {isIncome ? '+' : '-'}KES{' '}
                        {Number(t.amount).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-4 text-right">
                        <form action={deleteTransaction} className="inline-block">
                          <input type="hidden" name="id" value={t.id} />
                          <button
                            type="submit"
                            className="text-xs text-red-600 hover:text-red-800 hover:underline transition p-1"
                            title="Delete transaction"
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

