'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import SlideOverDrawer from '@/app/dashboard/components/SlideOverDrawer'
import { createTicket } from '../actions'

export interface ActiveLeaseOption {
  unit_id: string
  tenant_id: string
  label: string
}

export interface ContractorOption {
  id: string
  name: string
  specialty: string
}

interface LogTicketDrawerProps {
  isOpen: boolean
  onClose: () => void
  activeLeases: ActiveLeaseOption[]
  contractors: ContractorOption[]
}

export default function LogTicketDrawer({
  isOpen,
  onClose,
  activeLeases,
  contractors,
}: LogTicketDrawerProps) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)

    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await createTicket(formData)
      if (result.success) {
        formRef.current?.reset()
        onClose()
        router.refresh()
      } else {
        setErrorMessage(result.error || 'Failed to create ticket.')
      }
    })
  }

  return (
    <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Log Maintenance Work Order"
      subtitle="Record a tenant reported fault, upload photo evidence, and dispatch trades."
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer transition-all duration-200 ease-in-out"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="log-ticket-form"
            disabled={isPending}
            className="bg-slate-900 hover:bg-slate-800 hover:shadow-md text-white font-semibold text-xs py-2.5 px-6 rounded-lg cursor-pointer transition-all duration-200 ease-in-out shadow-xs disabled:opacity-50 flex items-center gap-2"
          >
            {isPending ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Submitting...</span>
              </>
            ) : (
              <span>Dispatch Work Order</span>
            )}
          </button>
        </>
      }
    >
      <form id="log-ticket-form" ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3.5 rounded-lg text-xs font-medium bg-rose-50 border border-rose-200 text-rose-700">
            {errorMessage}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="location_data">
            Reporting Unit & Tenant <span className="text-rose-500">*</span>
          </label>
          <select
            id="location_data"
            name="location_data"
            required
            className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition"
          >
            <option value="">-- Select Reporting Unit & Tenant --</option>
            {activeLeases.map((lease) => (
              <option key={`${lease.unit_id}-${lease.tenant_id}`} value={`${lease.unit_id}|${lease.tenant_id}`}>
                {lease.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="issue_description">
            Issue Description <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="issue_description"
            name="issue_description"
            placeholder="Describe the maintenance failure in detail (e.g., Master bathroom pipe burst under sink)..."
            required
            rows={4}
            className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition leading-relaxed"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="contractor_id">
            Assign Trade Contractor (Optional)
          </label>
          <select
            id="contractor_id"
            name="contractor_id"
            className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition"
          >
            <option value="">-- Unassigned (Dispatch later) --</option>
            {contractors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.specialty})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="ticket_image">
            Attach Photographic Evidence (Optional)
          </label>
          <input
            id="ticket_image"
            type="file"
            name="image"
            accept="image/*"
            className="w-full rounded-lg px-3 py-2 text-xs bg-white border border-slate-200 text-slate-600 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200 cursor-pointer"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            PNG, JPG up to 10MB stored in encrypted custodial R2 buckets.
          </p>
        </div>
      </form>
    </SlideOverDrawer>
  )
}
