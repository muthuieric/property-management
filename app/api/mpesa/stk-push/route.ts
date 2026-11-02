import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'

// M-Pesa Daraja API - STK Push Initiation
// Requires: MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_PASSKEY, MPESA_SHORTCODE, MPESA_CALLBACK_URL

const MPESA_BASE_URL = process.env.MPESA_BASE_URL || 'https://sandbox.safaricom.co.ke'
const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET
const MPESA_PASSKEY = process.env.MPESA_PASSKEY
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE
const MPESA_CALLBACK_URL = process.env.MPESA_CALLBACK_URL

let accessTokenCache: { token: string; expiry: number } | null = null

async function getMpesaAccessToken(): Promise<string | null> {
  if (accessTokenCache && Date.now() < accessTokenCache.expiry) {
    return accessTokenCache.token
  }
  if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET) return null
  try {
    const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64')
    const res = await fetch(`${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
    })
    const data = await res.json()
    if (data.access_token) {
      accessTokenCache = { token: data.access_token, expiry: Date.now() + 3500 * 1000 }
      return data.access_token
    }
  } catch {
    // fall through
  }
  return null
}

export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  try {
    const { agencyId } = await getUserAgencyContext()
    const supabase = await createClient()
    const body = await req.json()
    const { phoneNumber, amount, invoiceId, accountReference } = body

    if (!phoneNumber || !amount || !invoiceId) {
      return NextResponse.json({ error: 'Missing phoneNumber, amount, or invoiceId' }, { status: 400 })
    }

    const token = await getMpesaAccessToken()
    if (!token) {
      return NextResponse.json({ error: 'M-Pesa credentials not configured' }, { status: 500 })
    }

    // Fetch invoice for tenant name
    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, invoice_number, total_amount, tenants ( first_name, last_name )')
      .eq('id', invoiceId)
      .eq('agency_id', agencyId)
      .single()

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Format phone number (remove leading 0, add 254)
    const normalizedPhone = phoneNumber.startsWith('0') ? `254${phoneNumber.slice(1)}` : phoneNumber

    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
    const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64')

    const stkPayload = {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: normalizedPhone,
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: normalizedPhone,
      CallBackURL: MPESA_CALLBACK_URL,
      AccountReference: accountReference || `INV-${invoice.invoice_number ?? invoiceId.slice(0, 8)}`,
      TransactionDesc: `Rent payment - ${invoice.invoice_number ?? invoiceId.slice(0, 8)}`,
    }

    const res = await fetch(`${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(stkPayload),
    })

    const data = await res.json()

    // Record the initiation as a pending transaction
    await supabase.from('transactions').insert({
      agency_id: agencyId,
      invoice_id: invoiceId,
      transaction_type: 'mpesa_stk_push',
      amount: Math.round(amount),
      transaction_date: new Date().toISOString().slice(0, 10),
      description: `M-Pesa STK push for invoice ${invoice.invoice_number ?? invoiceId.slice(0, 8)}`,
      status: 'pending',
      payment_method: 'MPESA',
      external_reference: data.CheckoutRequestID ?? null,
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: data.ResponseCode === '0',
      checkoutRequestId: data.CheckoutRequestID,
      customerMessage: data.CustomerMessage,
      error: data.ResponseCode !== '0' ? data.errorMessage : null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'STK push failed' }, { status: 500 })
  }
}
