'use client'

import React, { useState } from 'react'
import RecordPaymentDrawer from './RecordPaymentDrawer'

interface RecordPaymentTriggerProps {
  tenantId: string
  tenantName: string
  unitNumber?: string
  propertyName?: string
}

export default function RecordPaymentTrigger({
  tenantId,
  tenantName,
  unitNumber,
  propertyName,
}: RecordPaymentTriggerProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 shadow-xs cursor-pointer"
      >
        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        <span>Record Manual Payment</span>
      </button>

      {isOpen && (
        <RecordPaymentDrawer
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          tenantId={tenantId}
          tenantName={tenantName}
          unitNumber={unitNumber}
          propertyName={propertyName}
        />
      )}
    </>
  )
}

