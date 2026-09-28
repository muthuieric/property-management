'use client'

import { useState, useRef } from 'react'
import { signLeaseAgreement } from '@/app/portal/leases/actions'

export interface DigitalSignatureModalProps {
  isOpen: boolean
  onClose: () => void
  leaseId: string
  tenantName?: string
  unitNumber?: string
  propertyName?: string
  onSignedSuccess: (signatureHash: string, signedAt: string) => void
}

export default function DigitalSignatureModal({
  isOpen,
  onClose,
  leaseId,
  tenantName = '',
  unitNumber = '',
  propertyName = '',
  onSignedSuccess,
}: DigitalSignatureModalProps) {
  const [tab, setTab] = useState<'type' | 'draw'>('type')
  const [typedName, setTypedName] = useState(tenantName)
  const [agreed, setAgreed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Canvas drawing state
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    ctx.beginPath()
    ctx.moveTo(clientX - rect.left, clientY - rect.top)
    setIsDrawing(true)
    setHasDrawn(true)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0f172a' // slate-900

    ctx.lineTo(clientX - rect.left, clientY - rect.top)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const handleSign = async () => {
    setErrorMessage(null)

    if (!agreed) {
      setErrorMessage('You must review and check the agreement box before submitting.')
      return
    }

    if (tab === 'type' && !typedName.trim()) {
      setErrorMessage('Please type your legal full name as it appears on official identification.')
      return
    }

    if (tab === 'draw' && !hasDrawn) {
      setErrorMessage('Please draw your signature on the pad provided.')
      return
    }

    let signatureImage: string | undefined
    if (tab === 'draw' && canvasRef.current) {
      signatureImage = canvasRef.current.toDataURL('image/png')
    }

    setIsSubmitting(true)

    try {
      const legalNameInput = typedName.trim() || tenantName

      // Execute server action passing either string or payload
      const result = await signLeaseAgreement(leaseId, {
        fullName: legalNameInput,
        signatureType: tab === 'type' ? 'typed' : 'drawn',
        signatureImage,
        agreedToTerms: agreed,
      })

      if (!result.success) {
        setErrorMessage(result.error || 'Failed to digitally sign lease agreement. Please try again.')
        setIsSubmitting(false)
        return
      }

      const generatedHash = result.hash || result.signatureHash || ''
      const timestamp = result.signedAt || new Date().toISOString()

      onSignedSuccess(generatedHash, timestamp)
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'A network error occurred while executing signature.'
      setErrorMessage(msg)
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  const isFormValid =
    agreed && (tab === 'type' ? typedName.trim().length > 1 : hasDrawn)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signature-modal-title"
      >
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <div>
              <h2 id="signature-modal-title" className="text-base font-bold text-slate-900 leading-tight">
                Digital Tenancy Agreement Signature
              </h2>
              <p className="text-xs text-slate-500">
                {unitNumber ? `Unit #${unitNumber}` : 'Premises'} {propertyName ? `• ${propertyName}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Close signature modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-800 text-xs leading-relaxed">
          {/* Legal Notice */}
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-[11px] text-amber-950">
              <svg className="w-3.5 h-3.5 text-amber-700 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>Legally Binding Electronic Agreement</span>
            </div>
            <p className="text-[11px] text-amber-800">
              Under Electronic Records and Transactions regulations, your typed or electronic signature carries the identical legal enforceability and binding authority as a physical ink signature.
            </p>
          </div>

          {/* SIGNATURE METHOD TABS */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Signature Method
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setTab('type')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  tab === 'type'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Type Legal Name
              </button>
              <button
                type="button"
                onClick={() => setTab('draw')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  tab === 'draw'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Draw Signature
              </button>
            </div>
          </div>

          {/* TAB 1: TYPE LEGAL NAME */}
          {tab === 'type' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Full Legal Name (Electronic Signature)
                </label>
                <input
                  type="text"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder="e.g. John Doe Kamau"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
              </div>

              {typedName.trim() && (
                <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Signature Preview
                  </span>
                  <p className="font-serif italic text-2xl text-slate-900 tracking-wide select-none">
                    {typedName}
                  </p>
                  <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                    Digitally generated cryptographic seal representation
                  </span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DRAW SIGNATURE */}
          {tab === 'draw' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Draw signature inside box using mouse or touch
                </label>
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold cursor-pointer underline"
                >
                  Clear Drawing
                </button>
              </div>

              <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 overflow-hidden relative">
                <canvas
                  ref={canvasRef}
                  width={460}
                  height={140}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-36 touch-none cursor-crosshair bg-white"
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-300 font-serif italic text-lg select-none">
                    Sign Here &times;
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AUDIT METADATA DISCLOSURE */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <div className="flex items-center justify-between text-slate-700 font-medium">
              <span>Security Standard:</span>
              <span className="font-mono text-emerald-700 font-bold">SHA-256 Cryptographic Hash</span>
            </div>
            <div className="flex items-center justify-between text-slate-500">
              <span>Current Session Time:</span>
              <span className="font-mono">{new Date().toLocaleString()}</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Your IP address, browser signature, and precise UTC timestamp will be cryptographically bound to this tenancy agreement.
            </p>
          </div>

          {/* MANDATORY LEGAL CONSENT TEXT & CHECKBOX */}
          <div className="pt-1">
            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/70 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="text-[11px] text-slate-800 leading-snug">
                <strong>Mandatory Legal Consent:</strong> By typing my name and clicking &apos;I Agree&apos;, I am electronically signing this tenancy agreement and agree to be legally bound by all terms, covenants, and deposit escrow conditions set forth herein.
              </span>
            </label>
          </div>

          {/* ERROR ALERT */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-center gap-2">
              <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSign}
            disabled={!isFormValid || isSubmitting}
            className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Binding Agreement...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>I Agree &amp; Sign Lease</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

