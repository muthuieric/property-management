'use client'

import { useState } from 'react'
import AddTenantDrawer from './AddTenantDrawer'

interface TenantAddTriggerProps {
  buttonText?: string
  className?: string
  properties?: Array<{ id: string; name: string }>
}

export default function TenantAddTrigger({
  buttonText = '+ Register Tenant',
  className = 'bg-slate-900 hover:bg-slate-800 hover:shadow-md text-white px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ease-in-out text-xs font-semibold shadow-xs flex items-center gap-1.5',
  properties = [],
}: TenantAddTriggerProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={className}
      >
        <span>{buttonText}</span>
      </button>

      <AddTenantDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} properties={properties} />
    </>
  )
}
