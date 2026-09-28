import { getUserAgencyContext } from '@/utils/supabase/get-context'
import { getMonthlyInvoices, getBillingProperties } from './actions'
import BillingCommandCenter from './components/BillingCommandCenter'

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; property_id?: string; message?: string }>
}) {
  const resolvedParams = await searchParams
  const selectedMonth = resolvedParams.month || ''
  const selectedPropertyId = resolvedParams.property_id || ''
  const message = resolvedParams.message

  await getUserAgencyContext()

  const properties = await getBillingProperties()
  const invoices = await getMonthlyInvoices(
    selectedPropertyId || undefined,
    selectedMonth || undefined
  )

  // Compute KPI metrics
  const totalBilled = invoices.reduce((sum, inv) => sum + inv.total_amount, 0)
  const rentBilled = invoices.reduce((sum, inv) => sum + inv.base_rent_amount, 0)
  const utilitiesBilled = invoices.reduce((sum, inv) => sum + inv.utilities_amount, 0)
  const unpaidCount = invoices.filter((inv) => inv.status === 'unpaid').length
  const paidCount = invoices.filter((inv) => inv.status === 'paid').length

  const formattedMonth = selectedMonth
    ? new Date(`${selectedMonth}-01`).toLocaleString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : 'All Periods'

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-900 text-white shadow-xs">
              Billing Run Engine
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {invoices.length} Total Invoices &bull; {unpaidCount} Awaiting Payment
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 font-sans">
            Global Monthly Invoicing ('Bill All')
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Automated tenancy billing engine aggregating contractual base rent and bundled water utility meters.
          </p>
        </div>
      </header>

      {/* Message Feedback Banner */}
      {message && (
        <div className="p-4 rounded-xl text-xs border bg-slate-50 text-slate-800 border-slate-200">
          <span>{message}</span>
        </div>
      )}

      {/* Bento KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Portfolio Billed */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Invoiced
              </span>
              <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                Gross Billed
              </span>
            </div>
            <p className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
              KES {totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="pt-2 mt-2 border-t border-slate-100 text-[11px] text-slate-400">
            {formattedMonth} gross billing
          </div>
        </div>

        {/* Card 2: Contracted Base Rent */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Base Rent Roll
              </span>
              <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                Contractual
              </span>
            </div>
            <p className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
              KES {rentBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="pt-2 mt-2 border-t border-slate-100 text-[11px] text-slate-400">
            Fixed monthly tenancy lease rates
          </div>
        </div>

        {/* Card 3: Bundled Utilities */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Bundled Utilities
              </span>
              <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                Meters
              </span>
            </div>
            <p className="text-2xl font-bold tracking-tight text-blue-700 tabular-nums">
              KES {utilitiesBilled.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="pt-2 mt-2 border-t border-slate-100 text-[11px] text-slate-400">
            Consolidated water meter consumption
          </div>
        </div>

        {/* Card 4: Unpaid vs Paid Count */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Settlement Status
              </span>
              <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                {unpaidCount} Due
              </span>
            </div>
            <p className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
              <span className="text-amber-600">{unpaidCount}</span>
              <span className="text-sm font-normal text-slate-400 mx-1.5">/</span>
              <span className="text-emerald-600">{paidCount}</span>
            </p>
          </div>
          <div className="pt-2 mt-2 border-t border-slate-100 text-[11px] text-slate-400">
            Unpaid vs settled invoices
          </div>
        </div>
      </div>

      {/* Main Command Center Component */}
      <BillingCommandCenter
        invoices={invoices}
        properties={properties}
        currentPropertyId={selectedPropertyId}
        currentMonth={selectedMonth}
      />
    </div>
  )
}

