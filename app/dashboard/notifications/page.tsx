'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  sendInvoiceEmail,
  sendRentReminder,
  getAgencyContacts,
} from './actions'

type Channel = 'email' | 'sms' | 'both'

interface Contact {
  id: string
  name: string
  email: string | null
  phone: string | null
}

export default function NotificationsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  const [channel, setChannel] = useState<Channel>('both')
  const [message, setMessage] = useState('')
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)

  const [invoiceTo, setInvoiceTo] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [billingMonth, setBillingMonth] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const data = await getAgencyContacts()
        setContacts(data)
      } catch (err) {
        console.error(err)
        setContacts([])
      }
    })()
  }, [])

  const handleSendBulk = async () => {
    if (!message.trim()) {
      setResult({ kind: 'error', message: 'Please enter a message.' })
      return
    }

    setSending(true)
    setResult(null)
    try {
      const targets = selectedContact ? [selectedContact] : contacts
      let sent = 0
      let failed = 0

      for (const c of targets) {
        if (channel === 'email' || channel === 'both') {
          if (c.email) {
            try {
              await fetch('/api/notifications/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: c.email, subject: 'Notification from Luffi Tech', message }),
              })
              sent++
            } catch {
              failed++
            }
          } else failed++
        }
        if (channel === 'sms' || channel === 'both') {
          if (c.phone) {
            try {
              await fetch('/api/notifications/send-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: c.phone, message }),
              })
              sent++
            } catch {
              failed++
            }
          } else failed++
        }
      }

      setResult({
        kind: 'success',
        message: `Sent ${sent} message(s). ${failed > 0 ? `${failed} failed.` : ''}`,
      })
    } catch (err: any) {
      setResult({ kind: 'error', message: err?.message ?? 'Failed to send.' })
    } finally {
      setSending(false)
    }
  }

  const handleSendInvoiceEmail = async () => {
    if (!invoiceTo || !invoiceNumber || !billingMonth || !totalAmount) {
      setResult({ kind: 'error', message: 'Please fill all invoice fields.' })
      return
    }

    setSending(true)
    setResult(null)
    try {
      const r = await sendInvoiceEmail({
        to: invoiceTo,
        invoiceNumber,
        billingMonth,
        totalAmount: Number(totalAmount),
        pdfUrl: pdfUrl || undefined,
        tenantName: selectedContact?.name ?? 'Tenant',
        propertyName: undefined,
      })

      if (r.email.success) {
        setResult({ kind: 'success', message: 'Invoice email sent.' })
      } else {
        setResult({ kind: 'error', message: `Email failed: ${r.email.error ?? 'unknown'}` })
      }
    } catch (err: any) {
      setResult({ kind: 'error', message: err?.message ?? 'Failed to send invoice.' })
    } finally {
      setSending(false)
    }
  }

  const handleSendRentReminder = async () => {
    if (!selectedContact?.email && !selectedContact?.phone) {
      setResult({ kind: 'error', message: 'Select a contact with email or phone.' })
      return
    }
    if (!invoiceNumber || !totalAmount || !billingMonth) {
      setResult({ kind: 'error', message: 'Fill invoice details.' })
      return
    }

    setSending(true)
    setResult(null)
    try {
      const to = selectedContact.email ?? selectedContact.phone ?? ''
      const r = await sendRentReminder({
        to,
        tenantName: selectedContact.name,
        invoiceNumber,
        totalAmount: Number(totalAmount),
        dueDate: billingMonth,
      })
      if (r.email.success && r.sms.success) {
        setResult({ kind: 'success', message: 'Rent reminder sent.' })
      } else {
        setResult({
          kind: 'error',
          message: `Email: ${r.email.error ?? 'ok'}. SMS: ${r.sms.error ?? 'ok'}.`,
        })
      }
    } catch (err: any) {
      setResult({ kind: 'error', message: err?.message ?? 'Failed.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-[1200px] mx-auto space-y-6 text-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-900 text-white shadow-xs">
            Notifications
          </span>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 font-sans mt-1">
            Bulk SMS & Email
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Send rent reminders, payment receipts, and bulk messages via Resend (email) and Africa&apos;s Talking (SMS).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/financials"
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors underline underline-offset-4"
          >
            ← Back to Financial Ledger
          </Link>
        </div>
      </div>

      {result && (
        <div
          className={cn(
            'rounded-lg border px-4 py-3 text-xs font-medium',
            result.kind === 'success'
              ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
              : 'border-red-200 text-red-700 bg-red-50'
          )}
        >
          {result.message}
        </div>
      )}

      {/* BULK MESSAGE */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 font-sans">Bulk Message</h2>
            <p className="text-[11px] text-slate-500 mt-1">
              Send to all active tenants or a single contact.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-medium text-slate-600">Channel</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as Channel)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="both">Email + SMS</option>
              <option value="email">Email only</option>
              <option value="sms">SMS only</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="e.g. Rent reminder: Kindly settle your March rent by 5th April to avoid penalties."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div className="flex flex-col gap-2 w-full sm:w-auto">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Contact
            </label>
            <select
              value={selectedContact?.id ?? ''}
              onChange={(e) => {
                const id = e.target.value
                setSelectedContact(id ? contacts.find((c) => c.id === id) ?? null : null)
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">All contacts</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.email ?? c.phone ?? 'no contact'})
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleSendBulk}
          disabled={sending || !message.trim()}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
            sending
              ? 'border-slate-200 text-slate-400 bg-slate-50 cursor-wait'
              : 'border-transparent bg-emerald-600 text-white hover:bg-emerald-700'
          )}
        >
          {sending ? 'Sending…' : 'Send Message'}
        </button>
      </div>

      {/* INVOICE EMAIL */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 font-sans">Send Invoice by Email</h2>
            <p className="text-[11px] text-slate-500 mt-1">
              Email a generated invoice PDF to a tenant.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
              To (Email)
            </label>
            <input
              value={invoiceTo}
              onChange={(e) => setInvoiceTo(e.target.value)}
              type="email"
              placeholder="tenant@example.com"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Invoice Number
            </label>
            <input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="INV-202603"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Billing Month
            </label>
            <input
              value={billingMonth}
              onChange={(e) => setBillingMonth(e.target.value)}
              placeholder="March 2026"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Total Amount (KES)
            </label>
            <input
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              type="number"
              step="0.01"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
              PDF URL (optional)
            </label>
            <input
              value={pdfUrl}
              onChange={(e) => setPdfUrl(e.target.value)}
              placeholder="https://..."
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        <button
          onClick={handleSendInvoiceEmail}
          disabled={sending || !invoiceTo || !invoiceNumber || !billingMonth || !totalAmount}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
            sending
              ? 'border-slate-200 text-slate-400 bg-slate-50 cursor-wait'
              : 'border-transparent bg-emerald-600 text-white hover:bg-emerald-700'
          )}
        >
          {sending ? 'Sending…' : 'Send Invoice Email'}
        </button>
      </div>

      {/* RENT REMINDER */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 font-sans">Rent Reminder</h2>
            <p className="text-[11px] text-slate-500 mt-1">
              Send a rent due reminder to a selected tenant.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Tenant
            </label>
            <select
              value={selectedContact?.id ?? ''}
              onChange={(e) => {
                const id = e.target.value
                setSelectedContact(id ? contacts.find((c) => c.id === id) ?? null : null)
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Select tenant</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Invoice Number
            </label>
            <input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="INV-202603"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div className="flex-1">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Amount (KES)
            </label>
            <input
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              type="number"
              step="0.01"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div className="flex-1">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Due Date
            </label>
            <input
              value={billingMonth}
              onChange={(e) => setBillingMonth(e.target.value)}
              type="date"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        <button
          onClick={handleSendRentReminder}
          disabled={sending || !selectedContact || !invoiceNumber || !totalAmount || !billingMonth}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
            sending
              ? 'border-slate-200 text-slate-400 bg-slate-50 cursor-wait'
              : 'border-transparent bg-amber-600 text-white hover:bg-amber-700'
          )}
        >
          {sending ? 'Sending…' : 'Send Reminder'}
        </button>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Configuration
        </h3>
        <ul className="text-[11px] text-slate-500 space-y-1 list-disc pl-4">
          <li>
            Email: <code className="font-mono">RESEND_API_KEY</code> +{' '}
            <code className="font-mono">EMAIL_FROM</code>
          </li>
          <li>
            SMS: <code className="font-mono">AFRICASTALKING_API_KEY</code> +{' '}
            <code className="font-mono">AFRICASTALKING_USERNAME</code> +{' '}
            <code className="font-mono">AFRICASTALKING_FROM</code>
          </li>
          <li>
            Add these to <code className="font-mono">.env.local</code> before sending.
          </li>
        </ul>
      </div>
    </div>
  )
}
