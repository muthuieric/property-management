'use client'

import { useState } from 'react'
import TenantWizard from './TenantWizard'
import { VacantUnitItem } from '../actions'

interface TenantWizardTriggerProps {
  buttonText?: string
  className?: string
  vacantUnits?: VacantUnitItem[]
}

export default function TenantWizardTrigger({
  buttonText = '+ Onboard Tenant',
  className = 'bg-slate-900 hover:bg-slate-800 hover:shadow-md text-white px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ease-in-out text-xs font-semibold shadow-xs flex items-center gap-1.5',
  vacantUnits = [],
}: TenantWizardTriggerProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={className}
      >
        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
        </svg>
        <span>{buttonText}</span>
      </button>

      <TenantWizard
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        initialVacantUnits={vacantUnits}
      />
    </>
  )
}

