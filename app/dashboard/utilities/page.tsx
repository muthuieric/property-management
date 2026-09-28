import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'
import Link from 'next/link'
import { getUtilityReadings, getPropertiesForUtilities } from './actions'
import BulkUtilityUploadTrigger from './components/BulkUtilityUploadTrigger'
import PreBillVerificationTable from './components/PreBillVerificationTable'

export default async function UtilitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ property_id?: string; message?: string }>
}) {
  const resolvedParams = await searchParams
  const selectedPropertyId = resolvedParams.property_id || ''
  const message = resolvedParams.message

  const { role } = await getUserAgencyContext()
  const isOwner = role === 'agency_owner' || role === 'super_admin'

  const properties = await getPropertiesForUtilities()
  const readings = await getUtilityReadings(selectedPropertyId || undefined)

  // Compute metrics
  const draftReadings = readings.filter((r) => r.status === 'draft')
  const invoicedReadings = readings.filter((r) => r.status === 'invoiced' || r.status === 'bundled')
  const totalConsumption = readings.reduce((sum, r) => sum + r.consumption, 0)
  const totalBillable = readings.reduce((sum, r) => sum + r.total_charge, 0)

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId)

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-900 text-white shadow-xs">
              Utility Metering
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {readings.length} Recorded Readings &bull; {draftReadings.length} In Staging Draft
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 font-sans">
            Water Meter Readings &amp; Consumption
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Building-wide utility tracking, consumption analytics, and bulk CSV meter synchronization.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <BulkUtilityUploadTrigger
            properties={properties}
            selectedPropertyId={selectedPropertyId}
          />
        </div>
      </header>

      {/* Message Feedback Banner */}
      {message && (
        <div className="p-4 rounded-xl text-xs border bg-slate-50 text-slate-800 border-slate-200">
          <span>{message}</span>
        </div>
      )}

      {/* KPI Bento Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Staged Drafts
              </span>
              <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                Pending Invoicing
              </span>
            </div>
            <p className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
              {draftReadings.length}
            </p>
          </div>
          <div className="pt-2 mt-2 border-t border-slate-100 text-[11px] text-slate-400">
            Awaiting billing consolidation
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Invoiced Readings
              </span>
              <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                Billed
              </span>
            </div>
            <p className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
              {invoicedReadings.length}
            </p>
          </div>
          <div className="pt-2 mt-2 border-t border-slate-100 text-[11px] text-slate-400">
            Billed or bundled into rent invoices
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Water Billed
              </span>
              <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                Volume
              </span>
            </div>
            <p className="text-2xl font-bold tracking-tight text-blue-700 tabular-nums">
              {totalConsumption.toFixed(1)} <span className="text-sm font-medium">m³</span>
            </p>
          </div>
          <div className="pt-2 mt-2 border-t border-slate-100 text-[11px] text-slate-400">
            Combined net tenant consumption
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Utility Revenue
              </span>
              <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                KES
              </span>
            </div>
            <p className="text-2xl font-bold tracking-tight text-emerald-800 tabular-nums">
              KES {totalBillable.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="pt-2 mt-2 border-t border-slate-100 text-[11px] text-slate-400">
            Standard rate charges calculated
          </div>
        </div>
      </div>

      {/* Pre-Bill Verification Section */}
      <section className="bg-white shadow-xs border border-slate-200 rounded-xl p-5 sm:p-6">
        <PreBillVerificationTable draftReadings={draftReadings} />
      </section>

      {/* Main Ledger Section */}
      <section className="bg-white shadow-xs border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Meter Reading Audit Ledger</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Historical ledger of water meter entries, unit consumption rates, and charges.
            </p>
          </div>

          {/* Property Filter Tabs / Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">Filter Site:</span>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <Link
                href="/dashboard/utilities"
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  !selectedPropertyId
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Sites
              </Link>
              {properties.map((p) => (
                <Link
                  key={p.id}
                  href={`/dashboard/utilities?property_id=${p.id}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    selectedPropertyId === p.id
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {p.name}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {readings.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <svg
              className="w-12 h-12 text-slate-300 mx-auto mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
              />
            </svg>
            <p className="font-semibold text-slate-800 text-sm">No Meter Readings Found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {selectedPropertyId
                ? `No meter readings have been uploaded yet for ${selectedProperty?.name || 'this property'}.`
                : 'Click "Bulk Upload Readings" above to import meter logs for an entire building.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 uppercase text-[10px] font-semibold text-slate-500 tracking-wider">
                  <th className="p-4 pl-6">Unit</th>
                  <th className="p-4">Property Site</th>
                  <th className="p-4">Reading Date</th>
                  <th className="p-4 text-right">Previous Reading</th>
                  <th className="p-4 text-right">Current Reading</th>
                  <th className="p-4 text-right">Consumption</th>
                  <th className="p-4 text-right">Rate</th>
                  <th className="p-4 text-right">Total Charge</th>
                  <th className="p-4 pr-6 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {readings.map((reading) => (
                  <tr key={reading.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-4 pl-6 font-bold text-slate-900">{reading.unit_number}</td>
                    <td className="p-4 text-slate-600 font-medium">{reading.property_name}</td>
                    <td className="p-4 text-slate-500 font-mono text-[11px]">
                      {reading.reading_date}
                    </td>
                    <td className="p-4 text-right font-mono text-slate-500 tabular-nums">
                      {reading.previous_reading.toFixed(2)}
                    </td>
                    <td className="p-4 text-right font-mono font-semibold text-slate-800 tabular-nums">
                      {reading.current_reading.toFixed(2)}
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-blue-700 tabular-nums">
                      {reading.consumption.toFixed(2)} m³
                    </td>
                    <td className="p-4 text-right font-mono text-slate-500 tabular-nums">
                      {reading.rate_per_unit.toFixed(2)}
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                      KES {reading.total_charge.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="p-4 pr-6 text-center">
                      {reading.status === 'draft' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Draft Staging
                        </span>
                      )}
                      {reading.status === 'invoiced' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Invoiced
                        </span>
                      )}
                      {reading.status === 'bundled' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          Bundled Rent
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

