'use client'

import { useState } from 'react'
import TenantInviteModal from './TenantInviteModal'
import { VacantUnitItem } from '../actions'

interface TenantInviteTriggerProps {
  buttonText?: string
  className?: string
  vacantUnits?: VacantUnitItem[]
}

export default function TenantInviteTrigger({
  buttonText = 'Invite Link',
  className = 'bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ease-in-out text-xs font-semibold shadow-xs flex items-center gap-1.5',
  vacantUnits = [],
}: TenantInviteTriggerProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={className}
        title="Send a self-serve 7-day onboarding link to prospective tenant"
      >
        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <span>{buttonText}</span>
      </button>

      <TenantInviteModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        initialVacantUnits={vacantUnits}
      />
    </>
  )
}

