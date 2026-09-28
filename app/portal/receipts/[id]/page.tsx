import React from 'react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getReceiptData } from '@/app/dashboard/financials/actions'
import QRCodeSVG from '@/app/lib/utils/qrcode'
import ReceiptActions from '../components/ReceiptActions'

export const dynamic = 'force-dynamic'

interface ReceiptPageProps {
  params: Promise<{ id: string }>
}

export default async function TenantReceiptPage({ params }: ReceiptPageProps) {
  const { id } = await params

  const receipt = await getReceiptData(id)

  if (!receipt) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-lg">
          <div className="w-14 h-14 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Receipt Not Found</h2>
          <p className="text-sm text-slate-500 mb-6">
            The requested receipt identifier <span className="font-mono text-slate-700 font-medium">#{id}</span> does not exist or has not been posted to the ledger yet.
          </p>
          <Link
            href="/portal"
            className="inline-flex items-center justify-center px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors shadow-sm"
          >
            &larr; Return to Resident Portal
          </Link>
        </div>
      </div>
    )
  }

  // Derive verification URL dynamically
  const headerList = await headers()
  const host = headerList.get('host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const baseUrl = `${protocol}://${host}`
  const verifyUrl = `${baseUrl}/verify/${receipt.receipt_id}`

  const formattedDate = new Date(receipt.transaction_date).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const formattedShortCode = receipt.receipt_id.slice(0, 8).toUpperCase()

  return (
    <div className="py-6 sm:py-10 px-4 sm:px-6 max-w-4xl mx-auto space-y-6">
      {/* Top Action Bar (hidden on print) */}
      <ReceiptActions receiptId={receipt.receipt_id} verifyUrl={verifyUrl} />

      {/* A4 Aspect Ratio Printable Receipt Document */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-xl p-8 sm:p-14 print:p-8 print:border-none print:shadow-none print:rounded-none relative overflow-hidden transition-all">
        {/* Top Decorative Escrow Watermark Stripe */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-700 print:hidden" />

        {/* RECEIPT HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-8 border-b border-slate-200 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {receipt.agency.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={receipt.agency.logo_url}
                  alt={receipt.agency.name}
                  className="w-12 h-12 object-contain rounded-xl border border-slate-100 p-1"
                />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-emerald-700 text-white font-black text-lg flex items-center justify-center shadow-xs">
                  {receipt.agency.name.charAt(0) || 'L'}
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  {receipt.agency.name}
                </h1>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1 mt-0.5">
                  <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Verified Institutional Escrow
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 mt-1">
              {receipt.property.address || 'Enterprise Commercial & Residential Property Management'}
              {receipt.property.city ? `, ${receipt.property.city}` : ''}
            </p>
            {receipt.agency.support_phone && (
              <p className="text-xs text-slate-500">
                Support: {receipt.agency.support_phone} &bull; {receipt.agency.support_email}
              </p>
            )}
          </div>

          <div className="sm:text-right flex flex-col sm:items-end">
            <span className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
              Official Payment Receipt
            </span>
            <span className="text-2xl font-black text-slate-900 font-mono tracking-tight mt-0.5">
              #{formattedShortCode}
            </span>
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-bold border border-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>PAID &amp; CLEARED</span>
            </div>
          </div>
        </div>

        {/* METADATA GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 py-6 border-b border-slate-200 text-xs">
          <div>
            <span className="text-slate-400 font-medium uppercase tracking-wider block mb-1">
              Billed Resident (Tenant)
            </span>
            <p className="font-bold text-slate-900 text-sm">
              {receipt.tenant.name}
            </p>
            {receipt.tenant.email && (
              <p className="text-slate-500 truncate">{receipt.tenant.email}</p>
            )}
            {receipt.tenant.phone && (
              <p className="text-slate-500">{receipt.tenant.phone}</p>
            )}
            {receipt.tenant.id_number && (
              <p className="text-slate-400 font-mono text-[11px] mt-0.5">
                ID / Passport: {receipt.tenant.id_number}
              </p>
            )}
          </div>

          <div>
            <span className="text-slate-400 font-medium uppercase tracking-wider block mb-1">
              Premises &amp; Allocation
            </span>
            <p className="font-bold text-slate-900 text-sm">
              Unit #{receipt.unit.unit_number}
            </p>
            <p className="text-slate-600 font-medium">
              {receipt.property.name}
            </p>
            <p className="text-slate-400 text-[11px] mt-0.5">
              {receipt.property.city || 'Kenya'}
            </p>
          </div>

          <div>
            <span className="text-slate-400 font-medium uppercase tracking-wider block mb-1">
              Payment Particulars
            </span>
            <p className="text-slate-900 font-semibold">
              Date: <span className="font-normal text-slate-600">{formattedDate}</span>
            </p>
            <p className="text-slate-900 font-semibold">
              Channel: <span className="font-normal text-slate-600">{receipt.payment_method}</span>
            </p>
            <p className="text-slate-900 font-semibold truncate">
              Reference: <span className="font-mono text-slate-600 text-[11px]">{receipt.receipt_id}</span>
            </p>
          </div>
        </div>

        {/* CHARGE BREAKDOWN: RENT VS UTILITIES TABLE */}
        <div className="py-6 border-b border-slate-200">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
            Itemized Charge Breakdown
          </h3>

          <div className="overflow-hidden border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-center">Category</th>
                  <th className="py-3 px-4 text-right">Amount (KES)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* Base Rent Line Item */}
                <tr className="hover:bg-slate-50/50">
                  <td className="py-3.5 px-4">
                    <p className="font-bold text-slate-900">Base Monthly Rent</p>
                    <p className="text-[11px] text-slate-500">
                      Standard tenancy allocation for Unit #{receipt.unit.unit_number}
                    </p>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                      Rent
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                    KES {receipt.breakdown.rent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>

                {/* Utilities Line Item */}
                {receipt.breakdown.utilities > 0 && (
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">Bundled Utility Charges</p>
                      <p className="text-[11px] text-slate-500">
                        Metered water, electricity, or bulk utilities consumption
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200">
                        Utilities
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                      KES {receipt.breakdown.utilities.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}

                {/* Service Charge Line Item (if applicable) */}
                {receipt.breakdown.service_charge > 0 && (
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">Fixed Service Charge</p>
                      <p className="text-[11px] text-slate-500">
                        Common area cleaning, security, and waste management
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        Services
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                      KES {receipt.breakdown.service_charge.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* TOTALS COMPUTATION */}
          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-xs space-y-2 text-xs">
              <div className="flex justify-between text-slate-500 py-1">
                <span>Subtotal Charges:</span>
                <span className="font-medium text-slate-700 tabular-nums">
                  KES {receipt.breakdown.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t-2 border-slate-900">
                <span className="text-sm font-bold text-slate-900">Total Paid:</span>
                <span className="text-xl font-black text-emerald-700 tabular-nums">
                  KES {receipt.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* VERIFICATION & QR CODE SECTION */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-6 bg-slate-50/70 p-6 rounded-2xl border border-slate-200/80">
          <div className="space-y-2 text-center sm:text-left flex-1">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Cryptographically Verified Receipt
              </h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed max-w-md">
              Scan this QR code with any smartphone camera or auditing scanner to instantly verify the authenticity of this payment on the public ledger.
            </p>
            <div className="pt-1">
              <p className="text-[11px] text-slate-400 font-mono break-all">
                Verification Route: <span className="text-slate-700 font-semibold">{verifyUrl}</span>
              </p>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                Timestamp: {receipt.created_at || new Date().toISOString()}
              </p>
            </div>
          </div>

          {/* QR CODE CONTAINER */}
          <div className="flex flex-col items-center shrink-0">
            <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <QRCodeSVG
                value={verifyUrl}
                size={130}
                fgColor="#0f172a"
                bgColor="#ffffff"
                includeMargin={true}
              />
            </div>
            <span className="text-[10px] font-mono text-slate-500 font-semibold mt-1.5 uppercase tracking-wider">
              Scan To Verify
            </span>
          </div>
        </div>

        {/* RECEIPT FOOTER */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
          <span>Generated by Luffi Tech Institutional Escrow &amp; Property Management.</span>
          <span>Legal Electronic Receipt &bull; Valid without physical stamp.</span>
        </div>
      </div>
    </div>
  )
}

