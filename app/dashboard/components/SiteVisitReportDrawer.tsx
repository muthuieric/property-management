'use client'

import { useState, useTransition } from 'react'
import SlideOverDrawer from './SlideOverDrawer'
import { submitSiteVisitReport } from '../properties/actions'

interface PropertyOption {
  id: string
  name: string
  location?: string
}

interface SiteVisitReportDrawerProps {
  isOpen: boolean
  onClose: () => void
  properties: PropertyOption[]
  defaultPropertyId?: string
}

export default function SiteVisitReportDrawer({
  isOpen,
  onClose,
  properties,
  defaultPropertyId = '',
}: SiteVisitReportDrawerProps) {
  const [isPending, startTransition] = useTransition()
  const [selectedPropId, setSelectedPropId] = useState<string>(
    defaultPropertyId || (properties.length > 0 ? properties[0].id : '')
  )
  const [cleanliness, setCleanliness] = useState<string>('good')
  const [garbageCollected, setGarbageCollected] = useState<boolean>(true)
  const [drainageStatus, setDrainageStatus] = useState<string>('clear_and_flowing')
  const [gardensStatus, setGardensStatus] = useState<string>('well_maintained')
  const [parkingCompliance, setParkingCompliance] = useState<boolean>(true)
  const [kplcStatus, setKplcStatus] = useState<string>('normal')
  const [caretakerName, setCaretakerName] = useState<string>('')
  const [caretakerFeedback, setCaretakerFeedback] = useState<string>('')
  const [issuesObserved, setIssuesObserved] = useState<string>('')
  const [actionItems, setActionItems] = useState<string>('')
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const activeProperty = properties.find((p) => p.id === selectedPropId)
  const isProsper = activeProperty?.name.toLowerCase().includes('prosper')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    const formData = new FormData()
    formData.append('property_id', selectedPropId)
    formData.append('cleanliness_rating', cleanliness)
    formData.append('garbage_collected', String(garbageCollected))
    formData.append('drainage_status', drainageStatus)
    formData.append('gardens_status', gardensStatus)
    formData.append('parking_compliance', String(parkingCompliance))
    formData.append('kplc_status', kplcStatus)
    formData.append('caretaker_name', caretakerName.trim())
    formData.append('caretaker_feedback', caretakerFeedback.trim())
    formData.append('issues_observed', issuesObserved.trim())
    formData.append('action_items', actionItems.trim())

    startTransition(async () => {
      const res = await submitSiteVisitReport(formData)
      if (res.success) {
        setMessage({ text: 'Site visit report logged successfully!', type: 'success' })
        setTimeout(() => {
          onClose()
        }, 1200)
      } else {
        setMessage({ text: res.error || 'Failed to submit report', type: 'error' })
      }
    })
  }

  const drawerFooter = (
    <div className="flex items-center justify-between w-full">
      <button
        type="button"
        onClick={onClose}
        disabled={isPending}
        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
      >
        Cancel
      </button>
      <button
        type="submit"
        form="site-visit-form"
        disabled={isPending}
        className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-xs cursor-pointer flex items-center gap-2"
      >
        {isPending ? (
          <>
            <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Submitting Inspection...</span>
          </>
        ) : (
          <span>Submit Site Visit Report</span>
        )}
      </button>
    </div>
  )

  return (
    <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Site Visit & Inspection Report"
      subtitle="Property Coordinator Ground Accountability Log"
      footer={drawerFooter}
      maxWidth="max-w-xl"
    >
      <form id="site-visit-form" onSubmit={handleSubmit} className="space-y-5 text-xs text-slate-900">
        {message && (
          <div
            className={`p-3.5 rounded-xl font-semibold border ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Site Selection */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Inspected Property Site <span className="text-rose-500">*</span>
          </label>
          <select
            value={selectedPropId}
            onChange={(e) => setSelectedPropId(e.target.value)}
            required
            className="w-full rounded-xl px-3.5 py-2.5 border border-slate-200 bg-white font-semibold text-slate-900 cursor-pointer text-xs"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.location ? `(${p.location})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Special Prosper Callout */}
        {isProsper && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 flex items-start gap-2.5">
            <svg className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <span className="font-bold block text-xs">Prosper Site Focus: Drainage & Rent Follow-up</span>
              <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                Ensure the drainage system at Prosper is thoroughly checked for blockages, garbage collection is verified, and outstanding water bills are audited.
              </p>
            </div>
          </div>
        )}

        {/* Ground Check Grid */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-900 block">
            Physical Compound Checks
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Cleanliness */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Compound Cleanliness
              </label>
              <select
                value={cleanliness}
                onChange={(e) => setCleanliness(e.target.value)}
                className="w-full rounded-lg px-3 py-2 border border-slate-200 bg-white font-medium text-slate-800"
              >
                <option value="excellent">Excellent (Spotless)</option>
                <option value="good">Good (Standard)</option>
                <option value="fair">Fair (Minor litter)</option>
                <option value="poor">Poor (Requires deep clean)</option>
              </select>
            </div>

            {/* Garbage Collection */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Garbage Collection
              </label>
              <select
                value={String(garbageCollected)}
                onChange={(e) => setGarbageCollected(e.target.value === 'true')}
                className="w-full rounded-lg px-3 py-2 border border-slate-200 bg-white font-medium text-slate-800"
              >
                <option value="true">Collected On-Time</option>
                <option value="false">Delayed / Overflowing</option>
              </select>
            </div>

            {/* Drainage Status */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Drainage System Flow
              </label>
              <select
                value={drainageStatus}
                onChange={(e) => setDrainageStatus(e.target.value)}
                className={`w-full rounded-lg px-3 py-2 border font-medium ${
                  drainageStatus === 'blocked_action_needed'
                    ? 'border-rose-300 bg-rose-50 text-rose-900'
                    : 'border-slate-200 bg-white text-slate-800'
                }`}
              >
                <option value="clear_and_flowing">Clear & Free-Flowing</option>
                <option value="minor_debris">Minor Debris (Clearable)</option>
                <option value="blocked_action_needed">Blocked - Urgent Action</option>
              </select>
            </div>

            {/* Common Gardens */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Gardens & Landscaping
              </label>
              <select
                value={gardensStatus}
                onChange={(e) => setGardensStatus(e.target.value)}
                className="w-full rounded-lg px-3 py-2 border border-slate-200 bg-white font-medium text-slate-800"
              >
                <option value="well_maintained">Well Maintained & Trimmed</option>
                <option value="needs_trimming">Needs Weeding / Trimming</option>
                <option value="poor">Overgrown / Neglected</option>
              </select>
            </div>

            {/* Parking Compliance */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Parking Agreement Compliance
              </label>
              <select
                value={String(parkingCompliance)}
                onChange={(e) => setParkingCompliance(e.target.value === 'true')}
                className="w-full rounded-lg px-3 py-2 border border-slate-200 bg-white font-medium text-slate-800"
              >
                <option value="true">100% In Accordance</option>
                <option value="false">Unauthorized / Blocked Bays</option>
              </select>
            </div>

            {/* KPLC Status */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                KPLC Electricity & Meters
              </label>
              <select
                value={kplcStatus}
                onChange={(e) => setKplcStatus(e.target.value)}
                className="w-full rounded-lg px-3 py-2 border border-slate-200 bg-white font-medium text-slate-800"
              >
                <option value="normal">Normal / All Units Powered</option>
                <option value="meter_issues">Token / Meter Faults</option>
                <option value="disconnections">Pending Reconnections</option>
              </select>
            </div>
          </div>
        </div>

        {/* Caretaker / On-Site Supervisor Coordination */}
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-900 block mb-2">
            Site Caretaker / Supervisor Handover
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Caretaker Name on Duty
              </label>
              <input
                type="text"
                placeholder="e.g. Samuel (Caretaker)"
                value={caretakerName}
                onChange={(e) => setCaretakerName(e.target.value)}
                className="w-full rounded-xl px-3 py-2 border border-slate-200 text-slate-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Caretaker Ground Feedback
              </label>
              <input
                type="text"
                placeholder="e.g. Pump serviced, security guards alert"
                value={caretakerFeedback}
                onChange={(e) => setCaretakerFeedback(e.target.value)}
                className="w-full rounded-xl px-3 py-2 border border-slate-200 text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Observed Issues & Action Items */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
            Observed Defects or Resident Complaints
          </label>
          <textarea
            rows={2}
            placeholder="Document any physical damages, water pump issues, noise complaints, or contractor snags..."
            value={issuesObserved}
            onChange={(e) => setIssuesObserved(e.target.value)}
            className="w-full rounded-xl px-3.5 py-2 border border-slate-200 text-slate-900"
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
            Action Items & Contractor Follow-Ups
          </label>
          <textarea
            rows={2}
            placeholder="e.g. Coordinate plumber for unit 3A, follow up water bills at Prosper..."
            value={actionItems}
            onChange={(e) => setActionItems(e.target.value)}
            className="w-full rounded-xl px-3.5 py-2 border border-slate-200 text-slate-900"
          />
        </div>
      </form>
    </SlideOverDrawer>
  )
}

