'use client'

import { useState } from 'react'
import BulkTenantUploader from './BulkTenantUploader'

interface BulkTenantImportTriggerProps {
  buttonText?: string
  className?: string
  properties: Array<{ id: string; name: string }>
}

export default function BulkTenantImportTrigger({
  buttonText = 'Bulk Import CSV',
  className = 'bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ease-in-out text-xs font-semibold shadow-xs flex items-center gap-1.5',
  properties = [],
}: BulkTenantImportTriggerProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={className}
        title="Upload tenants in bulk via CSV"
      >
        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <span>{buttonText}</span>
      </button>

      <BulkTenantUploader
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        properties={properties}
      />
    </>
  )
}

