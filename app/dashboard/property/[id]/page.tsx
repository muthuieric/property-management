// app/dashboard/property/[id]/page.tsx
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function PropertyPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const supabase = await createClient()
  
  // Next.js 15+ requires awaiting params
  const resolvedParams = await params
  const propertyId = resolvedParams.id

  // 1. Fetch the specific property
  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .single()

  if (!property) notFound()

  // 2. Fetch assigned property manager details if manager_id exists
  let managerName: string | null = null
  if (property.manager_id) {
    const { data: managerProfile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', property.manager_id)
      .single()
    if (managerProfile) {
      managerName = `${managerProfile.first_name || ''} ${managerProfile.last_name || ''}`.trim()
    }
  }

  // 3. Fetch all units linked to this property
  const { data: unitsData } = await supabase
    .from('units')
    .select('*')
    .eq('property_id', propertyId)
    .order('unit_number', { ascending: true })

  const units = unitsData || []
  const unitIds = units.map((u) => u.id)

  // 4. Fetch active leases for these units to map tenants
  const leaseMap = new Map<string, any>()
  if (unitIds.length > 0) {
    const { data: activeLeases } = await supabase
      .from('leases')
      .select(`
        id,
        unit_id,
        deposit_amount,
        start_date,
        is_active,
        tenants ( id, first_name, last_name, email )
      `)
      .in('unit_id', unitIds)
      .eq('is_active', true)

    activeLeases?.forEach((l) => {
      leaseMap.set(l.unit_id, l)
    })
  }

  // Compute metrics
  const totalUnits = units.length
  const occupiedUnits = units.filter((u) => u.is_occupied).length
  const vacantUnits = totalUnits - occupiedUnits
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0
  const isHighOccupancy = occupancyRate > 80

  const totalRentRoll = units.reduce((sum, u) => sum + Number(u.base_rent || 0), 0)
  const totalEscrowInSite = Array.from(leaseMap.values()).reduce(
    (sum, l) => sum + Number(l.deposit_amount || 0),
    0
  )

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-2 text-xs">
            <Link href="/dashboard" className="text-slate-500 hover:text-slate-900 transition">
              Dashboard
            </Link>
            <span className="text-slate-300">/</span>
            <Link href="/dashboard/properties" className="text-slate-500 hover:text-slate-900 transition">
              Properties
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-semibold">{property.name}</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 font-sans">
            {property.name}
          </h1>

          <div className="flex flex-wrap items-center gap-3 mt-1.5">
            <p className="text-xs text-slate-500">{property.location}</p>
            <span className="text-slate-300">&bull;</span>
            <div>
              {managerName ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-50 text-slate-700 border border-slate-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Assigned Coordinator: {managerName}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                  ⚠️ No Coordinator Assigned
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href={`/dashboard/properties?edit=${propertyId}`}
            className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-all duration-200 ease-in-out text-xs font-semibold shadow-xs"
          >
            Edit Property
          </Link>
          <Link
            href={`/dashboard/property/${propertyId}/add-unit`}
            className="bg-slate-900 hover:bg-slate-800 hover:shadow-md text-white px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ease-in-out text-xs font-semibold shadow-xs flex items-center gap-1.5"
          >
            <span>+ Add Unit</span>
          </Link>
        </div>
      </header>

      {/* KPI Cards Bento Row for this Site */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Occupancy Card */}
        <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Site Occupancy
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                  isHighOccupancy
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                    : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                }`}
              >
                {occupancyRate}% Occupied
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                {occupiedUnits}
              </p>
              <span className="text-xs text-slate-500">of {totalUnits} units</span>
            </div>

            {/* Thin Progress Bar */}
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-3">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isHighOccupancy ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, occupancyRate)}%` }}
              />
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 text-xs text-slate-500">
            {vacantUnits} vacant {vacantUnits === 1 ? 'unit' : 'units'} available
          </div>
        </div>

        {/* Monthly Gross Potential */}
        <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Monthly Rent Roll
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                Gross Potential
              </span>
            </div>
            <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums mt-1">
              KES {totalRentRoll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 text-xs text-slate-500">
            Across {totalUnits} unit inventories
          </div>
        </div>

        {/* Active Deposits Held */}
        <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Site Escrow Deposits
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                In Trust
              </span>
            </div>
            <p className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums mt-1">
              KES {totalEscrowInSite.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="pt-3 mt-3 border-t border-slate-100 text-xs text-slate-500">
            {leaseMap.size} active tenant security deposits
          </div>
        </div>
      </div>

      {/* Unit Inventory Modern Table */}
      <section className="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Unit Inventory & Tenancy Allocation</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Individual units, configuration specs, active tenant occupants, and leasing status.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 tabular-nums">
            {units.length} Total Units
          </span>
        </div>

        {units.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No units added to this property yet. Click &quot;+ Add Unit&quot; above to register the first unit.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 uppercase text-[10px] font-semibold text-slate-500 tracking-wider">
                  <th className="p-4 pl-6">Unit Identifier</th>
                  <th className="p-4">Specifications</th>
                  <th className="p-4">Current Tenant Occupant</th>
                  <th className="p-4 text-right">Base Rent (Monthly)</th>
                  <th className="p-4 text-center">Occupancy Status</th>
                  <th className="p-4 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {units.map((unit) => {
                  const lease = leaseMap.get(unit.id)
                  const tenant = lease?.tenants

                  return (
                    <tr key={unit.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-4 pl-6 whitespace-nowrap">
                        <span className="font-bold text-slate-900 text-sm">
                          Unit {unit.unit_number}
                        </span>
                      </td>

                      <td className="p-4 whitespace-nowrap text-slate-600">
                        {unit.bedrooms != null && unit.bathrooms != null ? (
                          <span>{unit.bedrooms} Bed &bull; {unit.bathrooms} Bath</span>
                        ) : (
                          <span className="text-slate-400">Standard Unit</span>
                        )}
                      </td>

                      <td className="p-4 whitespace-nowrap">
                        {tenant ? (
                          <div>
                            <p className="font-semibold text-slate-900">
                              {tenant.first_name} {tenant.last_name}
                            </p>
                            <span className="text-[11px] text-slate-400 block font-mono">
                              {tenant.email}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No tenant assigned</span>
                        )}
                      </td>

                      <td className="p-4 whitespace-nowrap text-right font-bold text-slate-900 tabular-nums">
                        KES {Number(unit.base_rent || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td className="p-4 whitespace-nowrap text-center">
                        {unit.is_occupied ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Occupied
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white text-slate-600 border border-slate-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            Vacant
                          </span>
                        )}
                      </td>

                      <td className="p-4 pr-6 whitespace-nowrap text-right">
                        {!unit.is_occupied ? (
                          <Link
                            href={`/dashboard/leases/new?unit_id=${unit.id}`}
                            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition hover:underline"
                          >
                            + Create Lease
                          </Link>
                        ) : (
                          <Link
                            href="/dashboard/deposits"
                            className="text-xs font-medium text-slate-600 hover:text-slate-900 transition hover:underline"
                          >
                            View Escrow
                          </Link>
                        )}
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
