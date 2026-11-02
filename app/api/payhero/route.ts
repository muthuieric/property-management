import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const webhookSecret = process.env.PAYHERO_WEBHOOK_SECRET

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function verifySignature(payload: string, signature: string | null): boolean {
  if (!webhookSecret || !signature) return false
  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

function extractReference(body: any): string | null {
  return (
    body?.external_reference ??
    body?.reference ??
    body?.transaction_id ??
    body?.reference_code ??
    body?.receipt_id ??
    null
  )
}

function extractAmount(body: any): number | null {
  const amount =
    body?.amount ?? body?.amount_paid ?? body?.transaction_amount ?? null
  if (amount === null || amount === undefined) return null
  const parsed = Number(amount)
  return Number.isFinite(parsed) ? parsed : null
}

function extractStatus(body: any): string | null {
  return (
    body?.status ??
    body?.transaction_status ??
    body?.payment_status ??
    body?.state ??
    null
  )
}

function extractPhone(body: any): string | null {
  return (
    body?.phone_number ??
    body?.phone ?? body?.msisdn ?? body?.customer_phone ?? null
  )
}

function extractTransactionDate(body: any): string | null {
  return (
    body?.transaction_date ??
    body?.date ??
    body?.paid_at ??
    body?.created_at ??
    body?.timestamp ??
    null
  )
}

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text()
  let body: any

  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  // Signature verification (when a webhook secret is configured)
  const signature = req.headers.get('x-payhero-signature') ?? req.headers.get('payhero-signature')
  if (webhookSecret && !verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const reference = extractReference(body)
  const amount = extractAmount(body)
  const status = extractStatus(body)
  const phone = extractPhone(body)
  const txDate = extractTransactionDate(body)

  if (!reference) {
    return NextResponse.json({ error: 'Missing reference identifier' }, { status: 400 })
  }

  // Only treat successful statuses as verified
  const isSuccess = status
    ? ['completed', 'success', 'paid', 'successful', 'confirmed'].includes(
        String(status).toLowerCase()
      )
    : true

  // Find the matching transaction by external_reference or receipt_id
  const { data: tx, error: txErr } = await admin
    .from('transactions')
    .select(
      'id, agency_id, tenant_id, property_id, unit_id, amount, status, receipt_id, transaction_type, description'
    )
    .or(`external_reference.eq.${reference},receipt_id.eq.${reference}`)
    .maybeSingle()

  if (txErr || !tx) {
    return NextResponse.json(
      { error: `No transaction found for reference ${reference}` },
      { status: 404 }
    )
  }

  // Idempotency: already verified
  if (tx.status === 'verified') {
    return NextResponse.json({
      status: 'already_verified',
      transaction_id: tx.id,
    })
  }

  const updateData: Record<string, unknown> = {
    status: isSuccess ? 'verified' : 'bounced',
  }
  if (amount !== null) {
    updateData['amount'] = amount
  }
  if (phone) {
    updateData['description'] = `${tx.description ?? ''} | PayHero: ${phone}`.trim()
  }
  if (txDate) {
    updateData['transaction_date'] = txDate
  }

  const { error: updateErr } = await admin
    .from('transactions')
    .update(updateData)
    .eq('id', tx.id)
    .eq('agency_id', tx.agency_id)

  if (updateErr) {
    console.error('PayHero webhook update error:', updateErr)
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 })
  }

  if (!isSuccess) {
    return NextResponse.json({
      status: 'bounced',
      transaction_id: tx.id,
    })
  }

  // Double-entry ledger: debit cash/bank, credit tenant receivable
  const ledgerAmount = isSuccess ? Number(tx.amount || 0) : 0
  const tenantId = tx.tenant_id

  if (tenantId) {
    await admin.from('ledger_entries').insert([
      {
        agency_id: tx.agency_id,
        tenant_id: tenantId,
        transaction_id: tx.id,
        debit_account: 'Cash / Bank',
        credit_account: 'Tenant Receivable',
        amount: ledgerAmount,
        entry_date: txDate || new Date().toISOString().split('T')[0],
        reference,
      },
    ])
  }

  // Settle the oldest open invoice for this tenant
  if (tenantId) {
    const { data: openInvoice } = await admin
      .from('invoices')
      .select('id, total_amount, status')
      .eq('tenant_id', tenantId)
      .in('status', ['unpaid', 'partial'])
      .order('billing_month', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (openInvoice) {
      const invTotal = Number(openInvoice.total_amount || 0)
      const paidAmount = ledgerAmount
      const newStatus = paidAmount >= invTotal ? 'paid' : 'partial'

      await admin
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', openInvoice.id)
    }
  }

  return NextResponse.json({
    status: 'verified',
    transaction_id: tx.id,
    amount: ledgerAmount,
  })
}
