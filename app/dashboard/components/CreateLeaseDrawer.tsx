'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SlideOverDrawer from './SlideOverDrawer'
import { createLease } from '@/app/dashboard/leases/actions'

export interface UnitOption {
  id: string
  unit_number: string
  base_rent: number
  property_name?: string
  bedrooms?: number | null
  bathrooms?: number | null
}

export interface TenantOption {
  id: string
  first_name: string
  last_name: string
  email?: string
  phone_number?: string
}

interface CreateLeaseDrawerProps {
  isOpen: boolean
  onClose: () => void
  selectedUnit?: UnitOption | null
  selectedTenant?: TenantOption | null
  tenants?: TenantOption[]
  vacantUnits?: UnitOption[]
  onSuccess?: () => void
}

export default function CreateLeaseDrawer({
  isOpen,
  onClose,
  selectedUnit = null,
  selectedTenant = null,
  tenants = [],
  vacantUnits = [],
  onSuccess,
}: CreateLeaseDrawerProps) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Reactive form state
  const [chosenUnitId, setChosenUnitId] = useState<string>('')
  const [chosenTenantId, setChosenTenantId] = useState<string>('')
  const [baseRent, setBaseRent] = useState<string | number>('')
  const [depositAmount, setDepositAmount] = useState<string | number>('')
  const [depositMultiplier, setDepositMultiplier] = useState<'1x' | '2x' | 'custom'>('2x')

  // Compute default dates (Today and 1 Year from today)
  const today = new Date().toISOString().split('T')[0]
  const oneYearLater = new Date()
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1)
  const defaultEndDate = oneYearLater.toISOString().split('T')[0]

  // Synchronize state when drawer opens or initial selections change
  useEffect(() => {
    if (!isOpen) return

    setErrorMessage(null)

    let initialRent: number | string = ''
    if (selectedUnit) {
      setChosenUnitId(selectedUnit.id)
      initialRent = selectedUnit.base_rent || ''
    } else if (vacantUnits.length > 0) {
      const firstUnit = vacantUnits[0]
      setChosenUnitId(firstUnit.id)
      initialRent = firstUnit.base_rent || ''
    } else {
      setChosenUnitId('')
    }

    setBaseRent(initialRent)
    const rentNum = parseFloat(String(initialRent))
    if (!isNaN(rentNum) && rentNum > 0) {
      // Default to 2 months deposit for high-end residential trust
      setDepositAmount(depositMultiplier === '2x' ? rentNum * 2 : depositMultiplier === '1x' ? rentNum : rentNum)
    } else {
      setDepositAmount('')
    }

    if (selectedTenant) {
      setChosenTenantId(selectedTenant.id)
    } else if (tenants.length > 0) {
      setChosenTenantId(tenants[0].id)
    } else {
      setChosenTenantId('')
    }
  }, [isOpen, selectedUnit, selectedTenant, vacantUnits, tenants])

  // Handle changing unit in dropdown (updates baseRent and depositAmount)
  const handleUnitChange = (unitId: string) => {
    setChosenUnitId(unitId)
    const unit = vacantUnits.find((u) => u.id === unitId)
    if (unit) {
      const rentNum = unit.base_rent || 0
      setBaseRent(rentNum)
      if (depositMultiplier === '2x') {
        setDepositAmount(rentNum * 2)
      } else if (depositMultiplier === '1x') {
        setDepositAmount(rentNum)
      } else {
        setDepositAmount(rentNum)
      }
    }
  }

  const applyDepositMultiplier = (multiplier: '1x' | '2x' | 'custom') => {
    setDepositMultiplier(multiplier)
    const rentNum = parseFloat(String(baseRent))
    if (!isNaN(rentNum) && rentNum > 0) {
      if (multiplier === '1x') {
        setDepositAmount(rentNum)
      } else if (multiplier === '2x') {
        setDepositAmount(rentNum * 2)
      }
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage(null)

    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await createLease(formData)
      if (result.success) {
        formRef.current?.reset()
        onSuccess?.()
        onClose()
        router.refresh()
      } else {
        setErrorMessage(result.error || 'Failed to activate lease agreement.')
      }
    })
  }

  // Active target unit & tenant (either locked or chosen)
  const activeUnit = selectedUnit || vacantUnits.find((u) => u.id === chosenUnitId)
  const activeTenant = selectedTenant || tenants.find((t) => t.id === chosenTenantId)

  return (
    <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Generate Lease Agreement"
      subtitle="Institutional tenancy allocation with contracted rent and segregated deposit escrow."
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl cursor-pointer transition-all duration-200 ease-in-out"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-lease-form"
            disabled={isPending}
            className="bg-slate-900 hover:bg-slate-800 hover:shadow-md text-white font-semibold text-xs py-2.5 px-6 rounded-xl cursor-pointer transition-all duration-200 ease-in-out shadow-xs disabled:opacity-50 flex items-center gap-2"
          >
            {isPending ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Activating Lease...</span>
              </>
            ) : (
              <span>Activate Lease</span>
            )}
          </button>
        </>
      }
    >
      <form id="create-lease-form" ref={formRef} onSubmit={handleSubmit} className="space-y-6">
        {errorMessage && (
          <div className="p-3.5 rounded-xl text-xs font-medium bg-rose-50 border border-rose-200 text-rose-700">
            {errorMessage}
          </div>
        )}

        {/* SECTION 1: UNIT ALLOCATION */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Unit Allocation
            </h3>
            {selectedUnit ? (
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                Locked to Current Unit
              </span>
            ) : (
              <span className="text-[11px] text-slate-500">
                {vacantUnits.length} Vacant Units Available
              </span>
            )}
          </div>

          {selectedUnit ? (
            /* Locked Unit Read-Only Card */
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <input type="hidden" name="unit_id" value={selectedUnit.id} />
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">
                      Unit {selectedUnit.unit_number}
                    </span>
                    <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full font-semibold">
                      Vacant Inventory
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedUnit.property_name || 'Property Site'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Inventory Base Rent
                  </span>
                  <span className="text-xs font-bold text-slate-900 tabular-nums">
                    KES {Number(selectedUnit.base_rent || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Vacant Unit Dropdown */
            <div>
              {vacantUnits.length === 0 ? (
                <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs">
                  No vacant units currently available for lease assignment.
                </div>
              ) : (
                <>
                  <select
                    id="drawer_unit_id"
                    name="unit_id"
                    required
                    value={chosenUnitId}
                    onChange={(e) => handleUnitChange(e.target.value)}
                    className="w-full rounded-xl px-3.5 py-2.5 text-xs bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition font-medium text-slate-900"
                  >
                    {vacantUnits.map((u) => (
                      <option key={u.id} value={u.id}>
                        Unit {u.unit_number} {u.property_name ? `(${u.property_name})` : ''} &bull; KES {Number(u.base_rent || 0).toLocaleString()} /mo
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Selecting a unit automatically populates standard base rent and escrow deposit terms.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* SECTION 2: TENANT OCCUPANT */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Resident Occupant
            </h3>
            {selectedTenant ? (
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                Locked to Profile
              </span>
            ) : (
              <span className="text-[11px] text-slate-500">
                {tenants.length} Registered Tenants
              </span>
            )}
          </div>

          {selectedTenant ? (
            /* Locked Tenant Read-Only Card */
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <input type="hidden" name="tenant_id" value={selectedTenant.id} />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900 text-sm">
                    {selectedTenant.first_name} {selectedTenant.last_name}
                  </p>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {selectedTenant.email || 'No email provided'}
                  </p>
                </div>
                {selectedTenant.phone_number && (
                  <span className="text-xs text-slate-600 font-medium">
                    {selectedTenant.phone_number}
                  </span>
                )}
              </div>
            </div>
          ) : (
            /* Tenant Select Dropdown */
            <div>
              {tenants.length === 0 ? (
                <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs">
                  No active tenants registered. Please register a tenant first in the Tenant Directory.
                </div>
              ) : (
                <>
                  <select
                    id="drawer_tenant_id"
                    name="tenant_id"
                    required
                    value={chosenTenantId}
                    onChange={(e) => setChosenTenantId(e.target.value)}
                    className="w-full rounded-xl px-3.5 py-2.5 text-xs bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition font-medium text-slate-900"
                  >
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.first_name} {t.last_name} {t.email ? `(${t.email})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Select an active tenant record to link to this occupancy agreement.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* SECTION 3: LEASE TERM DATES */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2">
            Tenancy Period
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="drawer_start_date">
                Lease Start Date <span className="text-rose-500">*</span>
              </label>
              <input
                id="drawer_start_date"
                type="date"
                name="start_date"
                required
                defaultValue={today}
                className="w-full rounded-xl px-3.5 py-2.5 text-xs bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition font-medium text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="drawer_end_date">
                Lease End Date <span className="text-slate-400 font-normal">(1-Yr Term)</span>
              </label>
              <input
                id="drawer_end_date"
                type="date"
                name="end_date"
                defaultValue={defaultEndDate}
                className="w-full rounded-xl px-3.5 py-2.5 text-xs bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition font-medium text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: FINANCIAL & ESCROW TERMS */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Financial & Custody Ledger Terms
            </h3>
            <span className="text-[11px] text-emerald-800 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              Trust Escrow Protected
            </span>
          </div>

          {/* High-End Deposit Multiplier Selector */}
          <div className="mb-3.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
              Escrow Multiplier Tier
            </span>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => applyDepositMultiplier('2x')}
                className={`py-1.5 px-2 rounded-lg font-semibold text-center transition-all cursor-pointer ${
                  depositMultiplier === '2x'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                2 Months (High-End)
              </button>
              <button
                type="button"
                onClick={() => applyDepositMultiplier('1x')}
                className={`py-1.5 px-2 rounded-lg font-semibold text-center transition-all cursor-pointer ${
                  depositMultiplier === '1x'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                1 Month (Standard)
              </button>
              <button
                type="button"
                onClick={() => setDepositMultiplier('custom')}
                className={`py-1.5 px-2 rounded-lg font-semibold text-center transition-all cursor-pointer ${
                  depositMultiplier === 'custom'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Custom Amount
              </button>
            </div>
            <input
              type="hidden"
              name="deposit_months"
              value={depositMultiplier === '2x' ? 2 : depositMultiplier === '1x' ? 1 : 0}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="drawer_base_rent">
                Contracted Monthly Rent (KES) <span className="text-rose-500">*</span>
              </label>
              <div className="relative rounded-xl">
                <input
                  id="drawer_base_rent"
                  type="number"
                  step="any"
                  name="base_rent"
                  required
                  placeholder="e.g. 100000"
                  value={baseRent}
                  onChange={(e) => {
                    setBaseRent(e.target.value)
                    const rentNum = parseFloat(e.target.value)
                    if (!isNaN(rentNum) && rentNum > 0) {
                      if (depositMultiplier === '2x') setDepositAmount(rentNum * 2)
                      else if (depositMultiplier === '1x') setDepositAmount(rentNum)
                    }
                  }}
                  className="w-full rounded-xl px-3.5 py-2.5 text-xs bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition font-bold text-slate-900 tabular-nums text-right"
                />
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                Billed on the 1st of each calendar month.
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700" htmlFor="drawer_deposit_amount">
                  Security Deposit in Escrow (KES) <span className="text-rose-500">*</span>
                </label>
                {depositMultiplier === '2x' && (
                  <span className="text-[10px] font-bold text-emerald-800">2x Month Tier</span>
                )}
              </div>
              <div className="relative rounded-xl">
                <input
                  id="drawer_deposit_amount"
                  type="number"
                  step="any"
                  name="deposit_amount"
                  required
                  placeholder="e.g. 200000"
                  value={depositAmount}
                  onChange={(e) => {
                    setDepositAmount(e.target.value)
                    setDepositMultiplier('custom')
                  }}
                  className="w-full rounded-xl px-3.5 py-2.5 text-xs bg-white border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition font-bold text-slate-900 tabular-nums text-right"
                />
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                Held in segregated trust custody.
              </span>
            </div>
          </div>

          {/* Institutional Trust Escrow Notice */}
          <div className="mt-4 p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-xl text-xs text-slate-600 flex items-start gap-2.5">
            <svg className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <div>
              <span className="font-semibold text-emerald-800 block text-[11px]">
                Institutional Trust Escrow Guarantee (Fully Refundable)
              </span>
              <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                Upon activation, this unit is registered as occupied and the security deposit is entered into the agency&apos;s protected escrow ledger. Arbitrary deductions are blocked and funds are fully refundable upon turnover clearance.
              </p>
            </div>
          </div>
        </div>
      </form>
    </SlideOverDrawer>
  )
}
