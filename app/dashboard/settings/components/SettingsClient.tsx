'use client'

import { useState, useTransition } from 'react'
import {
  AgencySettings,
  AgencySettingKey,
  updateAgencySetting,
} from '../actions'

interface SettingsClientProps {
  initialSettings: AgencySettings
  agencyName?: string
}

interface ToastState {
  id: number
  message: string
  type: 'success' | 'error'
}

interface ProtocolConfig {
  key: AgencySettingKey
  title: string
  subtitle: string
  category: string
  impactBadge: string
  icon: React.ReactNode
}

const PROTOCOLS: ProtocolConfig[] = [
  {
    key: 'require_expense_approval',
    title: 'Mandatory Approval Chain for Expenses',
    subtitle:
      'Enforces executive Agency Owner sign-off on all coordinator and maintenance quotes exceeding statutory thresholds (KES 5,000.00 default) before contractor disbursement.',
    category: 'Financial Risk Control',
    impactBadge: 'Expense Guardrail',
    icon: (
      <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    key: 'require_invoice_cancellation_approval',
    title: 'Mandatory Approval for Invoice Cancellations',
    subtitle:
      'Prevents property managers or assistant accountants from unilaterally voiding active rent charges, utility assessments, or penalty invoices without cryptographic audit logging.',
    category: 'Revenue Integrity',
    impactBadge: 'Audit Defense',
    icon: (
      <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    key: 'enable_automated_billing',
    title: 'Enable Automated Recurring Monthly Billing',
    subtitle:
      'Autonomously generates monthly tenant rent vouchers, water utility offsets, and recurring service fees on the 1st of each calendar month with instant SMS/Email distribution.',
    category: 'Autonomous Operations',
    impactBadge: 'Automation Engine',
    icon: (
      <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
]

export default function SettingsClient({ initialSettings, agencyName }: SettingsClientProps) {
  const [settings, setSettings] = useState<AgencySettings>(initialSettings)
  const [updatingKey, setUpdatingKey] = useState<AgencySettingKey | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [, startTransition] = useTransition()

  const showToast = (message: string, type: 'success' | 'error') => {
    const id = Date.now()
    setToast({ id, message, type })
    setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current))
    }, 4000)
  }

  const handleToggle = (key: AgencySettingKey) => {
    const previousValue = settings[key]
    const nextValue = !previousValue

    // Optimistic state update
    setSettings((prev) => ({ ...prev, [key]: nextValue }))
    setUpdatingKey(key)

    const protocol = PROTOCOLS.find((p) => p.key === key)
    const protocolLabel = protocol?.title || key

    startTransition(async () => {
      const res = await updateAgencySetting(key, nextValue)

      if (res.success && res.settings) {
        setSettings(res.settings)
        showToast(
          `${protocolLabel} is now ${nextValue ? 'active' : 'disabled'}.`,
          'success'
        )
      } else {
        // Rollback optimistic update
        setSettings((prev) => ({ ...prev, [key]: previousValue }))
        showToast(
          res.error || `Failed to update ${protocolLabel}.`,
          'error'
        )
      }
      setUpdatingKey(null)
    })
  }

  const activeCount = [
    settings.require_expense_approval,
    settings.require_invoice_cancellation_approval,
    settings.enable_automated_billing,
  ].filter(Boolean).length

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Toast Notification Container */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-xs font-semibold max-w-md ${
              toast.type === 'success'
                ? 'bg-slate-900 text-white border-slate-800'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
          >
            {toast.type === 'success' ? (
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-600 flex items-center justify-center shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-slate-200 p-0.5"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Hero Overview Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-6 md:p-8 shadow-xl border border-slate-800 flex flex-col md:flex-row justify-between md:items-center gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/30">
              Enterprise Governance
            </span>
            <span className="text-xs text-slate-400">
              Silqu-Equivalent Compliance Engine
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">
            Institutional Operational Protocols
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Configure global governance rules, coordinator spending thresholds, and autonomous billing policies for{' '}
            <strong className="text-white">{agencyName || 'your agency'}</strong>. Changes take effect across all properties in real-time.
          </p>
        </div>

        {/* Status Scorecard */}
        <div className="bg-slate-800/80 backdrop-blur-xs border border-slate-700/60 rounded-xl p-4 flex md:flex-col items-center justify-between md:justify-center text-center gap-3 shrink-0">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Active Controls
            </span>
            <span className="text-2xl font-extrabold text-emerald-400 tabular-nums">
              {activeCount} / 3
            </span>
          </div>
          <div className="text-left md:text-center">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {activeCount >= 2 ? 'Strict Enforcement' : 'Standard Mode'}
            </span>
          </div>
        </div>
      </div>

      {/* Protocols List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Core Approval & Automation Policies
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Instant toggles wired to Supabase Row-Level Security and financial controllers.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {PROTOCOLS.map((protocol) => {
            const isEnabled = settings[protocol.key]
            const isUpdating = updatingKey === protocol.key

            return (
              <div
                key={protocol.key}
                className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-5"
              >
                {/* Protocol Info */}
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl shrink-0 mt-0.5">
                    {protocol.icon}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">
                        {protocol.title}
                      </h4>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        {protocol.category}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          isEnabled
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {isEnabled ? 'Enforced' : 'Inactive'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                      {protocol.subtitle}
                    </p>
                  </div>
                </div>

                {/* Interactive Toggle Switch (Tailwind CSS) */}
                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <span className="text-xs font-semibold text-slate-500 sm:hidden">
                    {isEnabled ? 'Policy Enabled' : 'Policy Disabled'}
                  </span>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={isEnabled}
                    disabled={isUpdating}
                    onClick={() => handleToggle(protocol.key)}
                    className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                      isEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                    } ${isUpdating ? 'opacity-60 cursor-wait' : ''}`}
                  >
                    <span className="sr-only">{protocol.title}</span>
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        isEnabled ? 'translate-x-6' : 'translate-x-0'
                      } flex items-center justify-center`}
                    >
                      {isUpdating ? (
                        <svg className="animate-spin h-3 w-3 text-slate-500" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                      ) : isEnabled ? (
                        <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      )}
                    </span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Enterprise Security Audit Strip */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-600">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <span className="font-bold text-slate-900 block">
              Cryptographic Audit Logging Active
            </span>
            <span className="text-[11px] text-slate-500">
              All protocol toggle events are bound to Agency Owner identity and persisted with microsecond precision.
            </span>
          </div>
        </div>

        <span className="text-[11px] font-mono text-slate-400 shrink-0">
          Last Synced: {settings.updated_at ? new Date(settings.updated_at).toLocaleTimeString() : 'Current Session'}
        </span>
      </div>
    </div>
  )
}

