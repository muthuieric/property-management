'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  createUnitWithInventory,
  getCloudflareUploadUrl,
  InventoryItemPayload,
} from '@/app/dashboard/units/actions'

interface UnitWizardProps {
  propertyId: string
  propertyName: string
  isOpen: boolean
  onClose: () => void
}

const COMMON_AMENITIES = [
  'High-Speed WiFi',
  'Private Balcony',
  'Assigned Parking',
  'Borehole Water',
  'Backup Generator',
  'CCTV Surveillance',
  'Swimming Pool',
  'Gym Access',
  'Intercom Facility',
  'Solar Water Heating',
]

const QUICK_INVENTORY_PRESETS = [
  'House Keys (2 Sets)',
  'Window Curtains / Sheers',
  'Prepaid KPLC Token Meter',
  'Water Meter & Valve',
  'Water Heater / Geyser',
  'Kitchen Cabinets & Sink',
  'Bathroom Shower Head',
]

export default function UnitWizard({
  propertyId,
  propertyName,
  isOpen,
  onClose,
}: UnitWizardProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1)

  // Step 1: Details & Amenities
  const [unitNumber, setUnitNumber] = useState('')
  const [floorLevel, setFloorLevel] = useState('')
  const [isFurnished, setIsFurnished] = useState(false)
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([])

  // Step 2: Inventory Ledger
  const [inventory, setInventory] = useState<InventoryItemPayload[]>([
    { itemName: 'House Keys (2 Sets)', conditionAtMoveIn: 'New', estimatedValue: 2500 },
  ])

  // Step 3: Billing & Financials
  const [baseRent, setBaseRent] = useState<string>('')
  const [serviceCharge, setServiceCharge] = useState<string>('0')

  // Step 4: Visuals & Cloudflare Gallery
  const [galleryUrls, setGalleryUrls] = useState<string[]>([])
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [successToast, setSuccessToast] = useState<string | null>(null)

  if (!isOpen) return null

  // Amenity Toggle
  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(amenity) ? prev.filter((a) => a !== amenity) : [...prev, amenity]
    )
  }

  // Inventory Management
  const addInventoryRow = (name = '', condition: 'New' | 'Good' | 'Fair' | 'Damaged' = 'Good') => {
    setInventory((prev) => [
      ...prev,
      { itemName: name, conditionAtMoveIn: condition, estimatedValue: null },
    ])
  }

  const updateInventoryRow = (
    index: number,
    field: keyof InventoryItemPayload,
    value: string | number | null
  ) => {
    setInventory((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  const removeInventoryRow = (index: number) => {
    setInventory((prev) => prev.filter((_, i) => i !== index))
  }

  // Cloudflare Direct Image Upload
  const handleImageFile = async (file: File) => {
    setUploadError(null)
    setIsUploadingImage(true)

    try {
      // 1. Acquire secure one-time upload token from Server Action
      const tokenResult = await getCloudflareUploadUrl()

      if (!tokenResult.success || !tokenResult.uploadUrl) {
        setUploadError(tokenResult.error || 'Could not initiate Cloudflare upload.')
        setIsUploadingImage(false)
        return
      }

      // 2. Direct upload to Cloudflare via client
      if (tokenResult.simulated) {
        // In local development when Cloudflare credentials are unset:
        // Use object URL simulation so wizard testing proceeds without disruption
        const localPreview = URL.createObjectURL(file)
        setGalleryUrls((prev) => [...prev, localPreview])
      } else {
        const formData = new FormData()
        formData.append('file', file)

        const cfResponse = await fetch(tokenResult.uploadUrl, {
          method: 'POST',
          body: formData,
        })

        const cfData = await cfResponse.json()
        if (!cfResponse.ok || !cfData.success) {
          throw new Error(cfData.errors?.[0]?.message || 'Cloudflare upload rejected.')
        }

        // Cloudflare returns variants or image URL in result
        const publicUrl =
          cfData.result?.variants?.[0] ||
          `https://imagedelivery.net/cdn/${cfData.result?.id}/public`
        setGalleryUrls((prev) => [...prev, publicUrl])
      }
    } catch (err: unknown) {
      console.error('Cloudflare client upload error:', err)
      setUploadError(err instanceof Error ? err.message : 'Image upload failed.')
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      Array.from(e.dataTransfer.files).forEach((file) => {
        if (file.type.startsWith('image/')) {
          handleImageFile(file)
        }
      })
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach((file) => {
        handleImageFile(file)
      })
    }
  }

  const removeGalleryImage = (index: number) => {
    setGalleryUrls((prev) => prev.filter((_, i) => i !== index))
  }

  // Step Validation & Navigation
  const canProceedFromStep1 = unitNumber.trim().length > 0
  const canProceedFromStep3 = Number(baseRent) > 0

  const handleNext = () => {
    setFormError(null)
    if (currentStep === 1 && !canProceedFromStep1) {
      setFormError('Please enter a valid Unit Number / Label.')
      return
    }
    if (currentStep === 3 && !canProceedFromStep3) {
      setFormError('Please enter a valid Base Rent amount in KES.')
      return
    }
    if (currentStep < 4) {
      setCurrentStep((prev) => (prev + 1) as 1 | 2 | 3 | 4)
    }
  }

  const handleBack = () => {
    setFormError(null)
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4)
    }
  }

  // Final Form Submission
  const handleSubmit = async () => {
    setFormError(null)

    if (!unitNumber.trim()) {
      setFormError('Unit Number is required.')
      setCurrentStep(1)
      return
    }

    if (!baseRent || Number(baseRent) <= 0) {
      setFormError('A valid Base Rent amount is required.')
      setCurrentStep(3)
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        propertyId,
        unitNumber: unitNumber.trim(),
        floorLevel: floorLevel.trim() || null,
        isFurnished,
        amenities: selectedAmenities,
        baseRent: Number(baseRent),
        fixedServiceCharge: Number(serviceCharge) || 0,
        galleryUrls,
      }

      const result = await createUnitWithInventory(payload, inventory)

      if (!result.success) {
        setFormError(result.error || 'Failed to create unit.')
        setIsSubmitting(false)
        return
      }

      setSuccessToast(`Unit ${unitNumber} successfully created with asset inventory!`)
      router.refresh()

      setTimeout(() => {
        onClose()
      }, 1200)
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'An error occurred during creation.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-title"
      >
        {/* DRAWER HEADER */}
        <div className="p-6 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center justify-between pb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                +U
              </span>
              <div>
                <h2 id="wizard-title" className="text-lg font-bold text-slate-900 leading-tight">
                  Single Unit Onboarding Wizard
                </h2>
                <p className="text-xs text-slate-500">
                  {propertyName} &bull; Step {currentStep} of 4
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* VISUAL STEP PROGRESS BAR */}
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-2">
              {[
                { step: 1, title: 'Details' },
                { step: 2, title: 'Inventory' },
                { step: 3, title: 'Billing' },
                { step: 4, title: 'Gallery' },
              ].map((s) => (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setCurrentStep(s.step as 1 | 2 | 3 | 4)}
                  className={`py-1.5 px-2 rounded-lg text-left text-[11px] font-semibold border transition-all cursor-pointer ${
                    currentStep === s.step
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : currentStep > s.step
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                        currentStep === s.step
                          ? 'bg-white text-slate-900'
                          : currentStep > s.step
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {currentStep > s.step ? '✓' : s.step}
                    </span>
                    <span className="truncate">{s.title}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-300 ease-out"
                style={{ width: `${(currentStep / 4) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* DRAWER BODY (STEP FORMS) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-800 text-xs">
          {/* TOAST OR ERROR BANNER */}
          {successToast && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl flex items-center gap-2">
              <span className="text-emerald-600 font-bold">✓</span>
              <span>{successToast}</span>
            </div>
          )}

          {formError && (
            <div className="p-3.5 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl flex items-center gap-2">
              <span className="text-rose-600 font-bold">⚠️</span>
              <span>{formError}</span>
            </div>
          )}

          {/* ===================================================================
              STEP 1: DETAILS & AMENITIES
             =================================================================== */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">
                  Unit Identity &amp; Physical Specifications
                </h3>
                <p className="text-slate-500 text-[11px]">
                  Configure unit doors, architectural floor levels, and included resident amenities.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Unit Number / Label <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={unitNumber}
                    onChange={(e) => setUnitNumber(e.target.value)}
                    placeholder="e.g. A101, B4, PH-02"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Floor Level
                  </label>
                  <input
                    type="text"
                    value={floorLevel}
                    onChange={(e) => setFloorLevel(e.target.value)}
                    placeholder="e.g. Ground Floor, 1, 2, Penthouse"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* FURNISHED TOGGLE */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900 text-xs">Furnished Unit</p>
                  <p className="text-[11px] text-slate-500">
                    Does this unit come furnished with furniture and interior fittings?
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFurnished(!isFurnished)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isFurnished ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      isFurnished ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* AMENITIES PILLS */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Select Unit Amenities
                </label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_AMENITIES.map((amenity) => {
                    const isSelected = selectedAmenities.includes(amenity)
                    return (
                      <button
                        key={amenity}
                        type="button"
                        onClick={() => toggleAmenity(amenity)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-800 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}
                        {amenity}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================
              STEP 2: ASSET INVENTORY LEDGER (DISPUTE PROTECTION)
             =================================================================== */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900">
                <h4 className="font-bold text-xs flex items-center gap-1.5 text-blue-950">
                  <span>🛡️</span>
                  <span>Move-in Asset Inventory Ledger</span>
                </h4>
                <p className="text-[11px] text-blue-800 mt-0.5">
                  Protects agency escrow deposits. Pre-recording condition and replacement value eliminates security deposit disputes at tenant move-out.
                </p>
              </div>

              {/* QUICK ADD PRESETS */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Quick Add Standard Fixtures:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_INVENTORY_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => addInventoryRow(preset, 'New')}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-2 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* DYNAMIC ITEM ROWS */}
              <div className="space-y-3">
                {inventory.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 relative"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        Item #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeInventoryRow(idx)}
                        className="text-slate-400 hover:text-rose-600 text-xs font-bold cursor-pointer"
                        title="Remove item"
                      >
                        &times; Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-1">
                        <label className="block text-[10px] font-medium text-slate-600 mb-0.5">
                          Item / Fitting
                        </label>
                        <input
                          type="text"
                          value={item.itemName}
                          onChange={(e) => updateInventoryRow(idx, 'itemName', e.target.value)}
                          placeholder="e.g. Microwave"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-medium text-slate-600 mb-0.5">
                          Move-in Condition
                        </label>
                        <select
                          value={item.conditionAtMoveIn}
                          onChange={(e) =>
                            updateInventoryRow(
                              idx,
                              'conditionAtMoveIn',
                              e.target.value as 'New' | 'Good' | 'Fair' | 'Damaged'
                            )
                          }
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        >
                          <option value="New">New (Mint)</option>
                          <option value="Good">Good (Working)</option>
                          <option value="Fair">Fair (Minor Wear)</option>
                          <option value="Damaged">Damaged (Existing defect)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-medium text-slate-600 mb-0.5">
                          Est. Value (KES)
                        </label>
                        <input
                          type="number"
                          value={item.estimatedValue ?? ''}
                          onChange={(e) =>
                            updateInventoryRow(
                              idx,
                              'estimatedValue',
                              e.target.value ? Number(e.target.value) : null
                            )
                          }
                          placeholder="e.g. 15000"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => addInventoryRow()}
                  className="w-full py-2 border-2 border-dashed border-slate-300 hover:border-slate-400 text-slate-600 font-semibold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>+ Add Item to Ledger</span>
                </button>
              </div>
            </div>
          )}

          {/* ===================================================================
              STEP 3: BILLING & FINANCIALS
             =================================================================== */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">
                  Billing Configuration &amp; Recurring Charges
                </h3>
                <p className="text-slate-500 text-[11px]">
                  Establish base rent and recurring service fees for automated invoicing.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Standard Base Rent (KES) <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-semibold text-xs">
                      KES
                    </span>
                    <input
                      type="number"
                      value={baseRent}
                      onChange={(e) => setBaseRent(e.target.value)}
                      placeholder="e.g. 45000"
                      className="w-full pl-13 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Fixed Recurring Service Charge (KES)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-semibold text-xs">
                      KES
                    </span>
                    <input
                      type="number"
                      value={serviceCharge}
                      onChange={(e) => setServiceCharge(e.target.value)}
                      placeholder="e.g. 3500"
                      className="w-full pl-13 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Covers recurring amenities like garbage disposal, 24/7 security, and compound care.
                  </p>
                </div>

                {/* MONTHLY REVENUE CALCULATION BOX */}
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-800">
                      Total Monthly Billing per Unit:
                    </span>
                    <p className="text-xs text-emerald-700">Rent + Service Charge Combined</p>
                  </div>
                  <p className="text-lg font-bold text-emerald-950 font-mono">
                    KES {((Number(baseRent) || 0) + (Number(serviceCharge) || 0)).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ===================================================================
              STEP 4: VISUALS (CLOUDFLARE GALLERY)
             =================================================================== */}
          {currentStep === 4 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">
                  Cloudflare Images Photo Gallery
                </h3>
                <p className="text-slate-500 text-[11px]">
                  High-resolution photo hosting powered by Cloudflare CDN for fast tenant portal loading.
                </p>
              </div>

              {/* DROPZONE */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/20 rounded-2xl p-6 text-center cursor-pointer transition-all"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-xs font-bold text-slate-800">
                  {isUploadingImage ? 'Uploading to Cloudflare...' : 'Drop unit photos here or click to browse'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Direct upload via Cloudflare Images API (JPEG, PNG, WebP)
                </p>
              </div>

              {uploadError && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                  {uploadError}
                </div>
              )}

              {/* GALLERY PREVIEWS */}
              {galleryUrls.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Uploaded Gallery ({galleryUrls.length} photos)
                  </span>
                  <div className="grid grid-cols-3 gap-2.5">
                    {galleryUrls.map((url, idx) => (
                      <div
                        key={idx}
                        className="relative rounded-xl overflow-hidden border border-slate-200 aspect-video group bg-slate-100"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Unit ${unitNumber} Photo ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeGalleryImage(idx)}
                          className="absolute top-1.5 right-1.5 bg-slate-900/80 hover:bg-rose-600 text-white p-1 rounded-md text-[10px] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SUMMARY REVIEW CARD */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-[11px]">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Launch Summary
                </span>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div>
                    <span className="text-slate-400 block">Unit:</span>
                    <span className="font-bold text-slate-900">{unitNumber || 'Unspecified'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Floor:</span>
                    <span>{floorLevel || 'Ground'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Base Rent:</span>
                    <span className="font-mono font-bold text-emerald-800">
                      KES {Number(baseRent || 0).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Inventory Ledger:</span>
                    <span>{inventory.filter((i) => i.itemName.trim()).length} items recorded</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* DRAWER FOOTER */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 1 || isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            &larr; Back
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Cancel
            </button>

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>Next Step</span>
                <span>&rarr;</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Creating Unit &amp; Ledger...</span>
                  </>
                ) : (
                  <>
                    <span>✓ Complete &amp; Save Unit</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

