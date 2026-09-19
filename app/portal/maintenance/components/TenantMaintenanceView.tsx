'use client'

import { useState } from 'react'
import TenantLogTicketDrawer from './TenantLogTicketDrawer'

interface TenantMaintenanceViewProps {
  tickets: any[]
  activeLease: any
  createTicketAction: (formData: FormData) => Promise<void> | void
  message?: string
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function calculateDuration(startStr: string, endStr?: string | null) {
  const start = new Date(startStr).getTime()
  const end = endStr ? new Date(endStr).getTime() : Date.now()
  const diffMs = Math.max(0, end - start)
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 60) return `${diffMinutes}m`
  if (diffHours < 24) return `${diffHours}h ${diffMinutes % 60}m`
  if (diffDays === 1) return `1 day ${diffHours % 24}h`
  return `${diffDays} days`
}

export default function TenantMaintenanceView({
  tickets,
  activeLease,
  createTicketAction,
  message,
}: TenantMaintenanceViewProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isSuccess = message && message.toLowerCase().includes('success')

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full max-w-7xl mx-auto space-y-8">
      {/* PAGE HEADER */}
      <header className="flex flex-col md:flex-row md:items-end justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
              Resident Repairs & SLA Dispatch
            </span>
            {activeLease && (
              <span className="text-xs text-slate-500 font-mono">
                Unit #{activeLease.units?.unit_number} &bull; {activeLease.units?.properties?.name}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Maintenance Requests
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Report maintenance issues, upload photographic evidence, and track technician resolution progress.
          </p>
        </div>

        {/* Action Trigger Button */}
        <div>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            disabled={!activeLease}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 hover:shadow-md text-white cursor-pointer transition-all duration-200 ease-in-out shadow-xs disabled:opacity-50"
          >
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Log New Request</span>
          </button>
        </div>
      </header>

      {/* FEEDBACK BANNER */}
      {message && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold border flex items-center justify-between ${
            isSuccess
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <span>{message}</span>
        </div>
      )}

      {/* TICKET HISTORY */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Request History</h2>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
            {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}
          </span>
        </div>

        {tickets.length === 0 ? (
          <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-12 text-center max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">No Maintenance Requests Logged</h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-5">
              Everything in your residence is currently in order. If a fixture breaks or repairs are needed, click below to open a ticket.
            </p>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              disabled={!activeLease}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white cursor-pointer transition shadow-xs"
            >
              <span>Submit First Request</span>
              <span>&rarr;</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {tickets.map((ticket) => {
              const isResolved = ticket.status === 'Resolved'
              const isInProgress = ticket.status === 'In Progress'
              const isPending = !isResolved && !isInProgress
              const duration = calculateDuration(ticket.created_at, ticket.resolved_at)

              return (
                <div
                  key={ticket.id}
                  className="bg-white shadow-sm border border-slate-200 rounded-xl p-6 transition-all duration-200 hover:border-slate-300"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-slate-400 font-mono">
                          #{ticket.id.slice(0, 8)}
                        </span>
                        <span className="text-slate-300">&bull;</span>
                        <span className="text-xs text-slate-500 font-medium">
                          Unit #{ticket.units?.unit_number} ({ticket.units?.properties?.name})
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-base leading-snug">
                        {ticket.issue_description}
                      </h3>
                    </div>

                    {/* Established Status Badges Color Psychology */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isResolved && (
                        <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span>Resolved</span>
                        </span>
                      )}

                      {isInProgress && (
                        <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <span className="h-2 w-2 rounded-full bg-blue-600 animate-ping mr-0.5" />
                          <span>In Progress</span>
                        </span>
                      )}

                      {isPending && (
                        <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Pending Review</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {ticket.image_url && (
                    <div className="my-3">
                      <a
                        href={ticket.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block group cursor-pointer"
                      >
                        <img
                          src={ticket.image_url}
                          alt="Reported repair condition"
                          className="max-h-48 rounded-xl border border-slate-200 object-cover group-hover:opacity-90 transition shadow-xs"
                        />
                      </a>
                    </div>
                  )}

                  {/* Footnotes & Timestamps */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
                    <div className="flex flex-wrap items-center gap-3">
                      <span>Submitted: <strong className="font-semibold text-slate-700">{formatDateTime(ticket.created_at)}</strong></span>
                      {ticket.resolved_at && (
                        <>
                          <span>&bull;</span>
                          <span>Resolved: <strong className="font-semibold text-emerald-800">{formatDateTime(ticket.resolved_at)}</strong></span>
                        </>
                      )}
                    </div>

                    <div>
                      {isResolved ? (
                        <span className="font-semibold text-emerald-800 text-[11px]">
                          ⚡ Turnaround: {duration}
                        </span>
                      ) : (
                        <span className="font-semibold text-amber-800 text-[11px]">
                          ⏳ In queue for {duration}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* SLIDE-OVER DRAWER FOR LOGGING TICKETS */}
      {activeLease && (
        <TenantLogTicketDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          activeLease={activeLease}
          action={createTicketAction}
        />
      )}
    </div>
  )
}
