// app/dashboard/properties/page.tsx
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'
import { createProperty, updateProperty } from './actions'
import Link from 'next/link'

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; message?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const editId = resolvedSearchParams.edit
  const message = resolvedSearchParams.message

  const supabase = await createClient()
  const { agencyId, role } = await getUserAgencyContext()
  const isOwner = role === 'agency_owner'

  // 1. Fetch all property managers for this agency
  const { data: propertyManagers } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role')
    .eq('agency_id', agencyId)
    .eq('role', 'property_manager')
    .order('first_name', { ascending: true })

  // 2. Fetch all properties for this agency
  const { data: propertiesData } = await supabase
    .from('properties')
    .select('*')
    .eq('agency_id', agencyId)
    .order('name', { ascending: true })

  const properties = propertiesData || []
  const propertyIds = properties.map((p) => p.id)

  // 3. Fetch all units across these properties to compute occupancy visuals
  let units: any[] = []
  if (propertyIds.length > 0) {
    const { data: allUnits } = await supabase
      .from('units')
      .select('id, property_id, unit_number, base_rent, is_occupied')
      .in('property_id', propertyIds)
    units = allUnits || []
  }

  // Build lookup map for coordinators
  const managerMap = new Map<string, string>()
  propertyManagers?.forEach((pm) => {
    const fullName = `${pm.first_name || ''} ${pm.last_name || ''}`.trim()
    managerMap.set(pm.id, fullName || 'Unnamed Coordinator')
  })

  // Check if currently editing a property
  const propertyToEdit = editId
    ? properties.find((p) => p.id === editId) || null
    : null
  const isEditing = Boolean(propertyToEdit)

  // Aggregate macro metrics
  const totalUnits = units.length
  const totalOccupied = units.filter((u) => u.is_occupied).length
  const portfolioOccupancy = totalUnits > 0 ? Math.round((totalOccupied / totalUnits) * 100) : 0

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-900 text-white shadow-xs">
              Portfolio Assets
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {properties.length} Sites &bull; {totalUnits} Units &bull; {portfolioOccupancy}% Portfolio Occupancy
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 font-sans">
            Properties Directory
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Institutional overview of managed real estate assets, occupancy rates, and coordinator allocations.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isEditing && (
            <Link
              href="/dashboard/properties"
              className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-all duration-200 ease-in-out text-xs font-semibold shadow-xs"
            >
              Cancel Edit
            </Link>
          )}
          <Link
            href="/dashboard/properties#property-form"
            className="bg-slate-900 hover:bg-slate-800 hover:shadow-md text-white px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ease-in-out text-xs font-semibold shadow-xs flex items-center gap-1.5"
          >
            <span>+ Add Property</span>
          </Link>
        </div>
      </header>

      {/* Alert / Feedback message */}
      {message && (
        <div className="p-4 rounded-xl text-xs font-medium bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-between">
          <span>{message}</span>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Sleek CSS Grid of Property Bento Cards (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Managed Sites ({properties.length})
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Real-time occupancy tracking
            </span>
          </div>

          {properties.length === 0 ? (
            <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-12 text-center text-xs text-slate-500">
              No properties registered in this agency yet. Use the form on the right to add your first property site.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {properties.map((prop) => {
                const propUnits = units.filter((u) => u.property_id === prop.id)
                const propTotalUnits = propUnits.length
                const propOccupiedUnits = propUnits.filter((u) => u.is_occupied).length
                const occupancyRate =
                  propTotalUnits > 0 ? Math.round((propOccupiedUnits / propTotalUnits) * 100) : 0
                const isHighOccupancy = occupancyRate > 80

                const totalRentRoll = propUnits.reduce(
                  (sum, u) => sum + Number(u.base_rent || 0),
                  0
                )

                const managerName = prop.manager_id ? managerMap.get(prop.manager_id) : null
                const isCurrentEditing = prop.id === editId

                return (
                  <div
                    key={prop.id}
                    className={`bg-white shadow-sm border rounded-xl p-6 flex flex-col justify-between transition-all duration-150 ${
                      isCurrentEditing
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Top Section */}
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/dashboard/property/${prop.id}`}
                            className="text-slate-900 font-semibold text-base hover:text-emerald-600 transition-colors truncate block"
                          >
                            {prop.name}
                          </Link>
                          <p className="text-slate-500 text-xs mt-0.5 truncate">
                            {prop.location}
                          </p>
                        </div>

                        {/* Coordinator pill */}
                        {managerName ? (
                          <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-50 text-slate-700 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="truncate max-w-[100px]">{managerName}</span>
                          </span>
                        ) : (
                          <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                            ⚠️ Unassigned
                          </span>
                        )}
                      </div>

                      {/* Occupancy Visuals & Progress Bar */}
                      <div className="mt-5 pt-4 border-t border-slate-100">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-slate-500 font-medium">Occupancy</span>
                          <span className={`font-semibold tabular-nums ${isHighOccupancy ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {occupancyRate}% ({propOccupiedUnits}/{propTotalUnits} Units)
                          </span>
                        </div>

                        {/* Thin Progress Bar (Emerald if > 80%, Amber if below) */}
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isHighOccupancy ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(100, occupancyRate)}%` }}
                          />
                        </div>

                        {/* Rent Potential */}
                        <div className="mt-3 flex items-center justify-between text-xs">
                          <span className="text-slate-400">Monthly Gross Potential:</span>
                          <span className="font-bold text-slate-900 tabular-nums">
                            KES {totalRentRoll.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions Footer */}
                    <div className="pt-4 mt-5 border-t border-slate-100 flex items-center justify-between text-xs">
                      <Link
                        href={`/dashboard/properties?edit=${prop.id}#property-form`}
                        className="text-slate-500 hover:text-slate-900 font-medium transition"
                      >
                        Edit Property
                      </Link>
                      <Link
                        href={`/dashboard/property/${prop.id}`}
                        className="text-slate-900 hover:text-emerald-600 font-semibold transition flex items-center gap-1"
                      >
                        <span>View Units</span>
                        <span>&rarr;</span>
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Side: Add / Edit Property Form */}
        <div id="property-form">
          <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6 sticky top-20">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {isEditing ? 'Edit Property Site' : 'Register New Property'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isEditing ? 'Update site details and coordinator assignment.' : 'Add a property asset to your portfolio.'}
                </p>
              </div>
              {isEditing && (
                <Link
                  href="/dashboard/properties"
                  className="text-xs text-slate-500 hover:text-slate-900 font-medium underline"
                >
                  Clear
                </Link>
              )}
            </div>

            <form
              action={isEditing ? updateProperty : createProperty}
              className="flex flex-col gap-4"
            >
              {isEditing && (
                <input type="hidden" name="id" value={propertyToEdit?.id} />
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="name">
                  Property Site Name
                </label>
                <input
                  id="name"
                  name="name"
                  defaultValue={propertyToEdit?.name || ''}
                  placeholder="e.g. Sunrise Executive Apartments"
                  required
                  className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="location">
                  Physical Address / Location
                </label>
                <input
                  id="location"
                  name="location"
                  defaultValue={propertyToEdit?.location || ''}
                  placeholder="e.g. Westlands, Nairobi"
                  required
                  className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                />
              </div>

              {/* Property Manager Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="manager_id">
                  Assigned Coordinator (SLA Lead)
                </label>
                {isOwner ? (
                  <>
                    <select
                      id="manager_id"
                      name="manager_id"
                      defaultValue={propertyToEdit?.manager_id || ''}
                      className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
                    >
                      <option value="">-- Unassigned (Select Coordinator) --</option>
                      {propertyManagers && propertyManagers.length > 0 ? (
                        propertyManagers.map((manager) => {
                          const displayName =
                            `${manager.first_name || ''} ${manager.last_name || ''}`.trim() ||
                            `Coordinator (${manager.id.slice(0, 6)})`
                          return (
                            <option key={manager.id} value={manager.id}>
                              {displayName}
                            </option>
                          )
                        })
                      ) : (
                        <option value="" disabled>
                          No property managers registered
                        </option>
                      )}
                    </select>
                    {(!propertyManagers || propertyManagers.length === 0) && (
                      <p className="text-[11px] text-amber-600 mt-1">
                        No coordinators available.{' '}
                        <Link href="/dashboard/team" className="underline font-semibold">
                          Invite managers under Team
                        </Link>
                        .
                      </p>
                    )}
                  </>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700">
                    <p className="font-semibold">
                      {propertyToEdit?.manager_id
                        ? managerMap.get(propertyToEdit.manager_id) || 'Assigned'
                        : 'Unassigned'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Only the Agency Owner is authorized to delegate properties.
                    </p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="mt-2 bg-slate-900 hover:bg-slate-800 hover:shadow-md text-white font-semibold text-xs py-3 rounded-lg shadow-xs cursor-pointer transition-all duration-200 ease-in-out"
              >
                {isEditing ? 'Update Property Site' : 'Register Property'}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  )
}
