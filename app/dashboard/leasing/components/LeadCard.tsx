'use client'

import { useState } from 'react'

export interface LeadItem {
  id: string
  full_name: string
  phone_number: string
  email?: string | null
  lead_source: string
  stage: string
  budget_max?: number | null
  preferred_bedrooms?: number | null
  notes?: string | null
  property_id?: string | null
  properties?: { id: string; name: string } | null
  assigned_coordinator_id?: string | null
  profiles?: { id: string; first_name: string; last_name: string } | null
  converted_tenant_id?: string | null
  created_at: string
}

interface LeadCardProps {
  lead: LeadItem
  isConverting?: boolean
  onStageChange: (leadId: string, newStage: string) => void
  onConvert: (lead: LeadItem) => void
  onViewMatches: (lead: LeadItem) => void
  onDelete?: (leadId: string) => void
}

const STAGES = [
  { id: 'lead_entry', label: 'Lead Entry', step: 1 },
  { id: 'negotiating', label: 'Negotiation', step: 2 },
  { id: 'pre_qualification', label: 'Pre-Qualification', step: 3 },
  { id: 'converted', label: 'Converted', step: 4 },
]

export default function LeadCard({
  lead,
  isConverting = false,
  onStageChange,
  onConvert,
  onViewMatches,
  onDelete,
}: LeadCardProps) {
  const [showNotes, setShowNotes] = useState(false)

  const currentStageIndex = STAGES.findIndex((s) => s.id === lead.stage)
  const prevStage = currentStageIndex > 0 ? STAGES[currentStageIndex - 1] : null
  const nextStage = currentStageIndex >= 0 && currentStageIndex < STAGES.length - 1 ? STAGES[currentStageIndex + 1] : null

  const isConverted = lead.stage === 'converted' || Boolean(lead.converted_tenant_id)
  const isPreQualified = lead.stage === 'pre_qualification'

  const propertyName = lead.properties?.name || 'Flexible Site'
  const coordinatorName = lead.profiles
    ? `${lead.profiles.first_name} ${lead.profiles.last_name}`.trim()
    : 'Unassigned'

  return (
    <div
      className={`group rounded-xl border bg-white p-4 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-3 relative ${
        isPreQualified
          ? 'border-indigo-200 ring-1 ring-indigo-50/50'
          : isConverted
          ? 'border-emerald-200 bg-emerald-50/20'
          : 'border-slate-200/90 hover:border-slate-300'
      }`}
    >
      {/* Top Row: Source Badge & Budget */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/60">
            {lead.lead_source}
          </span>
          {lead.preferred_bedrooms != null && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
              {lead.preferred_bedrooms === 0 ? 'Studio' : `${lead.preferred_bedrooms} Bed`}
            </span>
          )}
        </div>

        {lead.budget_max != null && lead.budget_max > 0 ? (
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block -mb-0.5">Budget</span>
            <span className="font-mono text-xs font-bold text-slate-900 tabular-nums">
              KES {Number(lead.budget_max).toLocaleString()}
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400 font-normal italic">Open budget</span>
        )}
      </div>

      {/* Prospect Identity */}
      <div>
        <h4 className="text-sm font-bold text-slate-900 leading-snug group-hover:text-slate-800">
          {lead.full_name}
        </h4>
        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-medium flex-wrap">
          {lead.phone_number?.includes('*') ? (
            <span
              className="inline-flex items-center gap-1 text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 cursor-not-allowed select-none"
              title="Direct contact disabled for privacy. Please use the internal messaging portal."
            >
              <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="font-mono">{lead.phone_number}</span>
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <a
                href={`tel:${lead.phone_number}`}
                className="hover:text-slate-900 hover:underline flex items-center gap-1 font-mono text-slate-700"
                title="Call Prospect"
              >
                <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span>{lead.phone_number}</span>
              </a>
              <a
                href={`https://wa.me/${lead.phone_number.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:text-emerald-700 hover:underline inline-flex items-center gap-0.5 text-[10px] font-semibold"
                title="WhatsApp Prospect"
              >
                <span>WhatsApp</span>
              </a>
            </div>
          )}
          {lead.email && (
            <>
              <span className="text-slate-300">&bull;</span>
              <span className="truncate max-w-[130px]" title={lead.email}>
                {lead.email}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Destination Property & Coordinator Meta */}
      <div className="bg-slate-50 rounded-lg p-2.5 text-[11px] space-y-1 border border-slate-200/60">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Target Site:</span>
          <span className="font-semibold text-slate-800 truncate max-w-[140px]" title={propertyName}>
            {propertyName}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Coordinator:</span>
          <span className="font-medium text-slate-700 truncate max-w-[140px]" title={coordinatorName}>
            {coordinatorName}
          </span>
        </div>
      </div>

      {/* Follow-up Notes snippet (if any) */}
      {lead.notes && (
        <div className="text-[11px] text-slate-600 bg-amber-50/50 border border-amber-200/60 rounded-lg p-2">
          <p className={showNotes ? '' : 'line-clamp-2'}>{lead.notes}</p>
          {lead.notes.length > 75 && (
            <button
              type="button"
              onClick={() => setShowNotes(!showNotes)}
              className="text-[10px] font-semibold text-amber-800 hover:underline mt-0.5 cursor-pointer block"
            >
              {showNotes ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      )}

      {/* Matchmaking AI Engine recommendation trigger */}
      {lead.budget_max != null && lead.budget_max > 0 && !isConverted && (
        <button
          type="button"
          onClick={() => onViewMatches(lead)}
          className="w-full py-1.5 px-2.5 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 transition flex items-center justify-center gap-1.5 cursor-pointer bg-white"
        >
          <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span>Find Vacant Unit Matches</span>
        </button>
      )}

      {/* Bottom Actions: Convert CTA or Fast Stage Shift controls */}
      <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
        {/* High-Priority "Convert to Tenant" CTA button */}
        {!isConverted ? (
          <button
            type="button"
            onClick={() => onConvert(lead)}
            disabled={isConverting}
            className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-xs ${
              isPreQualified
                ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-emerald-700/20'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            } disabled:opacity-50`}
          >
            {isConverting ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Converting Prospect...</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Convert to Tenant & Lease</span>
              </>
            )}
          </button>
        ) : (
          <div className="bg-emerald-100/80 border border-emerald-300/60 rounded-lg p-2 text-center text-emerald-900 text-xs font-bold flex items-center justify-center gap-1.5">
            <svg className="w-4 h-4 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span>Tenant Account Active</span>
          </div>
        )}

        {/* Fast Stage Movement Controls */}
        {!isConverted && (
          <div className="flex items-center justify-between gap-1.5 pt-1">
            {prevStage ? (
              <button
                type="button"
                onClick={() => onStageChange(lead.id, prevStage.id)}
                className="px-2 py-1 text-[10px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded border border-slate-200 transition cursor-pointer"
                title={`Move backward to ${prevStage.label}`}
              >
                &larr; {prevStage.label}
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onStageChange(lead.id, 'lost')}
                className="px-1.5 py-1 text-[10px] font-medium text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                title="Mark Lead as Lost"
              >
                Lost
              </button>

              {nextStage && (
                <button
                  type="button"
                  onClick={() => onStageChange(lead.id, nextStage.id)}
                  className="px-2.5 py-1 text-[10px] font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition cursor-pointer flex items-center gap-1"
                  title={`Advance forward to ${nextStage.label}`}
                >
                  <span>Advance</span>
                  <span>&rarr;</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

