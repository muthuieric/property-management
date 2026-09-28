'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SlideOverDrawer from '@/app/dashboard/components/SlideOverDrawer'
import {
  createTenantWithLease,
  getVacantUnits,
  VacantUnitItem,
  CreateTenantWithLeasePayload,
} from '../actions'

interface TenantWizardProps {
  isOpen: boolean
  onClose: () => void
  initialVacantUnits?: VacantUnitItem[]
}

const STEPS = [
  { id: 1, name: 'Profile Details', desc: 'Identity & Contact' },
  { id: 2, name: 'Unit Allocation', desc: 'Unit & Lease Term' },
  { id: 3, name: 'Additional KYC', desc: 'Emergency & Kin' },
]

export default function TenantWizard({
  isOpen,
  onClose,
  initialVacantUnits = [],
}: TenantWizardProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Vacant units state
  const [vacantUnits, setVacantUnits] = useState<VacantUnitItem[]>(initialVacantUnits)
  const [isLoadingUnits, setIsLoadingUnits] = useState(false)

  // Step 1 Form state
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [email, setEmail] = useState('')
  const [idNumber, setIdNumber] = useState('')

  // Step 2 Form state
  const [unitId, setUnitId] = useState('')
  const [leaseStartDate, setLeaseStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [leaseEndDate, setLeaseEndDate] = useState('')
  const [depositAmount, setDepositAmount] = useState<string>('')

  // Step 3 Form state
  const [vehicleRegistration, setVehicleRegistration] = useState('')
  const [nextOfKinName, setNextOfKinName] = useState('')
  const [nextOfKinPhone, setNextOfKinPhone] = useState('')
  const [nextOfKinRelation, setNextOfKinRelation] = useState('Spouse')

  // Reset or load data when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1)
      setErrorMessage(null)
      setSuccessMessage(null)

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

  // When a unit is selected in Step 2, pre-fill suggested deposit from base_rent
  const handleUnitChange = (selectedId: string) => {
    setUnitId(selectedId)
    const selected = vacantUnits.find((u) => u.id === selectedId)
    if (selected && !depositAmount) {
      setDepositAmount(String(selected.base_rent))
    }
  }

  // Step 1 Validation
  const validateStep1 = () => {
    if (!fullName.trim()) {
      setErrorMessage('Full name is required.')
      return false
    }
    if (!phoneNumber.trim()) {
      setErrorMessage('Phone number is required.')
      return false
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('A valid email address is required.')
      return false
    }
    setErrorMessage(null)
    return true
  }

  // Step 2 Validation
  const validateStep2 = () => {
    if (!unitId) {
      setErrorMessage('Please select an available unit for allocation.')
      return false
    }
    if (!leaseStartDate) {
      setErrorMessage('Lease commencement date is required.')
      return false
    }
    setErrorMessage(null)
    return true
  }

  const handleNext = () => {
    if (currentStep === 1) {
      if (validateStep1()) setCurrentStep(2)
    } else if (currentStep === 2) {
      if (validateStep2()) setCurrentStep(3)
    }
  }

  const handleBack = () => {
    setErrorMessage(null)
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1)
    }
  }

  const handleSubmit = () => {
    setErrorMessage(null)
    if (!validateStep1() || !validateStep2()) {
      return
    }

    const payload: CreateTenantWithLeasePayload = {
      fullName: fullName.trim(),
      phoneNumber: phoneNumber.trim(),
      email: email.trim(),
      idNumber: idNumber.trim() || undefined,
      unitId,
      leaseStartDate,
      leaseEndDate: leaseEndDate || undefined,
      depositAmount: depositAmount ? parseFloat(depositAmount) : undefined,
      vehicleRegistration: vehicleRegistration.trim() || undefined,
      nextOfKinName: nextOfKinName.trim() || undefined,
      nextOfKinPhone: nextOfKinPhone.trim() || undefined,
      nextOfKinRelation: nextOfKinRelation.trim() || undefined,
    }

    startTransition(async () => {
      try {
        const res = await createTenantWithLease(payload)
        if (res.success) {
          setSuccessMessage('Tenant onboarded and active lease created successfully!')
          setTimeout(() => {
            onClose()
            router.refresh()
          }, 1000)
        } else {
          setErrorMessage(res.error || 'Failed to complete tenant onboarding.')
        }
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error ? err.message : 'An unexpected error occurred during onboarding.'
        )
      }
    })
  }

  const selectedUnit = vacantUnits.find((u) => u.id === unitId)

  return (
    <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="3-Step Tenant Onboarding Wizard"
      subtitle="Frictionless KYC registration, lease provisioning, and unit allocation."
      maxWidth="max-w-xl"
      footer={
        <div className="flex items-center justify-between w-full">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              disabled={isPending}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              &larr; Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}

          <div className="flex items-center gap-2">
            {currentStep < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={isPending}
                className="px-5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-sm transition-all flex items-center gap-1.5"
              >
                <span>Continue</span>
                <span>&rarr;</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending}
                className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <svg
                      className="animate-spin h-3.5 w-3.5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    <span>Finalizing Onboarding...</span>
                  </>
                ) : (
                  <>
                    <span>Complete Onboarding &amp; Lease</span>
                    <span>&check;</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Progress Step Bar */}
        <div className="border-b border-slate-100 pb-5">
          <div className="flex items-center justify-between relative">
            <div className="absolute top-4 left-0 w-full h-0.5 bg-slate-100 -z-0" />
            <div
              className="absolute top-4 left-0 h-0.5 bg-slate-900 transition-all duration-300 -z-0"
              style={{
                width: currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : '100%',
              }}
            />
            {STEPS.map((step) => {
              const isCompleted = currentStep > step.id
              const isCurrent = currentStep === step.id
              return (
                <div key={step.id} className="relative z-10 flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      isCompleted
                        ? 'bg-slate-900 text-white'
                        : isCurrent
                        ? 'bg-emerald-600 text-white ring-4 ring-emerald-50'
                        : 'bg-white border-2 border-slate-200 text-slate-400'
                    }`}
                  >
                    {isCompleted ? '✓' : step.id}
                  </div>
                  <span
                    className={`text-[11px] font-semibold mt-1.5 ${
                      isCurrent
                        ? 'text-slate-900 font-bold'
                        : isCompleted
                        ? 'text-slate-700'
                        : 'text-slate-400'
                    }`}
                  >
                    {step.name}
                  </span>
                  <span className="text-[10px] text-slate-400 hidden sm:block">
                    {step.desc}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Error / Success Feedback */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
            <span className="font-bold text-red-500">!</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
            <span className="font-bold text-emerald-600">&check;</span>
            <span>{successMessage}</span>
          </div>
        )}

        {/* Step 1: Profile Details */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-in fade-in">
            <div className="border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">Step 1: Tenant Identity</h3>
              <p className="text-xs text-slate-500">
                Provide the primary contact information and legal ID of the resident.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Grace Wanjiku Kariuki"
                className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g. 0712345678 or +254 7..."
                  className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. grace.wanjiku@gmail.com"
                  className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                National ID / Passport Number
              </label>
              <input
                type="text"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                placeholder="e.g. 29384712 or A0192837"
                className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Required for compliance under Kenya Tenancy Laws.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Unit Allocation & Lease Terms */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-in fade-in">
            <div className="border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">Step 2: Unit Allocation</h3>
              <p className="text-xs text-slate-500">
                Select an unoccupied unit and establish initial lease terms.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Allocate Vacant Unit <span className="text-red-500">*</span>
              </label>
              {isLoadingUnits ? (
                <div className="text-xs text-slate-400 py-2">Loading available units...</div>
              ) : vacantUnits.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  No vacant units found. All units in your agency are currently occupied or none
                  have been created yet.
                </div>
              ) : (
                <select
                  value={unitId}
                  onChange={(e) => handleUnitChange(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                  required
                >
                  <option value="">-- Choose Unit to Assign --</option>
                  {vacantUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.property_name} &bull; Unit {u.unit_number} (KES{' '}
                      {u.base_rent.toLocaleString()}/mo)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {selectedUnit && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800">Selected:</span> Unit{' '}
                  {selectedUnit.unit_number} ({selectedUnit.property_name})
                </div>
                <div className="font-bold text-slate-900">
                  KES {selectedUnit.base_rent.toLocaleString()}/month
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lease Commencement <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={leaseStartDate}
                  onChange={(e) => setLeaseStartDate(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lease End Date (Optional)
                </label>
                <input
                  type="date"
                  value={leaseEndDate}
                  onChange={(e) => setLeaseEndDate(e.target.value)}
                  className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Security Deposit Held (KES)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="e.g. 35000"
                className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Typically equals one month of contracted rent.
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Additional KYC & Emergency Contacts */}
        {currentStep === 3 && (
          <div className="space-y-4 animate-in fade-in">
            <div className="border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">Step 3: Emergency &amp; KYC Details</h3>
              <p className="text-xs text-slate-500">
                Gate access records, vehicle security, and verified next-of-kin.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Vehicle Registration Number (Optional)
              </label>
              <input
                type="text"
                value={vehicleRegistration}
                onChange={(e) => setVehicleRegistration(e.target.value.toUpperCase())}
                placeholder="e.g. KDA 123X"
                className="w-full text-xs px-3 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all uppercase"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Will be synchronized to Karibu VMS for automated barrier clearance.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Next of Kin / Emergency Contact
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
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

            {/* Summary Review Card */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
              <div className="font-semibold text-slate-800 mb-1">Allocation Summary</div>
              <div className="flex justify-between text-slate-600">
                <span>Resident:</span>
                <span className="font-medium text-slate-900">{fullName || '—'}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Unit:</span>
                <span className="font-medium text-slate-900">
                  {selectedUnit ? `Unit ${selectedUnit.unit_number} (${selectedUnit.property_name})` : '—'}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Start Date:</span>
                <span className="font-medium text-slate-900">{leaseStartDate || '—'}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Security Deposit:</span>
                <span className="font-medium text-slate-900">
                  KES {depositAmount ? Number(depositAmount).toLocaleString() : '0'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </SlideOverDrawer>
  )
}

