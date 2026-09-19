'use client'

import { useState } from 'react'
import CreateLeaseDrawer, { TenantOption, UnitOption } from '@/app/dashboard/components/CreateLeaseDrawer'

interface TenantCreateLeaseHeaderTriggerProps {
  activeTenants: TenantOption[]
  vacantUnits: UnitOption[]
}

export default function TenantCreateLeaseHeaderTrigger({
  activeTenants,
  vacantUnits,
}: TenantCreateLeaseHeaderTriggerProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ease-in-out text-xs font-semibold shadow-xs flex items-center gap-1.5"
      >
        <span>+ Create Lease</span>
      </button>

      <CreateLeaseDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        tenants={activeTenants}
        vacantUnits={vacantUnits}
      />
    </>
  )
}
