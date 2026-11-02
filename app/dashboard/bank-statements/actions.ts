'use server'

import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getUserAgencyContext } from '@/utils/supabase/get-context'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export interface BankStatementRow {
  date: string
  amount: number
  reference: string | null
  description: string | null
}

export interface BankUploadResult {
  success: boolean
  rowsProcessed: number
  matched: number
  unmatched: number
  errors: string[]
  matchedDetails: Array<{
    invoiceId: string
    invoiceNumber: string
    amount: number
    reference: string
  }>
}

function simpleCsvParse(csvContent: string): Record<string, string>[] {
  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return []

  const headerLine = lines[0]
  const headers = parseCsvLine(headerLine)
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    const row: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? ''
    }
    rows.push(row)
  }

  return rows
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        result.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  result.push(current)
  return result
}

function parseBankCSV(csvContent: string): BankStatementRow[] {
  const records = simpleCsvParse(csvContent)
  const rows: BankStatementRow[] = []

  for (const rec of records) {
    const keys = Object.keys(rec)
    const findKey = (candidates: string[]) => {
      for (const c of candidates) {
        const found = keys.find((k) => k.toLowerCase().trim() === c.toLowerCase().trim())
        if (found) return rec[found]
      }
      return null
    }

    const date = findKey(['date', 'transaction date', 'value date', 'posting date'])
    const amountRaw = findKey(['amount', 'credit', 'deposit', 'transaction amount'])
    const reference = findKey(['reference', 'ref', 'narration', 'description', 'details', 'remarks'])
    const description = findKey(['narration', 'details', 'remarks', 'reference'])

    const amount = amountRaw ? Number(String(amountRaw).replace(/[,\s]/g, '')) : 0

    if (date && amount > 0) {
      rows.push({
        date: String(date),
        amount,
        reference: reference ? String(reference) : null,
        description: description ? String(description) : null,
      })
    }
  }

  return rows
}

function normalizeReference(ref: string | null): string[] {
  if (!ref) return []
  const upper = ref.toUpperCase()
  const tokens: string[] = []
  const invoicePattern = upper.match(/[A-Z]{2,}\/\d{3,}|INV[-/][A-Z0-9]{6,}/g)
  if (invoicePattern) tokens.push(...invoicePattern)
  const numPattern = upper.match(/\b\d{4,}\b/g)
  if (numPattern) tokens.push(...numPattern)
  return tokens
}

export async function uploadBankStatement({
  fileName,
  fileBuffer,
  contentType,
}: {
  fileName: string
  fileBuffer: Buffer
  contentType: string
}): Promise<BankUploadResult> {
  const { agencyId, userId } = await getUserAgencyContext()
  const supabase = await createClient()
  const supabaseAdmin = createAdminClient(supabaseUrl!, serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const errors: string[] = []
  const matchedDetails: BankUploadResult['matchedDetails'] = []
  let rowsProcessed = 0
  let matched = 0
  let unmatched = 0

  try {
    const csvContent = fileBuffer.toString('utf-8')
    const rows = parseBankCSV(csvContent)
    rowsProcessed = rows.length

    const { data: unpaidInvoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, total_amount, status, tenant_id')
      .eq('agency_id', agencyId)
      .in('status', ['unpaid', 'partial'])

    for (const row of rows) {
      const refTokens = normalizeReference(row.reference ?? row.description)
      let matchedInvoice: any = null

      for (const token of refTokens) {
        const inv = (unpaidInvoices || []).find(
          (i: any) => i.invoice_number && i.invoice_number.toUpperCase().includes(token)
        )
        if (inv) {
          matchedInvoice = inv
          break
        }
      }

      if (!matchedInvoice) {
        const inv = (unpaidInvoices || []).find(
          (i: any) => Number(i.total_amount) === row.amount
        )
        if (inv) matchedInvoice = inv
      }

      if (matchedInvoice) {
        matched++
        matchedDetails.push({
          invoiceId: matchedInvoice.id,
          invoiceNumber: matchedInvoice.invoice_number,
          amount: row.amount,
          reference: row.reference ?? row.description ?? '',
        })

        await supabaseAdmin.from('transactions').insert({
          agency_id: agencyId,
          invoice_id: matchedInvoice.id,
          transaction_type: 'bank_reconciliation',
          amount: row.amount,
          transaction_date: row.date,
          description: `Bank statement payment - ${row.reference ?? row.description ?? 'N/A'}`,
          status: 'verified',
          payment_method: 'BANK_TRANSFER',
          external_reference: row.reference ?? null,
          receipt_id: `BANK-${Date.now()}`,
          created_by: userId,
          created_at: new Date().toISOString(),
        })

        await supabaseAdmin.from('ledger_entries').insert([
          {
            agency_id: agencyId,
            tenant_id: matchedInvoice.tenant_id,
            invoice_id: matchedInvoice.id,
            debit_account: 'Cash / Bank',
            credit_account: 'Accounts Receivable',
            amount: row.amount,
            entry_date: row.date,
            reference: `BANK-${row.reference ?? row.description ?? 'N/A'}`,
            created_at: new Date().toISOString(),
          },
        ])

        const newStatus = row.amount >= Number(matchedInvoice.total_amount) ? 'paid' : 'partial'
        await supabaseAdmin.from('invoices').update({ status: newStatus }).eq('id', matchedInvoice.id)
      } else {
        unmatched++
        errors.push(`Unmatched: ${row.date} KES ${row.amount} - ${row.reference ?? row.description ?? 'no reference'}`)
      }
    }
  } catch (err: any) {
    errors.push(err?.message ?? 'CSV parsing failed')
  }

  return {
    success: errors.length === 0,
    rowsProcessed,
    matched,
    unmatched,
    errors,
    matchedDetails,
  }
}

export async function getUnreconciledInvoices(): Promise<Array<{
  id: string
  invoice_number: string
  billing_month: string
  total_amount: number
  status: string
  tenant_name: string
  unit_number: string | null
}>> {
  const { agencyId } = await getUserAgencyContext()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invoices')
    .select(`
      id, invoice_number, billing_month, total_amount, status,
      tenants ( first_name, last_name ),
      units ( unit_number )
    `)
    .eq('agency_id', agencyId)
    .in('status', ['unpaid', 'partial'])
    .order('billing_month', { ascending: true })

  if (error || !data) return []

  return data.map((inv: any) => {
    const tenant = inv.tenants?.[0] ?? null
    const unit = inv.units?.[0] ?? null
    return {
      id: inv.id,
      invoice_number: inv.invoice_number,
      billing_month: inv.billing_month,
      total_amount: Number(inv.total_amount),
      status: inv.status,
      tenant_name: `${tenant?.first_name ?? ''} ${tenant?.last_name ?? ''}`.trim() || 'Unknown',
      unit_number: unit?.unit_number ?? null,
    }
  })
}
