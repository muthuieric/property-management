'use client'

import { useState } from 'react'
import SiteVisitReportDrawer from './SiteVisitReportDrawer'

interface PropertyOption {
  id: string
  name: string
  location?: string
}

interface SiteVisitTriggerButtonProps {
  properties: PropertyOption[]
  className?: string
  label?: string
}

export default function SiteVisitTriggerButton({
  properties,
  className = '',
  label = '+ Log Site Visit',
}: SiteVisitTriggerButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          className ||
          'inline-flex items-center gap-1.5 bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition-all duration-150'
        }
      >
        <svg className="w-4 h-4 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <span>{label}</span>
      </button>

      {isOpen && (
        <SiteVisitReportDrawer
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          properties={properties}
        />
      )}
    </>
  )
}

