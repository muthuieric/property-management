'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createProperty, updateProperty } from '../actions'

export interface PropertyManager {
  id: string
  first_name: string | null
  last_name: string | null
  role: string | null
}

export interface Property {
  id: string
  name: string
  location: string | null
  property_type: string | null
  purpose?: string | null
  floors?: number | null
  owner_mobile?: string | null
  logo_url?: string | null
  currency?: string | null
  timezone?: string | null
  require_digital_lease_signatures?: boolean | null
  standard_base_rent?: number | null
  standard_water_rate?: number | null
  manager_id: string | null
  management_fee_percentage?: number | null
}

export interface PropertyWizardProps {
  isOwner: boolean
  isEditing?: boolean
  propertyToEdit?: Property | null
  propertyManagers: PropertyManager[]
  managerMap?: Map<string, string>
  isOpen?: boolean
  onClose?: () => void
  variant?: 'modal' | 'drawer' | 'card'
}

const WIZARD_STEPS = [
  { id: 1, title: 'Details', subtitle: 'The Identity' },
  { id: 2, title: 'Pricing & Utilities', subtitle: 'The Financial Engine' },
  { id: 3, title: 'Contacts', subtitle: 'Team Delegation' },
  { id: 4, title: 'Configuration & Launch', subtitle: 'Compliance & Brand' },
]

export default function PropertyWizard({
  isOwner,
  isEditing = false,
  propertyToEdit = null,
  propertyManagers,
  managerMap = new Map(),
  isOpen = true,
  onClose,
  variant = 'card',
}: PropertyWizardProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [stepError, setStepError] = useState<string | null>(null)

  // Step 1: Details (The Identity)
  const [name, setName] = useState(propertyToEdit?.name || '')
  const [location, setLocation] = useState(propertyToEdit?.location || '')
  const [ownerMobile, setOwnerMobile] = useState(propertyToEdit?.owner_mobile || '')
  const [propertyType, setPropertyType] = useState(propertyToEdit?.property_type || 'Apartment')
  const [purpose, setPurpose] = useState(propertyToEdit?.purpose || 'Rent')
  const [floors, setFloors] = useState(String(propertyToEdit?.floors ?? 1))

  // Step 2: Pricing & Utilities (The Financial Engine)
  const [baseRent, setBaseRent] = useState(String(propertyToEdit?.standard_base_rent ?? ''))
  const [waterRate, setWaterRate] = useState(String(propertyToEdit?.standard_water_rate ?? 150))
  const [mgmtFee, setMgmtFee] = useState(String(propertyToEdit?.management_fee_percentage ?? 0.0))

  // Step 3: Contacts (Team Delegation)
  const [managerId, setManagerId] = useState(propertyToEdit?.manager_id || '')

  // Step 4: Configuration & Launch
  const [logoUrl, setLogoUrl] = useState(propertyToEdit?.logo_url || '')
  const [currency, setCurrency] = useState(propertyToEdit?.currency || 'KES')
  const [timezone, setTimezone] = useState(propertyToEdit?.timezone || 'Africa/Nairobi')
  const [requireSignatures, setRequireSignatures] = useState(
    propertyToEdit?.require_digital_lease_signatures ?? true
  )
  const [isDragOver, setIsDragOver] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  if (!isOpen) return null

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => {
      setToast(null)
    }, 4000)
  }

  const handleNext = () => {
    setStepError(null)

    if (currentStep === 1) {
      if (!name.trim()) {
        setStepError('Property asset name is required.')
        return
      }
      if (!location.trim()) {
        setStepError('Physical location / address is required.')
        return
      }
      const floorNum = parseInt(floors, 10)
      if (isNaN(floorNum) || floorNum < 1) {
        setStepError('Number of floors must be at least 1.')
        return
      }
      setCurrentStep(2)
    } else if (currentStep === 2) {
      if (baseRent && isNaN(parseFloat(baseRent))) {
        setStepError('Please enter a valid numeric value for standard base rent.')
        return
      }
      if (waterRate && isNaN(parseFloat(waterRate))) {
        setStepError('Please enter a valid numeric water billing rate.')
        return
      }
      setCurrentStep(3)
    } else if (currentStep === 3) {
      setCurrentStep(4)
    }
  }

  const handleBack = () => {
    setStepError(null)
    setCurrentStep((prev) => Math.max(1, prev - 1))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      // Simulate placeholder file reading for logo
      const fakeUrl = `https://storage.luffitech.com/logos/${encodeURIComponent(file.name)}`
      setLogoUrl(fakeUrl)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStepError(null)

    // Final validation
    if (!name.trim()) {
      setStepError('Property asset name is required.')
      setCurrentStep(1)
      return
    }
    if (!location.trim()) {
      setStepError('Physical location / address is required.')
      setCurrentStep(1)
      return
    }

    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('name', name.trim())
      formData.append('location', location.trim())
      formData.append('owner_mobile', ownerMobile.trim())
      formData.append('property_type', propertyType)
      formData.append('purpose', purpose)
      formData.append('floors', String(floors))
      formData.append('standard_base_rent', String(baseRent || '0'))
      formData.append('standard_water_rate', String(waterRate || '150'))
      formData.append('manager_id', managerId)
      formData.append('logo_url', logoUrl.trim())
      formData.append('currency', currency)
      formData.append('timezone', timezone)
      formData.append('require_digital_lease_signatures', String(requireSignatures))
      if (isOwner) {
        formData.append('management_fee_percentage', String(mgmtFee || '0'))
      }
      if (isEditing && propertyToEdit?.id) {
        formData.append('id', propertyToEdit.id)
      }

      const res = isEditing ? await updateProperty(formData) : await createProperty(formData)

      if (res.success) {
        showToast(
          isEditing
            ? `Property "${name}" updated successfully.`
            : `Property "${name}" activated successfully!`,
          'success'
        )

        // Smoothly close drawer / modal or reset card
        if (onClose) {
          setTimeout(() => {
            onClose()
          }, 1200)
        } else if (!isEditing) {
          setTimeout(() => {
            setName('')
            setLocation('')
            setOwnerMobile('')
            setBaseRent('')
            setLogoUrl('')
            setManagerId('')
            setCurrentStep(1)
          }, 1000)
        }
      } else {
        setStepError(res.error || 'Failed to save property. Please check inputs.')
        showToast(res.error || 'Failed to save property.', 'error')
      }
    } catch (err: any) {
      setStepError(err?.message || 'An unexpected error occurred.')
      showToast(err?.message || 'An unexpected error occurred.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const progressPercentage = (currentStep / 4) * 100

  const wizardContent = (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-slate-900 relative">
      {/* Toast Notification */}
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

      {/* Wizard Header */}
      <div className="flex justify-between items-start pb-4 border-b border-slate-100 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-900 text-white shadow-xs">
              Step {currentStep} of 4
            </span>
            <span className="text-xs text-slate-500 font-semibold">
              {WIZARD_STEPS[currentStep - 1].subtitle}
            </span>
          </div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            {isEditing ? 'Edit Property Site' : 'Enterprise Property Onboarding Wizard'}
          </h2>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg text-lg cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>

      {/* Visual Progress Bar */}
      <div className="space-y-2 mb-6">
        <div className="flex justify-between text-[11px] font-semibold text-slate-500">
          <span>{WIZARD_STEPS[currentStep - 1].title}</span>
          <span className="font-mono">{Math.round(progressPercentage)}%</span>
        </div>
        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div
            className="bg-emerald-500 h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* 4 Step Pills */}
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          {WIZARD_STEPS.map((s) => {
            const isCompleted = currentStep > s.id
            const isCurrent = currentStep === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  if (s.id < currentStep) {
                    setStepError(null)
                    setCurrentStep(s.id)
                  }
                }}
                className={`py-1 px-1.5 text-center rounded-lg text-[10px] font-bold truncate transition border ${
                  isCurrent
                    ? 'bg-slate-900 text-white border-slate-900'
                    : isCompleted
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 cursor-pointer'
                    : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                }`}
              >
                0{s.id}. {s.title}
              </button>
            )
          })}
        </div>
      </div>

      {/* Validation Error Banner */}
      {stepError && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{stepError}</span>
        </div>
      )}

      {/* The Unified Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {isEditing && <input type="hidden" name="id" value={propertyToEdit?.id} />}

        {/* Consolidated Hidden Inputs for complete multi-step payload */}
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="location" value={location} />
        <input type="hidden" name="owner_mobile" value={ownerMobile} />
        <input type="hidden" name="property_type" value={propertyType} />
        <input type="hidden" name="purpose" value={purpose} />
        <input type="hidden" name="floors" value={floors} />
        <input type="hidden" name="standard_base_rent" value={baseRent} />
        <input type="hidden" name="standard_water_rate" value={waterRate} />
        <input type="hidden" name="manager_id" value={managerId} />
        <input type="hidden" name="logo_url" value={logoUrl} />
        <input type="hidden" name="currency" value={currency} />
        <input type="hidden" name="timezone" value={timezone} />
        <input
          type="hidden"
          name="require_digital_lease_signatures"
          value={requireSignatures ? 'true' : 'false'}
        />
        {isOwner && (
          <input type="hidden" name="management_fee_percentage" value={mgmtFee} />
        )}

        {/* =================================================================== */}
        {/* STEP 1: DETAILS (THE IDENTITY) */}
        {/* =================================================================== */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="step1_name">
                Property Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="step1_name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kilimani Heights Residency"
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="step1_location">
                Physical Location / Address <span className="text-rose-500">*</span>
              </label>
              <input
                id="step1_location"
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Argwings Kodhek Rd, Kilimani, Nairobi"
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-slate-900"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">
                Physical address identifier for leases, invoices, and utility tracking.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="step1_mobile">
                  Owner Mobile Number
                </label>
                <input
                  id="step1_mobile"
                  type="tel"
                  value={ownerMobile}
                  onChange={(e) => setOwnerMobile(e.target.value)}
                  placeholder="e.g. +254 712 345 678"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="step1_floors">
                  Number of Floors
                </label>
                <input
                  id="step1_floors"
                  type="number"
                  min="1"
                  max="120"
                  value={floors}
                  onChange={(e) => setFloors(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="step1_type">
                  Property Type
                </label>
                <select
                  id="step1_type"
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-slate-900 cursor-pointer"
                >
                  <option value="Apartment">Apartment</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Single Family">Single Family</option>
                  <option value="Residential">Residential</option>
                  <option value="Industrial">Industrial</option>
                  <option value="Mixed Use">Mixed Use</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="step1_purpose">
                  Tenancy Purpose
                </label>
                <select
                  id="step1_purpose"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-slate-900 cursor-pointer"
                >
                  <option value="Rent">Rent</option>
                  <option value="Sale">Sale</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 2: PRICING & UTILITIES (THE FINANCIAL ENGINE) */}
        {/* =================================================================== */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="step2_rent">
                Standard Base Rent ({currency})
              </label>
              <div className="relative">
                <input
                  id="step2_rent"
                  type="number"
                  min="0"
                  step="100"
                  value={baseRent}
                  onChange={(e) => setBaseRent(e.target.value)}
                  placeholder="e.g. 45000"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-slate-900 font-bold"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">{currency} / mo</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Default monthly baseline rent applied to newly created units in this property.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="step2_water">
                Setup Recurring Utilities — Standard Water Rate ({currency} / m³)
              </label>
              <div className="relative">
                <input
                  id="step2_water"
                  type="number"
                  min="0"
                  step="5"
                  value={waterRate}
                  onChange={(e) => setWaterRate(e.target.value)}
                  placeholder="150.00"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-slate-900 font-bold"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">{currency} / unit</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Unit rate multiplied against monthly difference in water meter readings.
              </p>
            </div>

            {/* Management Fee - Owner only */}
            {isOwner && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700" htmlFor="step2_fee">
                    Agency Management Fee (%)
                  </label>
                  <span className="text-[10px] font-bold text-emerald-800 uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Owner Revenue
                  </span>
                </div>
                <div className="relative">
                  <input
                    id="step2_fee"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={mgmtFee}
                    onChange={(e) => setMgmtFee(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-slate-900 pr-8"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">%</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Agency commission retained from monthly rental collections.
                </p>
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 3: CONTACTS (TEAM DELEGATION) */}
        {/* =================================================================== */}
        {currentStep === 3 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700" htmlFor="step3_manager">
                  Designated Property Manager / Coordinator
                </label>
                <span className="text-[10px] text-slate-400 font-semibold">
                  From Public Profiles
                </span>
              </div>

              {isOwner ? (
                <>
                  <select
                    id="step3_manager"
                    value={managerId}
                    onChange={(e) => setManagerId(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 text-slate-900 cursor-pointer"
                  >
                    <option value="">-- Unassigned (Direct Agency Owner Oversight) --</option>
                    {propertyManagers?.map((pm) => (
                      <option key={pm.id} value={pm.id}>
                        {pm.first_name} {pm.last_name} ({pm.role || 'Staff'})
                      </option>
                    ))}
                  </select>

                  {/* Coordinator Preview Card */}
                  {managerId ? (
                    <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                          {managerMap.get(managerId)?.slice(0, 2).toUpperCase() || 'PM'}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-emerald-950 block">
                            {managerMap.get(managerId) || 'Assigned Coordinator'}
                          </span>
                          <span className="text-[10px] text-emerald-700">
                            Authorized for site visits & maintenance quotes under limit
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                        Delegated
                      </span>
                    </div>
                  ) : (
                    <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500">
                      ℹ️ When unassigned, all maintenance and lease requests for this property route directly to the Agency Owner.
                    </div>
                  )}

                  {(!propertyManagers || propertyManagers.length === 0) && (
                    <p className="text-[11px] text-slate-400 mt-2">
                      No property coordinators found.{' '}
                      <Link href="/dashboard/team" className="underline font-semibold text-slate-700">
                        Invite coordinators under Team Management
                      </Link>
                      .
                    </p>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700">
                  <p className="font-semibold">
                    {managerId ? managerMap.get(managerId) || 'Assigned' : 'Unassigned'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Only the Agency Owner can re-delegate property managers.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 4: CONFIGURATION & LAUNCH */}
        {/* =================================================================== */}
        {currentStep === 4 && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Optional Logo Upload Placeholder */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Property Brand Logo
                </label>
                <span className="text-[10px] font-semibold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">
                  Explicitly Optional
                </span>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragOver(true)
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-4 text-center transition ${
                  isDragOver
                    ? 'border-emerald-500 bg-emerald-50/50'
                    : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
                }`}
              >
                {logoUrl ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-mono text-slate-700 truncate max-w-xs">{logoUrl}</span>
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="text-xs text-rose-600 font-bold hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <svg className="w-7 h-7 text-slate-400 mx-auto mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-xs font-semibold text-slate-700">
                      Drag & drop logo file here or enter URL below
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      PNG, JPG, or SVG up to 2MB. Leave blank to skip.
                    </p>
                  </div>
                )}
              </div>

              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="Or paste direct image URL (optional)"
                className="mt-2 w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="step4_currency">
                  Operating Currency
                </label>
                <select
                  id="step4_currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 cursor-pointer"
                >
                  <option value="KES">KES (Kenyan Shilling)</option>
                  <option value="USD">USD (US Dollar)</option>
                  <option value="EUR">EUR (Euro)</option>
                  <option value="GBP">GBP (British Pound)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="step4_timezone">
                  Operational Timezone
                </label>
                <select
                  id="step4_timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 cursor-pointer"
                >
                  <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
                  <option value="UTC">UTC</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="America/New_York">America/New_York</option>
                </select>
              </div>
            </div>

            {/* Digital Lease Signatures Toggle */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Require Default Digital Lease Signatures
                </span>
                <span className="text-[10px] text-slate-500">
                  Tenants must legally execute lease agreements with cryptographic hash before unit keys are cleared.
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={requireSignatures}
                onClick={() => setRequireSignatures(!requireSignatures)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  requireSignatures ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    requireSignatures ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Launch Review Summary Box */}
            <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-1.5 text-xs text-emerald-950">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                Ready for Activation
              </span>
              <p className="font-semibold text-slate-900">
                {name || 'New Property Asset'} &bull; {propertyType} &bull; For {purpose}
              </p>
              <p className="text-[11px] text-slate-600">
                Location: {location || 'Address pending'} &bull; {floors} Floors &bull; Base Rent: {baseRent ? `${currency} ${Number(baseRent).toLocaleString()}` : 'Default'}
              </p>
            </div>
          </div>
        )}

        {/* Stepper Navigation Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-2 gap-3">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition"
            >
              &larr; Previous
            </button>
          ) : (
            <div />
          )}

          {currentStep < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs cursor-pointer transition flex items-center gap-1.5"
            >
              <span>Continue</span>
              <span>&rarr;</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-6 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition flex items-center gap-2 ${
                isSubmitting ? 'opacity-70 cursor-wait' : 'cursor-pointer'
              }`}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-1 h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>{isEditing ? 'Saving Changes...' : 'Activating Property...'}</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{isEditing ? 'Save Changes' : 'Activate Property'}</span>
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  )

  // Drawer / Modal presentation vs Card
  if (variant === 'modal' || variant === 'drawer') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
        <div className="max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
          {wizardContent}
        </div>
      </div>
    )
  }

  return wizardContent
}

