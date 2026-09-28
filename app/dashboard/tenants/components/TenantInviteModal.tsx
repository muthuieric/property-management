'use client'

import { useState, useTransition, useEffect } from 'react'
import SlideOverDrawer from '@/app/dashboard/components/SlideOverDrawer'
import { generateTenantInvite, getVacantUnits, VacantUnitItem } from '../actions'

interface TenantInviteModalProps {
  isOpen: boolean
  onClose: () => void
  initialVacantUnits?: VacantUnitItem[]
}

export default function TenantInviteModal({
  isOpen,
  onClose,
  initialVacantUnits = [],
}: TenantInviteModalProps) {
  const [vacantUnits, setVacantUnits] = useState<VacantUnitItem[]>(initialVacantUnits)
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [tenantPhone, setTenantPhone] = useState('')
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [inviteResult, setInviteResult] = useState<{
    inviteUrl: string
    inviteToken: string
    unitNumber: string
    propertyName: string
  } | null>(null)
  const [isCopied, setIsCopied] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null)
      setInviteResult(null)
      setIsCopied(false)

      if (initialVacantUnits.length > 0) {
        setVacantUnits(initialVacantUnits)
      } else {
        setIsLoadingUnits(true)
        getVacantUnits()
          .then((units) => setVacantUnits(units))
          .catch((err) => console.error('Failed to load vacant units:', err))
          .finally(() => setIsLoadingUnits(false))
      }
    }
  }, [isOpen, initialVacantUnits])

  const handleGenerateInvite = () => {
    if (!selectedUnitId) {
      setErrorMessage('Please select a target vacant unit.')
      return
    }
    if (!tenantPhone.trim()) {
      setErrorMessage('Please provide the tenant phone number.')
      return
    }

    setErrorMessage(null)

    startTransition(async () => {
      try {
        const res = await generateTenantInvite(tenantPhone.trim(), selectedUnitId)
        if (res.success && res.inviteUrl && res.inviteToken) {
          const unit = vacantUnits.find((u) => u.id === selectedUnitId)
          setInviteResult({
            inviteUrl: res.inviteUrl,
            inviteToken: res.inviteToken,
            unitNumber: unit?.unit_number || '',
            propertyName: unit?.property_name || '',
          })
        } else {
          setErrorMessage(res.error || 'Failed to generate onboarding invite.')
        }
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error ? err.message : 'An error occurred while generating invite.'
        )
      }
    })
  }

  const getFullUrl = () => {
    if (!inviteResult) return ''
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${inviteResult.inviteUrl}`
    }
    return `https://luffi.tech${inviteResult.inviteUrl}`
  }

  const handleCopyLink = async () => {
    const fullUrl = getFullUrl()
    try {
      await navigator.clipboard.writeText(fullUrl)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2500)
    } catch (err) {
      console.error('Failed to copy link:', err)
    }
  }

  const handleShareWhatsApp = () => {
    const fullUrl = getFullUrl()
    const cleanPhone = tenantPhone.replace(/[^0-9]/g, '')
    const msg = `Hello! You have been invited to onboard your tenancy on Luffi Tech for Unit ${inviteResult?.unitNumber} at ${inviteResult?.propertyName}. Please complete your registration details here: ${fullUrl}`
    const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`
    window.open(waUrl, '_blank', 'noopener,noreferrer')
  }

  const handleReset = () => {
    setInviteResult(null)
    setTenantPhone('')
    setSelectedUnitId('')
    setErrorMessage(null)
  }

  return (
    <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Self-Serve Tenant Invitation"
      subtitle="Issue a cryptographic 7-day invite link for prospective tenants to complete mobile KYC."
      maxWidth="max-w-md"
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Close
          </button>

          {inviteResult ? (
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
            >
              + Create Another Invite
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGenerateInvite}
              disabled={isPending || !selectedUnitId || !tenantPhone}
              className="px-5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isPending ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <span>Generate Link</span>
                  <span>&rarr;</span>
                </>
              )}
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-5 text-slate-900">
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
            <span className="font-bold text-red-500">!</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {!inviteResult ? (
          /* Input Form */
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Allocate Vacant Unit <span className="text-red-500">*</span>
              </label>
              {isLoadingUnits ? (
                <div className="text-xs text-slate-400 py-2">Loading available units...</div>
              ) : vacantUnits.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  No vacant units available to assign an invite to.
                </div>
              ) : (
                <select
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                >
                  <option value="">-- Choose Unit to Assign --</option>
                  {vacantUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.property_name} &bull; Unit {u.unit_number} (KES {u.base_rent.toLocaleString()}/mo)
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tenant Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={tenantPhone}
                onChange={(e) => setTenantPhone(e.target.value)}
                placeholder="e.g. 0712345678 or +254 712 345 678"
                className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                The onboarding registration will be locked to this mobile number.
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs text-slate-600">
              <div className="font-semibold text-slate-800">How Self-Serve Invites Work:</div>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-500">
                <li>A single-use link is generated that expires in 7 days.</li>
                <li>The prospective tenant fills out their KYC profile and next-of-kin.</li>
                <li>An active lease is automatically provisioned and the unit is marked occupied.</li>
                <li>Karibu VMS credentials are automatically activated.</li>
              </ul>
            </div>
          </div>
        ) : (
          /* Generated Invite Link Card */
          <div className="space-y-4 animate-in fade-in">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                  ✓
                </span>
                <span className="text-xs font-bold text-emerald-900">
                  Onboarding Link Ready
                </span>
              </div>
              <p className="text-xs text-emerald-800">
                Assigned to <strong>Unit {inviteResult.unitNumber}</strong> ({inviteResult.propertyName}) for recipient{' '}
                <strong>{tenantPhone}</strong>.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Shareable Onboarding URL (Valid for 7 Days)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={getFullUrl()}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                    isCopied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  {isCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                </svg>
                <span>Share via WhatsApp</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </SlideOverDrawer>
  )
}

