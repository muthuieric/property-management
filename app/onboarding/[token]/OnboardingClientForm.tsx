'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { completeTenantOnboarding } from '@/app/dashboard/tenants/actions'

interface OnboardingClientFormProps {
  token: string
  phone: string
  unitNumber: string
  propertyName: string
  propertyLocation?: string
}

export default function OnboardingClientForm({
  token,
  phone,
  unitNumber,
  propertyName,
  propertyLocation,
}: OnboardingClientFormProps) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [vehicleRegistration, setVehicleRegistration] = useState('')
  const [nextOfKinName, setNextOfKinName] = useState('')
  const [nextOfKinPhone, setNextOfKinPhone] = useState('')
  const [nextOfKinRelation, setNextOfKinRelation] = useState('Spouse')

  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!fullName.trim()) {
      setErrorMessage('Full name is required.')
      return
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please provide a valid email address.')
      return
    }

    startTransition(async () => {
      try {
        const res = await completeTenantOnboarding(token, {
          fullName: fullName.trim(),
          email: email.trim(),
          idNumber: idNumber.trim() || undefined,
          vehicleRegistration: vehicleRegistration.trim() || undefined,
          nextOfKinName: nextOfKinName.trim() || undefined,
          nextOfKinPhone: nextOfKinPhone.trim() || undefined,
          nextOfKinRelation: nextOfKinRelation.trim() || undefined,
        })

        if (res.success) {
          setIsSubmitted(true)
        } else {
          setErrorMessage(res.error || 'Failed to complete registration.')
        }
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error ? err.message : 'An error occurred during submission.'
        )
      }
    })
  }

  if (isSubmitted) {
    return (
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 sm:p-10 text-center animate-in zoom-in-95 duration-300">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-5 shadow-inner">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-50 text-emerald-700">
          Registration Complete
        </span>

        <h2 className="text-2xl font-bold text-slate-900 mt-3">
          Welcome to {propertyName}!
        </h2>

        <p className="text-slate-600 text-xs sm:text-sm mt-2 max-w-md mx-auto leading-relaxed">
          Your resident profile has been created and Unit <strong>{unitNumber}</strong> has been allocated to your lease agreement.
        </p>

        <div className="my-6 p-4 bg-slate-50 border border-slate-200 rounded-xl text-left space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Resident Name:</span>
            <span className="font-semibold text-slate-900">{fullName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Allocated Unit:</span>
            <span className="font-semibold text-slate-900">{unitNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Portal Account:</span>
            <span className="font-mono text-slate-900">{email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Registered Mobile:</span>
            <span className="font-mono text-slate-900">{phone}</span>
          </div>
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-900 mb-6">
          <span className="font-semibold">Access Notice:</span> You can now sign into your Tenant Portal using your email address. Default temporary password: <code className="font-mono font-bold bg-amber-100 px-1 py-0.5 rounded">TenantPass2026!</code> (Please change on first login).
        </div>

        <Link
          href="/login"
          className="inline-block w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-md transition-colors"
        >
          Sign In to Tenant Portal &rarr;
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 sm:p-8 space-y-6">
      {/* Allocation Header Banner */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
            Property Allocation
          </span>
          <h3 className="text-sm font-bold text-slate-900">
            {propertyName} &bull; Unit {unitNumber}
          </h3>
          {propertyLocation && (
            <p className="text-[11px] text-slate-500">{propertyLocation}</p>
          )}
        </div>
        <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full shrink-0">
          Verified Invite
        </span>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
          <span className="font-bold text-red-500">!</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Primary KYC Information */}
      <div className="space-y-4">
        <div className="border-b border-slate-100 pb-2">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            1. Resident Information
          </h4>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Full Legal Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Grace Wanjiku Kariuki"
            className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mobile Number (Locked to Invitation)
            </label>
            <input
              type="tel"
              readOnly
              value={phone}
              className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 font-mono focus:outline-none cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. grace.wanjiku@gmail.com"
              className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              National ID / Passport Number
            </label>
            <input
              type="text"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              placeholder="e.g. 29384712"
              className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Vehicle Registration (Optional)
            </label>
            <input
              type="text"
              value={vehicleRegistration}
              onChange={(e) => setVehicleRegistration(e.target.value.toUpperCase())}
              placeholder="e.g. KDA 123X"
              className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all uppercase"
            />
          </div>
        </div>
      </div>

      {/* Emergency Contact Information */}
      <div className="space-y-4 pt-2">
        <div className="border-b border-slate-100 pb-2">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            2. Next of Kin &amp; Emergency Contact
          </h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Contact Name
            </label>
            <input
              type="text"
              value={nextOfKinName}
              onChange={(e) => setNextOfKinName(e.target.value)}
              placeholder="e.g. Peter Kariuki"
              className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Contact Phone
            </label>
            <input
              type="tel"
              value={nextOfKinPhone}
              onChange={(e) => setNextOfKinPhone(e.target.value)}
              placeholder="e.g. 0722123456"
              className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Relationship
          </label>
          <select
            value={nextOfKinRelation}
            onChange={(e) => setNextOfKinRelation(e.target.value)}
            className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
          >
            <option value="Spouse">Spouse</option>
            <option value="Parent">Parent</option>
            <option value="Sibling">Sibling</option>
            <option value="Child">Child</option>
            <option value="Business Partner">Business Partner</option>
            <option value="Friend">Friend / Colleague</option>
          </select>
        </div>
      </div>

      {/* Submission Button */}
      <div className="pt-3 border-t border-slate-100">
        <button
          type="submit"
          disabled={isPending}
          className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {isPending ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Submitting KYC Details...</span>
            </>
          ) : (
            <>
              <span>Submit &amp; Confirm Tenancy</span>
              <span>&rarr;</span>
            </>
          )}
        </button>
        <p className="text-[11px] text-slate-400 text-center mt-2">
          By submitting, you agree to electronic tenancy registration and portal access under Luffi Tech.
        </p>
      </div>
    </form>
  )
}

