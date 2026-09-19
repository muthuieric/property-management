'use client'

import { useState, useTransition } from 'react'
import { settleDepositRefund } from '../actions'

interface ReleaseDepositButtonProps {
  leaseId: string
  unitId: string
  tenantName: string
  unitNumber: string
  propertyName: string
  depositAmount: number
  tenantId?: string
  propertyId?: string
  tenantPhone?: string
  unpaidDues?: number
}

export default function ReleaseDepositButton({
  leaseId,
  unitId,
  tenantName,
  unitNumber,
  propertyName,
  depositAmount,
  tenantId = '',
  propertyId = '',
  tenantPhone = '',
  unpaidDues = 0,
}: ReleaseDepositButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Settlement Form State
  const [rentArrears, setRentArrears] = useState<string>(String(unpaidDues || 0))
  const [waterArrears, setWaterArrears] = useState<string>('0')
  const [repairDeduction, setRepairDeduction] = useState<string>('0')
  const [payoutMethod, setPayoutMethod] = useState<'mpesa' | 'bank_transfer' | 'cheque'>('mpesa')
  const [payoutRef, setPayoutRef] = useState<string>('')
  const [payoutDate, setPayoutDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [recipientName, setRecipientName] = useState<string>(tenantName)
  const [recipientPhone, setRecipientPhone] = useState<string>(tenantPhone)
  const [settlementNotes, setSettlementNotes] = useState<string>('')

  // Calculations
  const numStartingDeposit = Number(depositAmount) || 0
  const numRentArrears = parseFloat(rentArrears) || 0
  const numWaterArrears = parseFloat(waterArrears) || 0
  const numRepairs = parseFloat(repairDeduction) || 0
  const totalDeductions = numRentArrears + numWaterArrears + numRepairs
  const netRefund = numStartingDeposit - totalDeductions
  const isPositiveRefund = netRefund >= 0

  const handleOpen = () => {
    setErrorMsg(null)
    setRentArrears(String(unpaidDues || 0))
    setWaterArrears('0')
    setRepairDeduction('0')
    setPayoutRef('')
    setRecipientName(tenantName)
    setRecipientPhone(tenantPhone)
    setIsOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (isPositiveRefund && !payoutRef.trim()) {
      setErrorMsg('Please enter an M-Pesa confirmation code or Bank transfer reference to record auditable disbursement.')
      return
    }

    const formData = new FormData()
    formData.append('lease_id', leaseId)
    formData.append('unit_id', unitId)
    formData.append('tenant_id', tenantId)
    formData.append('property_id', propertyId)
    formData.append('starting_deposit', String(numStartingDeposit))
    formData.append('rent_arrears_deduction', String(numRentArrears))
    formData.append('water_arrears_deduction', String(numWaterArrears))
    formData.append('repairs_deduction', String(numRepairs))
    formData.append('payout_method', payoutMethod)
    formData.append('payout_reference', payoutRef.trim() || `CLR-SETTLED-${Date.now().toString().slice(-6)}`)
    formData.append('payout_date', payoutDate)
    formData.append('recipient_name', recipientName.trim())
    formData.append('recipient_phone_or_account', recipientPhone.trim())
    formData.append('notes', settlementNotes.trim())

    startTransition(async () => {
      const result = await settleDepositRefund(formData)
      if (result.success) {
        setIsOpen(false)
      } else {
        setErrorMsg(result.error || 'Failed to complete deposit disbursement settlement.')
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white cursor-pointer transition-all duration-200 ease-in-out font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-xs"
      >
        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <span>Disburse & Settle</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-8 max-h-[90vh] overflow-y-auto text-slate-900">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Deposit Escrow Disbursement Voucher
                  </h3>
                  <p className="text-xs text-slate-500">
                    {propertyName} &bull; Unit #{unitNumber} &bull; {tenantName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-100 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            {/* Reconciliation Card */}
            <div className="bg-slate-900 text-white rounded-xl p-4 shadow-xs space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300">Escrow Collateral Held</span>
                <span className="font-bold tabular-nums text-white text-sm">
                  + KES {numStartingDeposit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-rose-300">
                <span>Total Itemized Deductions</span>
                <span className="font-bold tabular-nums">
                  - KES {totalDeductions.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                    {isPositiveRefund ? 'Net Refund Payable to Tenant' : 'Net Balance Due from Tenant'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {isPositiveRefund ? 'Funds disbursed via electronic transfer' : 'Requires debt recovery invoice'}
                  </span>
                </div>
                <span
                  className={`text-2xl font-extrabold tabular-nums tracking-tight ${
                    isPositiveRefund ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  KES {Math.abs(netRefund).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Itemized Deductions Inputs */}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-900 block mb-2">
                  Itemized Deductions & Offsets
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Rent Arrears (KES)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={rentArrears}
                      onChange={(e) => setRentArrears(e.target.value)}
                      className="w-full rounded-xl px-3 py-2 border border-slate-200 text-right font-bold tabular-nums text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Water / Utility Dues (KES)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={waterArrears}
                      onChange={(e) => setWaterArrears(e.target.value)}
                      className="w-full rounded-xl px-3 py-2 border border-slate-200 text-right font-bold tabular-nums text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Turnover Repairs (KES)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={repairDeduction}
                      onChange={(e) => setRepairDeduction(e.target.value)}
                      className="w-full rounded-xl px-3 py-2 border border-slate-200 text-right font-bold tabular-nums text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Disbursement Payout Details */}
              {isPositiveRefund && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-900 block">
                    Electronic Disbursement Proof
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Payout Channel
                      </label>
                      <select
                        value={payoutMethod}
                        onChange={(e) => setPayoutMethod(e.target.value as any)}
                        className="w-full rounded-xl px-3 py-2 border border-slate-200 bg-white font-semibold text-slate-900 cursor-pointer"
                      >
                        <option value="mpesa">M-Pesa Electronic Transfer</option>
                        <option value="bank_transfer">Bank Wire / RTGS / EFT</option>
                        <option value="cheque">Bankers Cheque</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        {payoutMethod === 'mpesa' ? 'M-Pesa Tx Code' : 'Bank Reference / Cheque #'} <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={payoutMethod === 'mpesa' ? 'e.g. QGH7839JK' : 'e.g. FT2609090123'}
                        value={payoutRef}
                        onChange={(e) => setPayoutRef(e.target.value.toUpperCase())}
                        className="w-full rounded-xl px-3 py-2 border border-slate-200 bg-white font-mono font-bold text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Recipient Name
                      </label>
                      <input
                        type="text"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        className="w-full rounded-xl px-3 py-2 border border-slate-200 bg-white text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Recipient Mobile / Bank Account
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 0712 345 678 or Acc #12345678"
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value)}
                        className="w-full rounded-xl px-3 py-2 border border-slate-200 bg-white text-slate-900 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Disbursement Date
                    </label>
                    <input
                      type="date"
                      value={payoutDate}
                      onChange={(e) => setPayoutDate(e.target.value)}
                      className="w-full rounded-xl px-3 py-2 border border-slate-200 bg-white text-slate-900"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Settlement & Handover Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={settlementNotes}
                  onChange={(e) => setSettlementNotes(e.target.value)}
                  placeholder="e.g. Keys handed over to caretaker, water meter read, apartment repainted."
                  className="w-full rounded-xl px-3 py-2 border border-slate-200 bg-white text-slate-900"
                />
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={isPending}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs flex items-center gap-2"
                >
                  {isPending ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Disbursing & Finalizing...</span>
                    </>
                  ) : (
                    <>
                      <span>Authorize Payout & Close Lease</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
