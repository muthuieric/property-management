'use client'

import { useState } from 'react'
import BulkUtilityUploader, { PropertyOption } from './BulkUtilityUploader'

interface BulkUtilityUploadTriggerProps {
  properties: PropertyOption[]
  selectedPropertyId?: string
  buttonText?: string
  className?: string
}

export default function BulkUtilityUploadTrigger({
  properties,
  selectedPropertyId,
  buttonText = 'Bulk Upload Readings',
  className = 'bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ease-in-out text-xs font-semibold shadow-xs flex items-center gap-1.5',
}: BulkUtilityUploadTriggerProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={className}
      >
        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <span>{buttonText}</span>
      </button>

      <BulkUtilityUploader
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        properties={properties}
        selectedPropertyId={selectedPropertyId}
      />
    </>
  )
}

