'use client'

import { useState } from 'react'
import Link from 'next/link'
import CreateLeaseDrawer, { UnitOption, TenantOption } from '@/app/dashboard/components/CreateLeaseDrawer'

interface UnitRecord {
  id: string
  unit_number: string
  bedrooms?: number | null
  bathrooms?: number | null
  base_rent?: number | null
  is_occupied: boolean
  property_id?: string
}

interface LeaseRecord {
  id: string
  unit_id: string
  deposit_amount?: number | null
  start_date?: string | null
  is_active: boolean
  tenants?: {
    id: string
    first_name: string
    last_name: string
    email: string
  } | null
}

interface PropertyUnitsTableProps {
  units: UnitRecord[]
  activeLeases: LeaseRecord[]
  propertyName: string
  activeTenants: TenantOption[]
}

export default function PropertyUnitsTable({
  units,
  activeLeases,
  propertyName,
  activeTenants,
}: PropertyUnitsTableProps) {
  const [selectedUnitForLease, setSelectedUnitForLease] = useState<UnitOption | null>(null)

  // Map active leases by unit_id
  const leaseMap = new Map<string, LeaseRecord>()
  activeLeases.forEach((l) => {
    leaseMap.set(l.unit_id, l)
  })

  return (
    <>
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
                    <tr key={unit.id} className="hover:bg-slate-50/70 transition-all duration-150">
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
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedUnitForLease({
                                id: unit.id,
                                unit_number: unit.unit_number,
                                base_rent: Number(unit.base_rent || 0),
                                property_name: propertyName,
                                bedrooms: unit.bedrooms,
                                bathrooms: unit.bathrooms,
                              })
                            }
                            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all duration-200 ease-in-out inline-flex items-center gap-1"
                          >
                            + Create Lease
                          </button>
                        ) : (
                          <Link
                            href="/dashboard/deposits"
                            className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all duration-200 ease-in-out inline-flex items-center"
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

      {/* Slide-Over Drawer for In-Page Lease Creation */}
      <CreateLeaseDrawer
        isOpen={Boolean(selectedUnitForLease)}
        onClose={() => setSelectedUnitForLease(null)}
        selectedUnit={selectedUnitForLease}
        tenants={activeTenants}
      />
    </>
  )
}
