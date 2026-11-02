import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }
  const supabase = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const body = await req.json()
    // M-Pesa C2B / STK Push callback structure
    const stkCallback = body.Body?.stkCallback

    if (!stkCallback) {
      // Also handle C2B register validation/confirmation
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
    }

    const checkoutRequestId = stkCallback.CheckoutRequestID
    const resultCode = stkCallback.ResultCode
    const resultDesc = stkCallback.ResultDesc
    const callbackMetadata = stkCallback.CallbackMetadata?.Item || []

    // Find the transaction by external_reference (CheckoutRequestID)
    const { data: transaction, error: txErr } = await supabase
      .from('transactions')
      .select('*, invoices ( id, tenant_id, total_amount, agency_id, invoice_number )')
      .eq('external_reference', checkoutRequestId)
      .single()

    if (txErr || !transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Only process successful payments
    if (resultCode !== 0) {
      await supabase
        .from('transactions')
        .update({ status: 'failed', description: `${transaction.description} - ${resultDesc}` })
        .eq('id', transaction.id)
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Payment failed' })
    }

    // Extract M-Pesa receipt number and amount from callback metadata
    const receiptItem = callbackMetadata.find((i: any) => i.Name === 'MpesaReceiptNumber')
    const amountItem = callbackMetadata.find((i: any) => i.Name === 'Amount')
    const phoneItem = callbackMetadata.find((i: any) => i.Name === 'PhoneNumber')

    const mpesaReceipt = receiptItem?.Value
    const paidAmount = amountItem?.Value
    const payerPhone = phoneItem?.Value

    const invoice = transaction.invoices as { id: string; tenant_id: string; total_amount: number; agency_id: string; invoice_number: string } | null

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not linked' }, { status: 404 })
    }

    // Update transaction as completed
    await supabase
      .from('transactions')
      .update({
        status: 'completed',
        external_reference: mpesaReceipt ?? checkoutRequestId,
        description: `M-Pesa payment ${mpesaReceipt} for invoice ${invoice.invoice_number}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction.id)

    // Create double-entry ledger entry: Debit Cash/Bank, Credit Accounts Receivable
    await supabase.from('ledger_entries').insert([
      {
        agency_id: invoice.agency_id,
        tenant_id: invoice.tenant_id,
        invoice_id: invoice.id,
        transaction_id: transaction.id,
        debit_account: 'Cash / Bank',
        credit_account: 'Accounts Receivable',
        amount: paidAmount,
        entry_date: new Date().toISOString().slice(0, 10),
        reference: mpesaReceipt ?? checkoutRequestId,
        created_at: new Date().toISOString(),
      },
    ])

    // Update invoice status if fully paid
    const newTotalPaid = Number(transaction.amount || 0) + Number(paidAmount || 0)
    if (newTotalPaid >= Number(invoice.total_amount)) {
      await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoice.id)
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Payment recorded' })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Webhook processing failed' }, { status: 500 })
  }
}
