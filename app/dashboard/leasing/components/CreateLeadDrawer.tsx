'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SlideOverDrawer from '@/app/dashboard/components/SlideOverDrawer'
import { createLead } from '../actions'

interface PropertyOption {
  id: string
  name: string
}

interface CoordinatorOption {
  id: string
  first_name: string
  last_name: string
}

interface CreateLeadDrawerProps {
  isOpen: boolean
  onClose: () => void
  properties: PropertyOption[]
  coordinators: CoordinatorOption[]
  defaultPropertyId?: string
}

export default function CreateLeadDrawer({
  isOpen,
  onClose,
  properties,
  coordinators,
  defaultPropertyId,
}: CreateLeadDrawerProps) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null)
    }
  }, [isOpen])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)

    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      try {
        const result = await createLead(formData)
        if (result && result.success) {
          formRef.current?.reset()
          setErrorMessage(null)
          onClose()
          router.refresh()
        } else {
          setErrorMessage(result?.error || 'Failed to save lead record. Please check your inputs.')
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'An unexpected error occurred while communicating with the server.')
      }
    })
  }

  return (
    <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Intake New Prospect Lead"
      subtitle="Register a prospective tenant into the Pre-Leasing CRM pipeline to track negotiations, site visits, and automated lease conversion."
      maxWidth="max-w-lg"
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
            form="create-lead-form"
            disabled={isPending}
            className="bg-slate-900 hover:bg-slate-800 hover:shadow-md text-white font-semibold text-xs py-2.5 px-6 rounded-lg cursor-pointer transition-all duration-200 ease-in-out shadow-xs disabled:opacity-50 flex items-center gap-2"
          >
            {isPending ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Saving Lead...</span>
              </>
            ) : (
              <span>Add to Pipeline</span>
            )}
          </button>
        </>
      }
    >
      <form id="create-lead-form" ref={formRef} onSubmit={handleSubmit} className="space-y-5">
        {errorMessage && (
          <div className="bg-rose-100 text-rose-700 p-3 rounded-md mb-4 text-xs font-semibold flex items-start gap-2.5 border border-rose-200">
            <svg className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <span className="font-bold block mb-0.5">Intake Submission Failed</span>
              <p className="font-medium text-rose-800 leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Section 1: Prospect Contact Details */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3 flex items-center gap-2">
            <span>Prospect Identity & Contact</span>
          </h3>
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="lead_full_name">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="lead_full_name"
                name="full_name"
                placeholder="e.g. Samuel Karanja"
                required
                className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="lead_phone">
                  Phone Number <span className="text-rose-500">*</span>
                </label>
                <input
                  id="lead_phone"
                  type="tel"
                  name="phone_number"
                  placeholder="+254 7..."
                  required
                  className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="lead_email">
                  Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  id="lead_email"
                  type="email"
                  name="email"
                  placeholder="prospect@domain.com"
                  className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200/80" />

        {/* Section 2: Property & Preferences */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3 flex items-center gap-2">
            <span>Property & Budget Preferences</span>
          </h3>
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="lead_property">
                Target Property Site
              </label>
              <select
                id="lead_property"
                name="property_id"
                defaultValue={defaultPropertyId || ''}
                className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition"
              >
                <option value="">-- General / Flexible Across Portfolio --</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="lead_budget">
                  Maximum Budget (KES / mo)
                </label>
                <input
                  id="lead_budget"
                  type="number"
                  step="500"
                  name="budget_max"
                  placeholder="e.g. 45000"
                  className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="lead_bedrooms">
                  Preferred Bedrooms
                </label>
                <select
                  id="lead_bedrooms"
                  name="preferred_bedrooms"
                  defaultValue=""
                  className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition"
                >
                  <option value="">Any Layout</option>
                  <option value="0">Studio</option>
                  <option value="1">1 Bedroom</option>
                  <option value="2">2 Bedrooms</option>
                  <option value="3">3 Bedrooms</option>
                  <option value="4">4+ Bedrooms</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200/80" />

        {/* Section 3: CRM Assignment & Source */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3 flex items-center gap-2">
            <span>Source & Pipeline Assignment</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="lead_source">
                Lead Source
              </label>
              <select
                id="lead_source"
                name="lead_source"
                defaultValue="Walk-in"
                className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition"
              >
                <option value="Walk-in">Walk-in Gate / Site Visit</option>
                <option value="Website">Website / Online Portal</option>
                <option value="Referral">Tenant / Broker Referral</option>
                <option value="Social Media">Social Media (Instagram, Facebook)</option>
                <option value="Direct Call">Direct Phone Call</option>
                <option value="Billboard">Signage / Billboard</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="lead_coordinator">
                Assigned Coordinator
              </label>
              <select
                id="lead_coordinator"
                name="assigned_coordinator_id"
                defaultValue=""
                className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition"
              >
                <option value="">Unassigned (Open Pool)</option>
                {coordinators.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3.5">
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="lead_stage">
              Initial Pipeline Stage
            </label>
            <select
              id="lead_stage"
              name="stage"
              defaultValue="lead_entry"
              className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition"
            >
              <option value="lead_entry">Stage 1: Lead Entry (Baseline intake)</option>
              <option value="negotiating">Stage 2: Negotiating (Follow-up & Visits)</option>
              <option value="pre_qualification">Stage 3: Pre-Qualification (Ready to lease)</option>
            </select>
          </div>

          <div className="mt-3.5">
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="lead_notes">
              Follow-Up Notes & Specifics
            </label>
            <textarea
              id="lead_notes"
              name="notes"
              rows={3}
              placeholder="e.g. Inquired about 2nd floor, moving next month, requested parking space details..."
              className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition resize-none"
            />
          </div>
        </div>
      </form>
    </SlideOverDrawer>
  )
}

