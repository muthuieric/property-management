'use server'

import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'
import { sendEmail, sendSms, type EmailResult, type SmsResult } from '@/app/lib/notifications'

export interface NotificationResult {
  email: EmailResult
  sms: SmsResult
}

export async function sendInvoiceEmail({
  to,
  invoiceNumber,
  billingMonth,
  totalAmount,
  pdfUrl,
  tenantName,
  propertyName,
}: {
  to: string
  invoiceNumber: string
  billingMonth: string
  totalAmount: number
  pdfUrl?: string | null
  tenantName: string
  propertyName?: string | null
}): Promise<NotificationResult> {
  const html = `
    <div style="font-family: 'Josefin Sans', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #134E4A;">
      <h1 style="color: #0F766E; font-family: 'Cinzel', serif;">Luffi Tech Property Management</h1>
      <h2 style="color: #0369A1;">Invoice ${invoiceNumber}</h2>
      <p>Dear ${tenantName},</p>
      <p>Your invoice for <strong>${billingMonth}</strong> is ready.</p>
      <p><strong>Property:</strong> ${propertyName ?? 'N/A'}</p>
      <p><strong>Total Amount:</strong> KES ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
      ${pdfUrl ? `<p><a href="${pdfUrl}" style="background:#0369A1;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">Download Invoice PDF</a></p>` : ''}
      <p style="margin-top:24px;color:#475569;font-size:14px;">Thank you for your tenancy.</p>
    </div>
  `

  const [email, sms] = await Promise.all([
    sendEmail({
      to,
      subject: `Invoice ${invoiceNumber} - ${billingMonth}`,
      html,
      text: `Invoice ${invoiceNumber} for ${billingMonth}. Total: KES ${totalAmount.toLocaleString()}.`,
    }),
    sendSms({
      to: to.replace(/^/, ''),
      message: `Luffi Tech: Invoice ${invoiceNumber} for ${billingMonth} is ready. Total: KES ${totalAmount.toLocaleString()}.`,
    }),
  ])

  return { email, sms }
}

export async function sendPaymentReceiptSms({
  to,
  receiptId,
  amount,
  propertyName,
}: {
  to: string
  receiptId: string
  amount: number
  propertyName?: string | null
}): Promise<SmsResult> {
  return sendSms({
    to,
    message: `Luffi Tech: Payment receipt #${receiptId.slice(0, 8)} for KES ${amount.toLocaleString()} (${propertyName ?? 'property'}) received. Thank you!`,
  })
}

export async function sendRentReminder({
  to,
  tenantName,
  invoiceNumber,
  totalAmount,
  dueDate,
}: {
  to: string
  tenantName: string
  invoiceNumber: string
  totalAmount: number
  dueDate: string
}): Promise<NotificationResult> {
  const html = `
    <div style="font-family: 'Josefin Sans', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #134E4A;">
      <h1 style="color: #0F766E; font-family: 'Cinzel', serif;">Luffi Tech Property Management</h1>
      <h2 style="color: #DC2626;">Rent Payment Reminder</h2>
      <p>Dear ${tenantName},</p>
      <p>This is a friendly reminder that invoice <strong>${invoiceNumber}</strong> for <strong>KES ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong> is due on <strong>${dueDate}</strong>.</p>
      <p>Please settle your rent to avoid late penalties.</p>
      <p style="margin-top:24px;color:#475569;font-size:14px;">Thank you.</p>
    </div>
  `

  const [email, sms] = await Promise.all([
    sendEmail({
      to,
      subject: `Rent Reminder - Invoice ${invoiceNumber}`,
      html,
      text: `Rent reminder: Invoice ${invoiceNumber} for KES ${totalAmount.toLocaleString()} is due on ${dueDate}.`,
    }),
    sendSms({
      to,
      message: `Luffi Tech: Reminder - Invoice ${invoiceNumber} for KES ${totalAmount.toLocaleString()} is due on ${dueDate}. Please pay to avoid penalties.`,
    }),
  ])

  return { email, sms }
}

export async function getAgencyContacts(): Promise<Array<{
  id: string
  name: string
  email: string | null
  phone: string | null
}>> {
  const { agencyId } = await getUserAgencyContext()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tenants')
    .select('id, first_name, last_name, email, phone_number')
    .eq('agency_id', agencyId)
    .eq('is_active', true)
    .order('first_name', { ascending: true })

  if (error || !data) {
    console.error('getAgencyContacts error:', error)
    return []
  }

  return data.map((t) => ({
    id: t.id,
    name: `${t.first_name ?? ''} ${t.last_name ?? ''}`.trim() || 'Unknown',
    email: t.email ?? null,
    phone: t.phone_number ?? null,
  }))
}
