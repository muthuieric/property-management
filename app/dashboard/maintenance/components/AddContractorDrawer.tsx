'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import SlideOverDrawer from '@/app/dashboard/components/SlideOverDrawer'
import { addContractor } from '../actions'

interface AddContractorDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export default function AddContractorDrawer({ isOpen, onClose }: AddContractorDrawerProps) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)

    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await addContractor(formData)
      if (result.success) {
        formRef.current?.reset()
        onClose()
        router.refresh()
      } else {
        setErrorMessage(result.error || 'Failed to add contractor.')
      }
    })
  }

  return (
    <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Add Trade Contractor"
      subtitle="Register a verified technician or company to your agency dispatch network."
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
            form="add-contractor-form"
            disabled={isPending}
            className="bg-slate-900 hover:bg-slate-800 hover:shadow-md text-white font-semibold text-xs py-2.5 px-6 rounded-lg cursor-pointer transition-all duration-200 ease-in-out shadow-xs disabled:opacity-50 flex items-center gap-2"
          >
            {isPending ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Contractor</span>
            )}
          </button>
        </>
      }
    >
      <form id="add-contractor-form" ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3.5 rounded-lg text-xs font-medium bg-rose-50 border border-rose-200 text-rose-700">
            {errorMessage}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="contractor_name">
            Company or Technician Name <span className="text-rose-500">*</span>
          </label>
          <input
            id="contractor_name"
            name="name"
            placeholder="e.g. Rapid Plumbing & Electrical Ltd"
            required
            className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="contractor_specialty">
            Primary Trade Specialty <span className="text-rose-500">*</span>
          </label>
          <select
            id="contractor_specialty"
            name="specialty"
            required
            className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition"
          >
            <option value="">-- Select Trade Category --</option>
            <option value="Plumbing">Plumbing & Water Systems</option>
            <option value="Electrical">Electrical & Power Systems</option>
            <option value="General Handyman">General Handyman / Repairs</option>
            <option value="HVAC">HVAC / Air Conditioning</option>
            <option value="Painting">Painting & Wall Finishes</option>
            <option value="Roofing">Roofing & Waterproofing</option>
            <option value="Carpentry">Carpentry & Cabinetry</option>
            <option value="Masonry">Masonry & Tiling</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="contractor_phone">
            Direct Phone Number
          </label>
          <input
            id="contractor_phone"
            type="tel"
            name="phone_number"
            placeholder="+254 700 000 000"
            className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="contractor_email">
            Official Email Address
          </label>
          <input
            id="contractor_email"
            type="email"
            name="email"
            placeholder="dispatch@contractor.com"
            className="w-full rounded-lg px-3.5 py-2.5 text-xs bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition"
          />
        </div>
      </form>
    </SlideOverDrawer>
  )
}
