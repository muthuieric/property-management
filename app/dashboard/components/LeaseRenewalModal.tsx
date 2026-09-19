'use client'

import { useState } from 'react'

export interface LeaseRenewalItem {
  id: string
  start_date: string
  end_date: string
  deposit_amount: number
  units?: {
    id: string
    unit_number: string
    base_rent: number
    properties?: {
      id: string
      name: string
      location?: string
    }
  }
  tenants?: {
    id: string
    first_name: string
    last_name: string
    email?: string
    phone_number?: string
  }
}

interface LeaseRenewalModalProps {
  lease: LeaseRenewalItem
  agencyName?: string
}

export default function LeaseRenewalModal({
  lease,
  agencyName = 'Institutional Property Management',
}: LeaseRenewalModalProps) {
  const [isOpen, setIsOpen] = useState(false)

  const tenant = lease.tenants
  const tenantName = tenant
    ? `${tenant.first_name || ''} ${tenant.last_name || ''}`.trim() || 'Resident'
    : 'Resident'
  const propertyName = lease.units?.properties?.name || 'Residence'
  const propertyLocation = lease.units?.properties?.location || 'Nairobi'
  const unitNumber = lease.units?.unit_number || 'Unit'
  const currentRent = Number(lease.units?.base_rent || 0)

  // Proposed renewal terms
  const [proposedRent, setProposedRent] = useState<string>(String(currentRent))
  const [leasePrepFee, setLeasePrepFee] = useState<string>('5000')

  // Calculate new dates
  const expiryDate = lease.end_date ? new Date(lease.end_date) : new Date()
  const newStartDate = new Date(expiryDate)
  newStartDate.setDate(newStartDate.getDate() + 1)
  const newEndDate = new Date(newStartDate)
  newEndDate.setFullYear(newEndDate.getFullYear() + 1)

  const formattedExpiry = expiryDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const formattedNewStart = newStartDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const formattedNewEnd = newEndDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] px-2.5 py-1 rounded-lg shadow-xs cursor-pointer transition-all duration-150"
      >
        <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span>Renewal Letter</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 md:p-8 shadow-2xl border border-slate-200 space-y-6 my-8 max-h-[90vh] overflow-y-auto text-slate-900">
            {/* Modal Controls Bar (Hidden in Print) */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 print:hidden">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider bg-slate-900 text-white px-2.5 py-0.5 rounded-full">
                  Renewal Letter Generator
                </span>
                <span className="text-xs text-slate-500">
                  {propertyName} &bull; Unit #{unitNumber}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  <span>Print Letter / Save PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-2 rounded-lg"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Config controls for coordinator before printing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 print:hidden text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Proposed Monthly Rent (KES)
                </label>
                <input
                  type="number"
                  value={proposedRent}
                  onChange={(e) => setProposedRent(e.target.value)}
                  className="w-full rounded-lg px-3 py-1.5 border border-slate-200 font-bold tabular-nums text-slate-900 bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Lease Preparation & Agreement Fee (KES)
                </label>
                <input
                  type="number"
                  value={leasePrepFee}
                  onChange={(e) => setLeasePrepFee(e.target.value)}
                  className="w-full rounded-lg px-3 py-1.5 border border-slate-200 font-bold tabular-nums text-slate-900 bg-white"
                />
              </div>
            </div>

            {/* FORMAL PRINTABLE LETTER CONTENT */}
            <div className="border border-slate-200 p-8 md:p-12 rounded-2xl bg-white space-y-6 text-slate-800 text-xs md:text-sm leading-relaxed shadow-xs">
              {/* Agency Letterhead */}
              <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-extrabold uppercase tracking-tight text-slate-900">
                    {agencyName}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Property Management & Residential Tenancy Operations &bull; {propertyLocation}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500 font-mono">
                  <p>Ref: LRN-{unitNumber}-{new Date().getFullYear()}</p>
                  <p>Date: {todayFormatted}</p>
                </div>
              </div>

              {/* Addressee */}
              <div className="space-y-1">
                <p className="font-bold text-slate-900 text-sm">{tenantName}</p>
                <p className="text-slate-600">Tenant / Occupant &bull; Unit #{unitNumber}</p>
                <p className="text-slate-600">{propertyName}, {propertyLocation}</p>
              </div>

              {/* Subject Line */}
              <div className="py-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
                  RE: OFFER OF TENANCY AGREEMENT RENEWAL & LEASE TERM EXTENSION
                </h3>
              </div>

              {/* Letter Paragraphs */}
              <p>
                Dear <span className="font-bold">{tenantName}</span>,
              </p>

              <p>
                We hope this notice finds you well. As you are aware, your current residential tenancy agreement for{' '}
                <strong className="text-slate-900">Unit #{unitNumber}</strong> at{' '}
                <strong className="text-slate-900">{propertyName}</strong> is scheduled to expire on{' '}
                <strong className="text-slate-900">{formattedExpiry}</strong>.
              </p>

              <p>
                On behalf of the Landlord and Property Management, we are pleased to formally offer you a renewal of your Tenancy Agreement for a further term of{' '}
                <strong className="text-slate-900">One (1) Year</strong>, effective from{' '}
                <strong className="text-slate-900">{formattedNewStart}</strong> through{' '}
                <strong className="text-slate-900">{formattedNewEnd}</strong>.
              </p>

              {/* Terms Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden my-4">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 uppercase font-bold text-slate-600">
                    <tr>
                      <th className="p-3">Tenancy Item</th>
                      <th className="p-3 text-right">Agreed Terms</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-3 font-semibold">Commencement & Term</td>
                      <td className="p-3 text-right font-medium text-slate-900">
                        {formattedNewStart} to {formattedNewEnd} (12 Months)
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold">Contracted Monthly Rent</td>
                      <td className="p-3 text-right font-bold text-slate-900 tabular-nums">
                        KES {Number(proposedRent).toLocaleString('en-US', { minimumFractionDigits: 2 })} / Month
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold">Security Deposit in Escrow</td>
                      <td className="p-3 text-right font-medium text-emerald-700 tabular-nums">
                        KES {Number(lease.deposit_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} (Retained in Trust)
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold">Lease Agreement Documentation Fee</td>
                      <td className="p-3 text-right font-bold text-slate-900 tabular-nums">
                        KES {Number(leasePrepFee).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p>
                To confirm your acceptance of this renewal offer, kindly sign the acceptance slip below and return a copy along with proof of payment for the lease preparation fee to the Property Coordinator within{' '}
                <strong>fourteen (14) days</strong> of receipt.
              </p>

              <p>
                We value your residency with us and look forward to continuing our cordial landlord-tenant relationship.
              </p>

              {/* Sign-off Blocks */}
              <div className="pt-8 grid grid-cols-2 gap-8 border-t border-slate-200 text-xs">
                <div className="space-y-4">
                  <p className="font-bold text-slate-900">FOR AND ON BEHALF OF MANAGEMENT:</p>
                  <div className="h-12 border-b border-slate-400"></div>
                  <p className="font-semibold text-slate-800">Property Coordinator / Manager</p>
                  <p className="text-slate-500">{agencyName}</p>
                </div>

                <div className="space-y-4">
                  <p className="font-bold text-slate-900">TENANT ACCEPTANCE & SIGN-OFF:</p>
                  <div className="h-12 border-b border-slate-400"></div>
                  <p className="font-semibold text-slate-800">{tenantName}</p>
                  <p className="text-slate-500">Date: ________________________</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

