'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SlideOverDrawer from '@/app/dashboard/components/SlideOverDrawer'
import { addTenant } from '../actions'

interface AddTenantDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export default function AddTenantDrawer({ isOpen, onClose }: AddTenantDrawerProps) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Clear previous errors when drawer opens
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
        const result = await addTenant(formData)
        if (result && result.success) {
          formRef.current?.reset()
          setErrorMessage(null)
          onClose()
          router.refresh()
        } else {
          // The drawer MUST NOT close if success is false
          setErrorMessage(result?.error || 'Registration failed. Please review your inputs and try again.')
        }
      } catch (err: any) {
        // The drawer MUST NOT close if an exception occurs
        setErrorMessage(err?.message || 'An unexpected error occurred while communicating with the server.')
      }
    })
  }

  return (
    <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Register Tenant"
      subtitle="Create an authorized tenant record with verified credentials for portal and lease allocation."
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
            form="add-tenant-form"
            disabled={isPending}
            className="bg-slate-900 hover:bg-slate-800 hover:shadow-md text-white font-semibold text-xs py-2.5 px-6 rounded-lg cursor-pointer transition-all duration-200 ease-in-out shadow-xs disabled:opacity-50 flex items-center gap-2"
          >
            {isPending ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Registering...</span>
              </>
            ) : (
              <span>Register Tenant</span>
            )}
          </button>
        </>
      }
    >
      <form id="add-tenant-form" ref={formRef} onSubmit={handleSubmit} className="space-y-6">
        {/* Prominent Red 'Rose' Alert Banner displayed at top of drawer on failure */}
        {errorMessage && (
          <div className="bg-rose-100 text-rose-700 p-3 rounded-md mb-4 text-xs font-semibold flex items-start gap-2.5 border border-rose-200">
            <svg className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <span className="font-bold block mb-0.5">Registration Failed</span>
              <p className="font-medium text-rose-800 leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Section 1: Personal Information */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3 flex items-center gap-2">
            <span>Personal Information</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="drawer_first_name">
                First Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="drawer_first_name"
                name="first_name"
                placeholder="e.g. James"
                required
                className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="drawer_last_name">
                Last Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="drawer_last_name"
                name="last_name"
                placeholder="e.g. Mwangi"
                required
                className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition"
              />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200/80" />

        {/* Section 2: Contact & Access Details */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3 flex items-center gap-2">
            <span>Contact & Portal Access</span>
          </h3>
          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="drawer_email">
                Official Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                id="drawer_email"
                type="email"
                name="email"
                placeholder="tenant@domain.com"
                required
                className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="drawer_phone_number">
                Primary Phone Number <span className="text-rose-500">*</span>
              </label>
              <input
                id="drawer_phone_number"
                type="tel"
                name="phone_number"
                placeholder="+254 700 000 000"
                required
                className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700" htmlFor="drawer_password">
                  Initial Portal Password <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <span className="text-[10px] text-slate-400">Default: TenantPass2026!</span>
              </div>
              <input
                id="drawer_password"
                type="password"
                name="password"
                placeholder="Leave blank for default: TenantPass2026!"
                className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                The tenant can sign in to the Tenant Escrow Portal immediately with this password.
              </p>
            </div>
          </div>
        </div>
      </form>
    </SlideOverDrawer>
  )
}
