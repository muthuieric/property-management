'use server'

import { createClient } from '@/utils/supabase/server'

export interface TenantInvoice {
  id: string
  invoiceNumber: string | null
  billingMonth: string
  baseRentAmount: number
  serviceChargeAmount: number
  vatAmount: number
  interestPenaltyAmount: number
  totalAmount: number
  status: string
  pdfUrl: string | null
  createdAt: string
  unitNumber: string | null
  propertyName: string | null
}

export interface TenantReceipt {
  id: string
  receiptId: string | null
  amount: number
  paymentMethod: string | null
  transactionDate: string | null
  status: string | null
  unitNumber: string | null
  propertyName: string | null
}

export interface TenantProfile {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone_number: string | null
  unitNumber: string | null
  propertyName: string | null
  leaseStartDate: string | null
  leaseEndDate: string | null
  baseRent: number | null
  escalationPercentage: number | null
  leaseStatus: string | null
  leaseId: string | null
  documentUrl: string | null
}

export async function getTenantProfile(): Promise<{
  profile: TenantProfile | null
  error: string | null
}> {
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return { profile: null, error: 'Not authenticated' }
  }

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select(
      `
      id,
      first_name,
      last_name,
      email,
      phone_number,
      leases (
        id,
        start_date,
        end_date,
        base_rent:units(base_rent),
        escalation_percentage,
        unit_number:units(unit_number),
        property_name:units(properties(name)),
        lease_status,
        document_url
      )
    `
    )
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (error || !tenant) {
    return { profile: null, error: 'Tenant profile not found' }
  }

  const lease = (Array.isArray(tenant.leases) ? tenant.leases[0] : tenant.leases) as any
  const unit = lease?.unit_number as { unit_number: string | null } | null
  const property = lease?.property_name as { name: string | null } | null

  return {
    profile: {
      id: tenant.id,
      first_name: tenant.first_name,
      last_name: tenant.last_name,
      email: tenant.email,
      phone_number: tenant.phone_number,
      unitNumber: unit?.unit_number ?? null,
      propertyName: property?.name ?? null,
      leaseStartDate: lease?.start_date ?? null,
      leaseEndDate: lease?.end_date ?? null,
      baseRent: Number(lease?.base_rent?.base_rent || 0) || null,
      escalationPercentage: lease?.escalation_percentage ?? null,
      leaseStatus: lease?.lease_status ?? null,
      leaseId: lease?.id ?? null,
      documentUrl: lease?.document_url ?? null,
    },
    error: null,
  }
}

export async function getTenantInvoices(): Promise<{
  invoices: TenantInvoice[]
  error: string | null
}> {
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return { invoices: [], error: 'Not authenticated' }
  }

  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (tenantErr || !tenant) {
    return { invoices: [], error: 'Tenant not found' }
  }

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select(
      `
      id,
      invoice_number,
      billing_month,
      base_rent_amount,
      service_charge_amount,
      vat_amount,
      interest_penalty_amount,
      total_amount,
      status,
      pdf_url,
      created_at,
      units ( unit_number, properties ( name ) )
    `
    )
    .eq('tenant_id', tenant.id)
    .order('billing_month', { ascending: false })

  if (error || !invoices) {
    return { invoices: [], error: error?.message ?? 'Failed to fetch invoices' }
  }

  return {
    invoices: invoices.map((inv) => {
      const unit = inv.units as any
      return {
        id: inv.id,
        invoiceNumber: inv.invoice_number ?? null,
        billingMonth: inv.billing_month,
        baseRentAmount: Number(inv.base_rent_amount || 0),
        serviceChargeAmount: Number(inv.service_charge_amount || 0),
        vatAmount: Number(inv.vat_amount || 0),
        interestPenaltyAmount: Number(inv.interest_penalty_amount || 0),
        totalAmount: Number(inv.total_amount || 0),
        status: inv.status,
        pdfUrl: inv.pdf_url ?? null,
        createdAt: inv.created_at,
        unitNumber: unit?.unit_number ?? null,
        propertyName: unit?.properties?.name ?? null,
      }
    }),
    error: null,
  }
}

export async function getTenantReceipts(): Promise<{
  receipts: TenantReceipt[]
  error: string | null
}> {
  const supabase = await createClient()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return { receipts: [], error: 'Not authenticated' }
  }

  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (tenantErr || !tenant) {
    return { receipts: [], error: 'Tenant not found' }
  }

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select(
      `
      id,
      receipt_id,
      amount,
      transaction_date,
      status,
      payment_method,
      description,
      units ( unit_number, properties ( name ) )
    `
    )
    .eq('tenant_id', tenant.id)
    .not('receipt_id', 'is', null)
    .order('transaction_date', { ascending: false })

  if (error || !transactions) {
    return { receipts: [], error: error?.message ?? 'Failed to fetch receipts' }
  }

  return {
    receipts: transactions.map((tx) => {
      const unit = tx.units as any
      return {
        id: tx.id,
        receiptId: tx.receipt_id ?? null,
        amount: Number(tx.amount || 0),
        paymentMethod: tx.payment_method ?? null,
        transactionDate: tx.transaction_date ?? null,
        status: tx.status ?? null,
        unitNumber: unit?.unit_number ?? null,
        propertyName: unit?.properties?.name ?? null,
      }
    }),
    error: null,
  }
}
