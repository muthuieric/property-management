'use client'

import { useState, useTransition } from 'react'
import { endLease } from '../actions'

interface ReleaseDepositButtonProps {
  leaseId: string
  unitId: string
  tenantName: string
  unitNumber: string
  propertyName: string
  depositAmount: number
}

export default function ReleaseDepositButton({
  leaseId,
  unitId,
  tenantName,
  unitNumber,
  propertyName,
  depositAmount,
}: ReleaseDepositButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleConfirm = () => {
    const formData = new FormData()
    formData.append('lease_id', leaseId)
    formData.append('unit_id', unitId)

    startTransition(async () => {
      await endLease(formData)
      setIsOpen(false)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 cursor-pointer transition-all duration-200 ease-in-out font-medium text-xs px-3 py-1.5 rounded-lg shadow-xs"
      >
        <span>Release Deposit</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-slate-900">
              <div className="p-2.5 bg-slate-100 rounded-xl">
                <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Release Escrow Deposit
                </h3>
                <p className="text-xs text-slate-500">
                  Institutional Deposit Custody Settlement
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to release the security deposit of{' '}
              <strong className="text-slate-900 font-bold tabular-nums">
                KES {depositAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>{' '}
              held for <strong className="text-slate-900">{tenantName}</strong> at{' '}
              <strong className="text-slate-900">{propertyName} (Unit {unitNumber})</strong>?
            </p>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-normal">
              <strong>Notice:</strong> This action will close the active lease, refund the trust account, and mark Unit {unitNumber} as vacant for immediate turnover or re-leasing.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-all duration-200 ease-in-out"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 hover:shadow-md text-white rounded-lg cursor-pointer transition-all duration-200 ease-in-out flex items-center gap-1.5"
              >
                {isPending ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Releasing...</span>
                  </>
                ) : (
                  <span>Confirm Release</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

