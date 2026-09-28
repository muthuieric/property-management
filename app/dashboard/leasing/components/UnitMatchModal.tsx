'use client'

import { useState, useEffect } from 'react'
import { suggestUnitMatches, UnitMatch } from '../actions'

interface UnitMatchModalProps {
  isOpen: boolean
  onClose: () => void
  leadId: string | null
  leadName?: string
  leadBudget?: number | null
  onSelectUnit?: (unit: UnitMatch) => void
}

export default function UnitMatchModal({
  isOpen,
  onClose,
  leadId,
  leadName,
  leadBudget,
  onSelectUnit,
}: UnitMatchModalProps) {
  const [loading, setLoading] = useState(true)
  const [matches, setMatches] = useState<UnitMatch[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !leadId) return

    setLoading(true)
    setError(null)
    suggestUnitMatches(leadId)
      .then((res) => {
        if (res.success) {
          setMatches(res.matches)
        } else {
          setError(res.error || 'Failed to calculate recommendations.')
        }
      })
      .catch((err) => {
        setError(err?.message || 'Error fetching unit matches.')
      })
      .finally(() => setLoading(false))
  }, [isOpen, leadId])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
      />

      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-slate-200">
          {/* Header */}
          <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 block mb-1">
                AI Matchmaking Engine
              </span>
              <h3 className="text-base font-bold text-white">
                Recommended Units for {leadName || 'Prospect'}
              </h3>
              {leadBudget != null && leadBudget > 0 && (
                <p className="text-xs text-slate-300 mt-0.5">
                  Target Budget: <span className="font-mono font-semibold text-white">KES {leadBudget.toLocaleString()}</span> / month
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {loading ? (
              <div className="py-12 text-center space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-900 border-t-transparent mx-auto" />
                <p className="text-xs text-slate-500 font-medium">
                  Scanning vacant units against prospect preferences...
                </p>
              </div>
            ) : error ? (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                <p className="font-semibold">{error}</p>
              </div>
            ) : matches.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h4 className="text-xs font-bold text-slate-900">No Matching Vacant Units Found</h4>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  All units matching this price bracket may currently be occupied or in active leases.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {matches.map((match, idx) => (
                  <div
                    key={match.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-slate-300 hover:shadow-xs transition flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {match.property_name} &bull; Unit {match.unit_number}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {match.match_score}% Match
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="font-mono font-bold text-slate-900">
                          KES {match.base_rent.toLocaleString()} / mo
                        </span>
                        <span className="text-slate-400">&bull;</span>
                        <span className="text-slate-500 font-medium">
                          {match.status_label}
                        </span>
                      </div>
                    </div>

                    {onSelectUnit && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectUnit(match)
                          onClose()
                        }}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white cursor-pointer transition shrink-0"
                      >
                        Allocate Unit
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

