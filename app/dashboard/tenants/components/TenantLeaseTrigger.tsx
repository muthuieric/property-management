'use client'

import { useState } from 'react'
import CreateLeaseDrawer, { TenantOption, UnitOption } from '@/app/dashboard/components/CreateLeaseDrawer'

interface TenantLeaseTriggerProps {
  tenant: TenantOption
  vacantUnits: UnitOption[]
}

export default function TenantLeaseTrigger({ tenant, vacantUnits }: TenantLeaseTriggerProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 cursor-pointer transition-all duration-200 ease-in-out inline-flex items-center"
        title={`Allocate unit to ${tenant.first_name} ${tenant.last_name}`}
      >
        + Lease
      </button>

      <CreateLeaseDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        selectedTenant={tenant}
        vacantUnits={vacantUnits}
      />
    </>
  )
}
