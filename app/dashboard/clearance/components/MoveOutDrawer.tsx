'use client'

import { useState, useEffect, useMemo } from 'react'
import SlideOverDrawer from '@/app/dashboard/components/SlideOverDrawer'

export interface ActiveLeaseClearanceItem {
  id: string
  start_date: string
  end_date: string
  deposit_amount: number
  is_active: boolean
  tenant_id: string
  unit_id: string
  units?: {
    id: string
    unit_number: string
    base_rent: number
    property_id: string
    properties?: {
      id: string
      name: string
    }
  }
  tenants?: {
    id: string
    first_name: string
    last_name: string
    email?: string
    phone?: string
  }
  unpaidDues: number
}

export interface UnitTicketItem {
  id: string
  unit_id: string
  issue_description: string
  cost: number | null
  status: string
  created_at: string
}

interface MoveOutDrawerProps {
  isOpen: boolean
  onClose: () => void
  lease: ActiveLeaseClearanceItem | null
  unitTickets: UnitTicketItem[]
  action: (formData: FormData) => Promise<void> | void
}

export default function MoveOutDrawer({
  isOpen,
  onClose,
  lease,
  unitTickets,
  action,
}: MoveOutDrawerProps) {
  const [repairCostInput, setRepairCostInput] = useState<string>('0')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // Reset inputs when a different lease is opened
  useEffect(() => {
    if (isOpen) {
      setRepairCostInput('0')
      setIsSubmitting(false)
    }
  }, [isOpen, lease?.id])

  const tenant = lease?.tenants
  const tenantName = tenant
    ? `${tenant.first_name || ''} ${tenant.last_name || ''}`.trim() || 'Tenant'
    : 'Tenant'
  const propertyName = lease?.units?.properties?.name || 'Property'
  const unitNumber = lease?.units?.unit_number || 'Unit'

  const deposit = Number(lease?.deposit_amount || 0)
  const unpaidDues = Number(lease?.unpaidDues || 0)
  const numRepairCost = useMemo(() => {
    const parsed = parseFloat(repairCostInput)
    return isNaN(parsed) || parsed < 0 ? 0 : parsed
  }, [repairCostInput])

  // Live Calculated Refund: Deposit - Unpaid Dues - Repair Costs
  const finalRefund = deposit - unpaidDues - numRepairCost
  const isPositiveRefund = finalRefund >= 0

  // Matching tickets for this unit
  const matchingTickets = useMemo(() => {
    if (!lease?.unit_id) return []
    return unitTickets.filter((t) => t.unit_id === lease.unit_id)
  }, [unitTickets, lease?.unit_id])

  if (!lease) return null

  const drawerFooter = (
    <div className="flex items-center justify-between w-full">
      <button
        type="button"
        onClick={onClose}
        disabled={isSubmitting}
        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl cursor-pointer transition-all duration-200 ease-in-out disabled:opacity-50"
      >
        Cancel
      </button>

      <button
        type="submit"
        form={`moveout-form-${lease.id}`}
        disabled={isSubmitting}
        className="bg-slate-900 hover:bg-slate-800 hover:shadow-md text-white font-bold text-xs py-2.5 px-6 rounded-xl cursor-pointer transition-all duration-200 ease-in-out shadow-xs disabled:opacity-50 flex items-center gap-2"
      >
        {isSubmitting ? (
          <>
            <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Processing Clearance...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Finalize Move-Out & Clearance</span>
          </>
        )}
      </button>
    </div>
  )

  return (
    <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Initiate Move-Out & Clearance"
      subtitle={`${tenantName} • ${propertyName} (Unit #${unitNumber})`}
      footer={drawerFooter}
      maxWidth="max-w-xl"
    >
      <div className="space-y-6">
        {/* ESCROW & SETTLEMENT STAT CARDS */}
        <div className="grid grid-cols-3 gap-2.5 text-xs">
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
              Held Deposit
            </span>
            <p className="text-sm font-bold text-slate-900 tabular-nums">
              KES {deposit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Escrow locked</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 block mb-1">
              Unpaid Dues
            </span>
            <p className="text-sm font-bold text-amber-700 tabular-nums">
              KES {unpaidDues.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <span className="text-[10px] text-amber-600 mt-0.5 block">Rent & utility arrears</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
              Pre-Repair Net
            </span>
            <p
              className={`text-sm font-bold tabular-nums ${
                deposit - unpaidDues >= 0 ? 'text-slate-900' : 'text-rose-700'
              }`}
            >
              KES {(deposit - unpaidDues).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Before deductions</span>
          </div>
        </div>

        {/* LIVE SETTLEMENT RECONCILIATION CARD */}
        <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="font-semibold text-slate-200">Settlement Statement Preview</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isPositiveRefund
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}
            >
              {isPositiveRefund ? 'Refund Due to Tenant' : 'Balance Due to Agency'}
            </span>
          </div>

          <div className="space-y-1.5 text-xs text-slate-300 border-y border-slate-800 py-2.5">
            <div className="flex justify-between items-center">
              <span>Security Deposit in Escrow</span>
              <span className="font-bold tabular-nums text-slate-100">
                + KES {deposit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center text-amber-400">
              <span>Less Outstanding Arrears & Bills</span>
              <span className="font-bold tabular-nums">
                - KES {unpaidDues.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center text-rose-400">
              <span>Less Final Contractor Turnover Deductions</span>
              <span className="font-bold tabular-nums">
                - KES {numRepairCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <div>
              <span className="text-xs font-semibold text-slate-300 block">
                {isPositiveRefund ? 'Final Calculated Refund' : 'Final Balance Payable by Tenant'}
              </span>
              <span className="text-[10px] text-slate-400">
                {isPositiveRefund
                  ? 'Will be released upon agency approval'
                  : 'Requires debt recovery invoice'}
              </span>
            </div>
            <span
              className={`text-2xl font-bold tabular-nums tracking-tight ${
                isPositiveRefund ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              KES {Math.abs(finalRefund).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* MOVE-OUT SUBMISSION FORM */}
        <form
          id={`moveout-form-${lease.id}`}
          action={action}
          onSubmit={() => setIsSubmitting(true)}
          className="space-y-4"
        >
          <input type="hidden" name="lease_id" value={lease.id} />
          <input type="hidden" name="unit_id" value={lease.unit_id} />
          <input type="hidden" name="tenant_id" value={lease.tenant_id} />
          <input
            type="hidden"
            name="property_id"
            value={lease.units?.properties?.id || lease.units?.property_id || ''}
          />

          {/* Repair Cost Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="repair_cost"
                className="text-xs font-semibold text-slate-900"
              >
                Final Contractor Repair Costs (KES)
              </label>
              <span className="text-[10px] text-slate-400">Live calculation updates above</span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-xs font-semibold text-slate-400">
                KES
              </span>
              <input
                id="repair_cost"
                type="number"
                name="repair_cost"
                step="0.01"
                min="0"
                value={repairCostInput}
                onChange={(e) => setRepairCostInput(e.target.value)}
                placeholder="0.00"
                className="w-full text-right text-sm font-bold tabular-nums rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-slate-900 focus:outline-none focus:border-slate-900 transition"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1 leading-normal">
              Enter verified contractor repair invoices (e.g., painting, lock replacement, fixture restoration).
            </p>
          </div>

          {/* Invoice Reference # */}
          <div>
            <label
              htmlFor="invoice_ref"
              className="block text-xs font-semibold text-slate-900 mb-1"
            >
              Invoice Reference # / Work Order ID (Audit Verification)
            </label>
            <input
              id="invoice_ref"
              type="text"
              name="invoice_ref"
              placeholder="e.g. INV-2026-0042 or WO-8910"
              className="w-full text-xs font-mono rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-slate-900 focus:outline-none focus:border-slate-900 transition"
            />
            <p className="text-[11px] text-slate-500 mt-1 leading-normal">
              Directly links this deduction to verified contractor work orders for tenant transparency.
            </p>
          </div>

          {/* Ticket linkage */}
          {matchingTickets.length > 0 && (
            <div>
              <label
                htmlFor="ticket_id"
                className="block text-xs font-semibold text-slate-900 mb-1"
              >
                Link to Open Maintenance Ticket (Optional)
              </label>
              <select
                id="ticket_id"
                name="ticket_id"
                className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-800 focus:ring-2 focus:ring-slate-900 focus:outline-none focus:border-slate-900 transition cursor-pointer"
              >
                <option value="">-- Create Standalone Move-Out Inspection Record --</option>
                {matchingTickets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.issue_description} ({new Date(t.created_at).toLocaleDateString()}) - KES{' '}
                    {Number(t.cost || 0).toLocaleString()}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                Selecting an active ticket will resolve it and record the final turnover expense.
              </p>
            </div>
          )}

          {/* Repair Description & Notes */}
          <div>
            <label
              htmlFor="repair_description"
              className="block text-xs font-semibold text-slate-900 mb-1"
            >
              Repair Description & Turnover Notes
            </label>
            <textarea
              id="repair_description"
              name="repair_description"
              rows={3}
              placeholder="Describe turnover repairs, unit condition upon checkout, and contractor handover details..."
              className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-slate-900 focus:outline-none focus:border-slate-900 transition leading-relaxed"
            />
          </div>

          {/* Institutional Compliance Notice */}
          <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
            <svg className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              Submitting clearance deactivates this lease, marks the unit as vacant, generates a dated clearance record, and publishes the settlement statement to the tenant portal.
            </span>
          </div>
        </form>
      </div>
    </SlideOverDrawer>
  )
}
