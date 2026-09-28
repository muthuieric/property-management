'use client'

import React, { useState } from 'react'
import BulkPaymentUploader, { PropertyOption } from './BulkPaymentUploader'

interface BulkPaymentUploaderTriggerProps {
  properties: PropertyOption[]
  defaultPropertyId?: string
}

export default function BulkPaymentUploaderTrigger({
  properties = [],
  defaultPropertyId,
}: BulkPaymentUploaderTriggerProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-all inline-flex items-center gap-1.5 cursor-pointer"
      >
        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        <span>Import CSV Payments</span>
      </button>

      {isOpen && (
        <BulkPaymentUploader
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          properties={properties}
          defaultPropertyId={defaultPropertyId}
        />
      )}
    </>
  )
}

