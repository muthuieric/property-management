import React from 'react'
import Link from 'next/link'
import { verifyReceipt } from '@/app/dashboard/financials/actions'

export const dynamic = 'force-dynamic'

interface VerifyPageProps {
  params: Promise<{ receipt_id: string }>
}

export default async function VerifyReceiptPage({ params }: VerifyPageProps) {
  const { receipt_id } = await params

  const result = await verifyReceipt(receipt_id)

  const verificationTimestamp = new Date().toUTCString()

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between p-4 sm:p-8">
      {/* Top Brand Header */}
      <header className="max-w-xl mx-auto w-full pt-4 pb-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white font-black text-base flex items-center justify-center shadow-sm">
            LT
          </div>
          <div>
            <span className="font-bold text-slate-900 text-sm tracking-tight block">
              Luffi Tech
            </span>
            <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider block">
              Ledger Verification
            </span>
          </div>
        </Link>

        <span className="text-[11px] font-mono text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-full shadow-xs">
          Public Auditor Gateway
        </span>
      </header>

      {/* Main Verification Card */}
      <main className="max-w-xl mx-auto w-full flex-1 flex items-center justify-center my-4">
        {result.isValid ? (
          /* =========================================================
             VALID RECEIPT: GREEN VERIFICATION
             ========================================================= */
          <div className="w-full bg-white border border-emerald-200 rounded-3xl shadow-xl p-8 sm:p-10 relative overflow-hidden transition-all">
            {/* Top Green Accent Bar */}
            <div className="absolute top-0 left-0 right-0 h-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />

            {/* Verification Badge */}
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-300 text-emerald-600 flex items-center justify-center shadow-inner">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>

              <div>
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-widest bg-emerald-100/70 border border-emerald-300 px-3 py-1 rounded-full">
                  Official Verification Status
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-3">
                  Verified Authentic Luffi Tech Receipt
                </h1>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Cryptographically verified on the institutional ledger. This electronic payment is legitimate and reconciled.
                </p>
              </div>
            </div>

            {/* Payment Summary Highlight Box */}
            <div className="my-6 p-5 bg-slate-50 border border-slate-200 rounded-2xl text-center">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Amount Paid
              </span>
              <div className="text-3xl sm:text-4xl font-black text-emerald-700 tracking-tight mt-1 tabular-nums">
                KES {Number(result.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-slate-600 font-medium mt-1">
                Settled on {result.transaction_date ? new Date(result.transaction_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Verified Date'}
              </p>
            </div>

            {/* Verified Attributes Grid */}
            <div className="space-y-3 text-xs border-y border-slate-100 py-5">
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Receipt Reference:</span>
                <span className="font-mono text-slate-800 font-bold break-all text-right">
                  {result.receipt_id}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Authorized Agency:</span>
                <span className="font-semibold text-slate-900 text-right">
                  {result.agency_name}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Premises / Property:</span>
                <span className="font-medium text-slate-800 text-right">
                  {result.property_name} {result.unit_number ? `(Unit #${result.unit_number})` : ''}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Tenant / Payee:</span>
                <span className="font-semibold text-slate-800 text-right">
                  {result.tenant_name}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Description:</span>
                <span className="text-slate-600 text-right truncate max-w-[200px]">
                  {result.description}
                </span>
              </div>
            </div>

            {/* Cryptographic Ledger Assurance Note */}
            <div className="mt-5 p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100 text-[11px] text-emerald-950 flex items-start gap-2.5">
              <svg className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <div className="leading-relaxed">
                <span className="font-bold">Cryptographic Ledger Assurance: </span>
                This record was verified against Luffi Tech’s real-time escrow ledger. Any digital manipulation, altered amount, or fabricated document invalidates this proof.
              </div>
            </div>

            <div className="mt-6 text-center text-[10px] text-slate-400 font-mono">
              Audited at {verificationTimestamp}
            </div>
          </div>
        ) : (
          /* =========================================================
             INVALID RECEIPT: RED FRAUD ALERT
             ========================================================= */
          <div className="w-full bg-white border border-rose-300 rounded-3xl shadow-xl p-8 sm:p-10 relative overflow-hidden transition-all">
            {/* Top Red Accent Bar */}
            <div className="absolute top-0 left-0 right-0 h-2.5 bg-gradient-to-r from-rose-600 via-red-600 to-rose-700" />

            {/* Alert Badge */}
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-rose-50 border-2 border-rose-300 text-rose-600 flex items-center justify-center shadow-inner">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <div>
                <span className="text-[11px] font-bold text-rose-800 uppercase tracking-widest bg-rose-100 border border-rose-300 px-3 py-1 rounded-full">
                  Security Warning
                </span>
                <h1 className="text-2xl sm:text-3xl font-black text-rose-950 tracking-tight mt-3">
                  Fraud Alert: Receipt Not Found
                </h1>
                <p className="text-xs text-rose-700 mt-2 max-w-md mx-auto leading-relaxed">
                  The scanned receipt identifier does not match any valid payment in the Luffi Tech institutional database.
                </p>
              </div>
            </div>

            {/* Scanned ID details */}
            <div className="my-6 p-4 bg-rose-50/60 border border-rose-200 rounded-2xl text-xs space-y-2">
              <div className="flex justify-between items-center text-rose-950">
                <span className="text-rose-600 font-medium">Scanned Reference:</span>
                <span className="font-mono font-bold break-all">{receipt_id || 'Empty'}</span>
              </div>
              <div className="flex justify-between items-center text-rose-950">
                <span className="text-rose-600 font-medium">Verification Result:</span>
                <span className="font-bold text-rose-700">UNVERIFIED / INVALID</span>
              </div>
            </div>

            {/* Security Notice for Auditor */}
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-2">
              <div className="flex items-center gap-1.5 font-bold">
                <svg className="w-4 h-4 text-amber-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>Recommended Action</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                If you were provided with this receipt by a tenant, landlord, or agent, do not release property keys, clear deposit refunds, or approve financial verifications. Contact the property management office to verify payment legitimacy.
              </p>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/"
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold text-center transition-colors shadow-sm"
              >
                Go to Luffi Tech Homepage
              </Link>
            </div>

            <div className="mt-6 text-center text-[10px] text-slate-400 font-mono">
              Audited at {verificationTimestamp}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-xl mx-auto w-full text-center text-[11px] text-slate-400 py-4">
        &copy; {new Date().getFullYear()} Luffi Tech Institutional Escrow Systems. All Rights Reserved.
      </footer>
    </div>
  )
}

