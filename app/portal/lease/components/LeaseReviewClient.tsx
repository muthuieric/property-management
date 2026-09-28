'use client'

import { useState } from 'react'
import DigitalSignatureModal from './DigitalSignatureModal'

export interface LeaseAgreementDetails {
  id: string
  lease_status: 'pending_signature' | 'active' | 'expired' | 'terminated'
  signature_hash: string | null
  signed_by_ip: string | null
  signed_at: string | null
  start_date: string
  end_date: string | null
  deposit_amount: number
  deposit_months: number
  agency_id?: string | null
  units: {
    id: string
    unit_number: string
    base_rent: number
    properties: {
      id: string
      name: string
      location: string
      agency?: {
        name: string
      } | null
    } | null
  } | null
}

export interface TenantDetails {
  id: string
  fullName: string
  email: string
  phoneNumber: string
}

interface LeaseReviewClientProps {
  lease: LeaseAgreementDetails
  tenant: TenantDetails
  agencyName: string
}

export default function LeaseReviewClient({
  lease,
  tenant,
  agencyName,
}: LeaseReviewClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [signatureState, setSignatureState] = useState<{
    isSigned: boolean
    signatureHash: string | null
    signedAt: string | null
  }>({
    isSigned: lease.lease_status === 'active' || !!lease.signature_hash,
    signatureHash: lease.signature_hash,
    signedAt: lease.signed_at,
  })

  const unitNumber = lease.units?.unit_number || 'N/A'
  const propertyName = lease.units?.properties?.name || 'Property'
  const propertyLocation = lease.units?.properties?.location || 'Unspecified Location'
  const monthlyRent = Number(lease.units?.base_rent || 0)
  const securityDeposit = Number(lease.deposit_amount || 0)

  const handleSignedSuccess = (hash: string, signedAt: string) => {
    setSignatureState({
      isSigned: true,
      signatureHash: hash,
      signedAt,
    })
  }

  const handlePrint = () => {
    window.print()
  }

  const formattedStartDate = new Date(lease.start_date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const formattedEndDate = lease.end_date
    ? new Date(lease.end_date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Month-to-Month Periodic Tenancy'

  const formattedSignedDate = signatureState.signedAt
    ? new Date(signatureState.signedAt).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Recently Signed'

  const shortHash = signatureState.signatureHash
    ? `${signatureState.signatureHash.slice(0, 8)}...${signatureState.signatureHash.slice(-8)}`
    : 'N/A'

  return (
    <div className="relative pb-24">
      {/* 
        =======================================================================
        TOP STATUS BANNER / VERIFIED BADGE
        =======================================================================
      */}
      {signatureState.isSigned ? (
        <div className="mb-8 p-5 bg-emerald-50 border border-emerald-200 rounded-2xl shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Digitally Signed on {formattedSignedDate} (Hash: {shortHash})
                    Digitally Signed on {formattedSignedDate} &bull; Hash: {shortHash}
                  </span>
                  <span className="text-[11px] font-mono text-emerald-700 font-semibold">
                    Legally Executed &bull; Active Tenancy
                  </span>
                </div>
                <p className="text-xs text-emerald-900 mt-1">
                  This lease agreement has been cryptographically sealed by <strong>{tenant.fullName}</strong> and is legally enforceable under digital transaction standards.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                onClick={handlePrint}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-emerald-300 text-emerald-900 hover:bg-emerald-100/70 transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <svg className="w-4 h-4 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>Print / Save PDF</span>
              </button>
            </div>
          </div>

          {/* Cryptographic Audit Metadata Strip */}
          <div className="mt-4 pt-3 border-t border-emerald-200/80 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
            <div>
              <span className="text-emerald-700 block font-medium">Digital Signer:</span>
              <span className="font-semibold text-emerald-950">{tenant.fullName}</span>
            </div>
            <div>
              <span className="text-emerald-700 block font-medium">Audit Timestamp:</span>
              <span className="font-mono text-emerald-950">{signatureState.signedAt || 'Recorded'}</span>
            </div>
            <div>
              <span className="text-emerald-700 block font-medium">SHA-256 Audit Seal:</span>
              <span className="font-mono text-emerald-950 break-all select-all font-bold">
                {signatureState.signatureHash || 'Verified'}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-8 p-5 bg-amber-50 border border-amber-200 rounded-2xl shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    Signature Required
                  </span>
                  <span className="text-[11px] font-mono text-amber-800">
                    Status: Pending Digital Signature
                  </span>
                </div>
                <p className="text-xs text-amber-900 mt-1">
                  Please review the complete contractual covenants below. Click <strong>&quot;Review & Sign Agreement&quot;</strong> in the sticky bar at the bottom to bind this tenancy agreement.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-xs cursor-pointer flex items-center gap-2 self-end sm:self-center shrink-0"
            >
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span>Review &amp; Sign Lease</span>
            </button>
          </div>
        </div>
      )}

      {/* 
        =======================================================================
        DOCUMENT PAPER CONTAINER (LEGAL LEASE AGREEMENT)
        =======================================================================
      */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden print:border-none print:shadow-none">
        {/* CONTRACT DOCUMENT HEADER */}
        <div className="p-8 sm:p-12 border-b border-slate-200 bg-slate-50/50 text-center relative">
          <div className="max-w-2xl mx-auto space-y-2">
            <span className="text-[11px] font-mono font-bold tracking-widest text-slate-400 uppercase">
              Standard Residential Tenancy Agreement &bull; Kenya Civil Code
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 uppercase">
              Residential Tenancy Agreement
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Executed under the authority of {agencyName} for Unit #{unitNumber} at {propertyName}
            </p>
          </div>

          <div className="mt-6 flex items-center justify-center gap-3 text-xs text-slate-600 font-mono">
            <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg shadow-2xs">
              Contract Ref: {lease.id.slice(0, 13).toUpperCase()}
            </span>
            <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg shadow-2xs">
              Term: {formattedStartDate} &rarr; {formattedEndDate}
            </span>
          </div>
        </div>

        {/* CONTRACT BODY: CLAUSES & COVENANTS */}
        <div className="p-8 sm:p-12 space-y-8 text-slate-800 text-xs sm:text-sm leading-relaxed max-w-4xl mx-auto">
          {/* SECTION 1: PARTIES */}
          <section className="space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-mono">1</span>
              <span>Parties & Demised Premises</span>
            </h2>
            <p>
              This Tenancy Agreement (the &quot;Agreement&quot;) is made and entered into between:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                  The Landlord / Managing Agent:
                </span>
                <p className="font-bold text-slate-900">{agencyName}</p>
                <p className="text-slate-500 text-[11px]">Authorized Institutional Property Manager</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                  The Resident / Tenant:
                </span>
                <p className="font-bold text-slate-900">{tenant.fullName}</p>
                <p className="text-slate-500 text-[11px] font-mono">{tenant.email}</p>
                <p className="text-slate-500 text-[11px]">{tenant.phoneNumber}</p>
              </div>
            </div>
            <p>
              The Landlord hereby demises and lets unto the Tenant, and the Tenant takes from the Landlord, the premises designated as <strong>Unit #{unitNumber}</strong> situated at <strong>{propertyName}</strong>, {propertyLocation} (the &quot;Premises&quot;), for residential tenancy purposes only.
            </p>
          </section>

          {/* SECTION 2: TERM & RENTAL PAYMENT */}
          <section className="space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-mono">2</span>
              <span>Term, Rental Obligations & Due Dates</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                  Monthly Base Rent
                </span>
                <span className="font-bold text-slate-900 text-base tabular-nums">
                  KES {monthlyRent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <span className="block text-[10px] text-slate-400 mt-0.5">Excluding water/utilities</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                  Payment Due Date
                </span>
                <span className="font-semibold text-slate-800">1st Calendar Day of Month</span>
                <span className="block text-[10px] text-slate-400 mt-0.5">Grace period through 5th</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                  Commencement Date
                </span>
                <span className="font-semibold text-slate-800">{formattedStartDate}</span>
                <span className="block text-[10px] text-slate-400 mt-0.5">To {formattedEndDate}</span>
              </div>
            </div>
            <p>
              The Tenant covenants to pay the monthly rent clear of all deductions on or before the first day of each calendar month via the designated institutional payment channels (M-Pesa Paybill or Bank Transfer) integrated into the Luffi Tech Resident Portal.
            </p>
          </section>

          {/* SECTION 3: SEGREGATED SECURITY DEPOSIT IN ESCROW */}
          <section className="space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-mono">3</span>
              <span>Segregated Security Deposit & Escrow Custody</span>
            </h2>
            <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                    Security Deposit Held in Institutional Escrow
                  </span>
                  <span className="text-lg font-bold text-emerald-950 tabular-nums">
                    KES {securityDeposit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-200 text-emerald-900">
                  100% Segregated Trust
                </span>
              </div>
              <p className="text-[11px] text-emerald-900 leading-normal">
                The security deposit is strictly held in an institutional segregated escrow trust. Under our institutional deposit charter, arbitrary deductions are prohibited. Upon lawful move-out clearance, any deductions require authenticated contractor receipts, and the net balance is refunded electronically within statutory timelines.
              </p>
            </div>
          </section>

          {/* SECTION 4: TENANT COVENANTS & CARE OF PREMISES */}
          <section className="space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-mono">4</span>
              <span>Resident Covenants & Maintenance Protocols</span>
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-700">
              <li>
                <strong>Good Repair:</strong> To keep the interior of the Premises, including sanitary fittings, windows, doors, and appliances, in good clean condition ordinary wear and tear excepted.
              </li>
              <li>
                <strong>Maintenance Requests:</strong> To promptly notify management of any structural, plumbing, or electrical defects via the Luffi Tech Resident Maintenance Portal.
              </li>
              <li>
                <strong>Nuisance:</strong> Not to commit or permit any waste, noise, or breach of estate serenity that interferes with the peaceful enjoyment of adjoining residents.
              </li>
              <li>
                <strong>Subletting:</strong> Not to assign, underlet, or part with possession of the Premises or any part thereof without prior written consent of the Landlord.
              </li>
            </ul>
          </section>

          {/* SECTION 5: LEGAL EXECUTION & SIGNATURE CLAUSE */}
          <section className="space-y-4 pt-4 border-t border-slate-200">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-mono">5</span>
              <span>Electronic Execution & Legal Attestation</span>
            </h2>
            <p className="text-xs text-slate-600">
              IN WITNESS WHEREOF, the parties hereto have executed this Tenancy Agreement electronically. Under applicable digital transaction statutes, electronic signatures have the same legal validity, admissibility, and enforceability as handwritten ink signatures.
            </p>

            {/* SIGNATURE BLOCKS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
              {/* LANDLORD SIGNATURE */}
              <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Executed for Landlord / Agency
                </span>
                <div className="h-14 border-b border-slate-300 flex items-end pb-1 font-serif text-lg text-slate-800 italic">
                  {agencyName} Operations
                </div>
                <div className="text-[11px] text-slate-500 space-y-0.5">
                  <p className="font-semibold text-slate-800">{agencyName}</p>
                  <p>Authorized Property Custodian</p>
                  <p className="text-[10px] text-slate-400">System Verified &bull; Luffi Tech PMS</p>
                </div>
              </div>

              {/* TENANT SIGNATURE */}
              <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Executed by Resident / Tenant
                </span>
                {signatureState.isSigned ? (
                  <>
                    <div className="h-14 border-b border-emerald-400 flex items-end pb-1 font-serif text-xl text-emerald-950 italic">
                      {tenant.fullName}
                    </div>
                    <div className="text-[11px] text-emerald-800 space-y-0.5">
                      <p className="font-bold text-emerald-950 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>Verified Digital Signature</span>
                      </p>
                      <p className="font-mono text-[10px]">Signed: {formattedSignedDate}</p>
                      <p className="font-mono text-[10px] text-slate-500 break-all">
                        Hash: {signatureState.signatureHash}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-14 border-b border-dashed border-amber-400 flex items-center justify-center text-amber-700 italic text-xs">
                      [Signature Pending - Awaiting Tenant Execution]
                    </div>
                    <div className="text-[11px] text-slate-500 space-y-0.5">
                      <p className="font-semibold text-slate-800">{tenant.fullName}</p>
                      <p>Resident / Tenant</p>
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(true)}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
                      >
                        Sign Agreement Now &rarr;
                        Review &amp; Sign Lease &rarr;
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* 
        =======================================================================
        STICKY FOOTER: REVIEW & SIGN CALL TO ACTION (WHEN PENDING SIGNATURE)
        ACTION FOOTER:
        - IF PENDING: STICKY FOOTER WITH 'REVIEW & SIGN LEASE'
        - IF SIGNED: HIGH-VISIBILITY EMERALD GREEN VERIFIED BADGE
        =======================================================================
      */}
      {!signatureState.isSigned ? (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-xl px-4 py-3 sm:py-4 transition-all">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <span className="hidden sm:flex h-9 w-9 rounded-full bg-amber-100 text-amber-800 items-center justify-center shrink-0 font-bold">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </span>
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Action Required: Tenancy Agreement Pending Signature
                </p>
                <p className="text-[11px] text-slate-500">
                  Review the terms above for Unit #{unitNumber} and apply your legal digital signature to activate tenancy.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span>Review &amp; Sign Lease</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-8 p-5 bg-emerald-50 border-2 border-emerald-400 rounded-2xl shadow-sm">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="space-y-0.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-200 text-emerald-950 border border-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                  Digitally Signed on {formattedSignedDate} • Hash: {shortHash}
                </div>
                <p className="text-xs text-emerald-900 pt-1">
                  Full Hash: <span className="font-mono font-bold select-all text-emerald-950 break-all">{signatureState.signatureHash}</span>
                </p>
                <p className="text-[11px] text-emerald-800">
                  This tenancy agreement is active and legally binding under Electronic Records and Transactions regulations.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-white text-emerald-900 border border-emerald-300 hover:bg-emerald-100 rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-2 shrink-0"
            >
              <svg className="w-4 h-4 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Download Signed Copy</span>
            </button>
          </div>
        </div>
      )}

      {/* DIGITAL SIGNATURE MODAL */}
      <DigitalSignatureModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        leaseId={lease.id}
        tenantName={tenant.fullName}
        unitNumber={unitNumber}
        propertyName={propertyName}
        onSignedSuccess={handleSignedSuccess}
      />
    </div>
  )
}
