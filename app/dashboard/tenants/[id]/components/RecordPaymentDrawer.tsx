'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import SlideOverDrawer from '@/app/dashboard/components/SlideOverDrawer'
import { recordTenantManualPayment } from '../actions'

interface RecordPaymentDrawerProps {
  isOpen: boolean
  onClose: () => void
  tenantId: string
  tenantName: string
  unitNumber?: string
  propertyName?: string
}

export default function RecordPaymentDrawer({
  isOpen,
  onClose,
  tenantId,
  tenantName,
  unitNumber = 'N/A',
  propertyName = 'Property Site',
}: RecordPaymentDrawerProps) {
  const router = useRouter()

  const [amount, setAmount] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<string>('MPESA')
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [referenceCode, setReferenceCode] = useState<string>('')
  const [description, setDescription] = useState<string>('')

  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('Please enter a valid payment amount greater than zero.')
      return
    }

    startTransition(async () => {
      try {
        const res = await recordTenantManualPayment({
          tenantId,
          amount: parsedAmount,
          paymentMethod,
          transactionDate,
          referenceCode,
          description,
        })

        if (res.success) {
          setSuccessMessage('Payment successfully logged and reconciled to ledger!')
          setTimeout(() => {
            onClose()
            setSuccessMessage(null)
            setAmount('')
            setReferenceCode('')
            setDescription('')
            router.refresh()
          }, 1200)
        } else {
          setErrorMessage(res.error || 'Failed to record manual payment.')
        }
      } catch (err: any) {
        console.error('Error in record manual payment:', err)
        setErrorMessage(err?.message || 'Server error occurred.')
      }
    })
  }

  return (
    <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Record Manual Payment"
      subtitle={`Log a direct bank deposit, M-Pesa, or cash payment for ${tenantName}.`}
      maxWidth="max-w-lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !amount || parseFloat(amount) <= 0}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-2 shadow-sm disabled:cursor-not-allowed cursor-pointer"
          >
            {isPending ? (
              <>
                <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Recording Payment...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Confirm &amp; Post Payment</span>
              </>
            )}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-2.5">
            <svg className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-start gap-2.5">
            <svg className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{successMessage}</span>
          </div>
        )}

        {/* Premise Context Card */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs flex items-center justify-between">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Tenant &amp; Allocation</span>
            <span className="font-bold text-slate-900">{tenantName}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-400 block text-[10px] uppercase tracking-wider">Premises</span>
            <span className="font-semibold text-slate-800">Unit #{unitNumber} ({propertyName})</span>
          </div>
        </div>

        {/* Payment Amount */}
        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5" htmlFor="amount">
            Amount Paid (KES) <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">KES</span>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="1"
              placeholder="e.g. 35000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full pl-14 pr-4 py-2.5 text-sm font-semibold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
            />
          </div>
        </div>

        {/* Channel & Date Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5" htmlFor="paymentMethod">
              Payment Channel
            </label>
            <select
              id="paymentMethod"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full p-2.5 text-xs font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
            >
              <option value="MPESA">M-Pesa (Paybill / Till)</option>
              <option value="BANK_TRANSFER">Bank Deposit / EFT</option>
              <option value="CASH">Physical Cash</option>
              <option value="CHEQUE">Bankers Cheque</option>
              <option value="CARD">Debit / Credit Card</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5" htmlFor="transactionDate">
              Payment Date
            </label>
            <input
              id="transactionDate"
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              className="w-full p-2.5 text-xs font-medium bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
            />
          </div>
        </div>

        {/* External Reference Code */}
        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5" htmlFor="referenceCode">
            Reference / Receipt Code (Optional)
          </label>
          <input
            id="referenceCode"
            type="text"
            placeholder="e.g. QKD8391KLP or SLIP-9921"
            value={referenceCode}
            onChange={(e) => setReferenceCode(e.target.value)}
            className="w-full p-2.5 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
          />
          <p className="text-[10px] text-slate-400 mt-1">
            M-Pesa transaction ID, bank deposit confirmation number, or internal receipt reference.
          </p>
        </div>

        {/* Notes / Description */}
        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5" htmlFor="description">
            Notes / Memo
          </label>
          <input
            id="description"
            type="text"
            placeholder="e.g. Advance rent payment for November"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
          />
        </div>
      </form>
    </SlideOverDrawer>
  )
}

