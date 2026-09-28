'use client'

import { useState } from 'react'
import UnitWizard from './UnitWizard'

export default function UnitWizardTrigger({
  propertyId,
  propertyName,
}: {
  propertyId: string
  propertyName: string
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ease-in-out text-xs font-semibold shadow-xs flex items-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        <span>Onboard Unit (Wizard)</span>
      </button>

      <UnitWizard
        propertyId={propertyId}
        propertyName={propertyName}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  )
}

