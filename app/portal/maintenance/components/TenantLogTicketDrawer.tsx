'use client'

import { useState } from 'react'
import SlideOverDrawer from '@/app/dashboard/components/SlideOverDrawer'

interface TenantLogTicketDrawerProps {
  isOpen: boolean
  onClose: () => void
  activeLease: any
  action: (formData: FormData) => Promise<void> | void
}

export default function TenantLogTicketDrawer({
  isOpen,
  onClose,
  activeLease,
  action,
}: TenantLogTicketDrawerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const propertyName = activeLease?.units?.properties?.name || 'Property'
  const unitNumber = activeLease?.units?.unit_number || 'Unit'

  const drawerFooter = (
    <div className="flex items-center justify-between w-full">
      <button
        type="button"
        onClick={onClose}
        disabled={isSubmitting}
        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl cursor-pointer transition-all duration-200 ease-in-out disabled:opacity-50"
      >
        Cancel
      </button>

      <button
        type="submit"
        form="tenant-ticket-form"
        disabled={isSubmitting}
        className="bg-slate-900 hover:bg-slate-800 hover:shadow-md text-white font-bold text-xs py-2.5 px-6 rounded-xl cursor-pointer transition-all duration-200 ease-in-out shadow-xs disabled:opacity-50 flex items-center gap-2"
      >
        {isSubmitting ? (
          <>
            <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Submitting Ticket...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Submit Maintenance Request</span>
          </>
        )}
      </button>
    </div>
  )

  return (
    <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Log Maintenance Request"
      subtitle={`${propertyName} • Unit #${unitNumber}`}
      footer={drawerFooter}
      maxWidth="max-w-lg"
    >
      <form
        id="tenant-ticket-form"
        action={action}
        onSubmit={() => setIsSubmitting(true)}
        className="space-y-4"
      >
        {/* Leased Unit Context Strip */}
        <div className="p-3.5 bg-slate-100/80 rounded-xl border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">
              Target Residence
            </span>
            <span className="font-semibold text-slate-900">
              {propertyName}, Unit #{unitNumber}
            </span>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            Active Tenancy
          </span>
        </div>

        {/* Issue Title */}
        <div>
          <label htmlFor="ticket_title" className="block text-xs font-semibold text-slate-900 mb-1">
            Issue Title <span className="text-rose-500">*</span>
          </label>
          <input
            id="ticket_title"
            type="text"
            name="title"
            required
            placeholder="e.g. Master bathroom pipe leaking underneath sink"
            className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-slate-900 focus:outline-none focus:border-slate-900 transition"
          />
        </div>

        {/* Category & Urgency in 2-col Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="ticket_category" className="block text-xs font-semibold text-slate-900 mb-1">
              Category <span className="text-rose-500">*</span>
            </label>
            <select
              id="ticket_category"
              name="category"
              required
              defaultValue="Plumbing"
              className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-none focus:border-slate-900 transition cursor-pointer"
            >
              <option value="Plumbing">Plumbing & Water</option>
              <option value="Electrical">Electrical & Lighting</option>
              <option value="HVAC">HVAC & Ventilation</option>
              <option value="Carpentry">Carpentry, Locks & Doors</option>
              <option value="Appliance">Appliances & Fixtures</option>
              <option value="Structural">Structural & Masonry</option>
              <option value="General">Other / General</option>
            </select>
          </div>

          <div>
            <label htmlFor="ticket_urgency" className="block text-xs font-semibold text-slate-900 mb-1">
              Urgency <span className="text-rose-500">*</span>
            </label>
            <select
              id="ticket_urgency"
              name="urgency"
              required
              defaultValue="Standard"
              className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-none focus:border-slate-900 transition cursor-pointer"
            >
              <option value="Standard">Standard (Routine repair)</option>
              <option value="High">High (Significant disruption)</option>
              <option value="Urgent">Urgent (Emergency / flooding)</option>
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="ticket_description" className="block text-xs font-semibold text-slate-900 mb-1">
            Description & Details <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="ticket_description"
            name="description"
            rows={4}
            required
            placeholder="Describe the issue in detail (e.g. When it started, severity of leak, exact location inside the apartment)..."
            className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-slate-900 focus:outline-none focus:border-slate-900 transition leading-relaxed"
          />
        </div>

        {/* Photo Upload */}
        <div>
          <label htmlFor="ticket_image" className="block text-xs font-semibold text-slate-900 mb-1">
            Attach Photo Evidence <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            id="ticket_image"
            type="file"
            name="image"
            accept="image/*"
            className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-600 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200 cursor-pointer"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Photos help maintenance coordinators dispatch the appropriate tradesperson and parts.
          </p>
        </div>

        {/* SLA Notice */}
        <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-[11px] text-blue-900 flex items-start gap-2">
          <svg className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Standard requests are dispatched within 24 hours. Emergencies receive immediate priority dispatch from property coordinators.
          </span>
        </div>
      </form>
    </SlideOverDrawer>
  )
}
