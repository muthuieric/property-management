'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getUserAgencyContext } from '@/utils/supabase/get-context'
import { maskPhoneNumber } from '@/utils/masking'

export interface TenantProfile {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone_number: string | null
  id_number: string | null
  vehicle_registration?: string | null
  next_of_kin_name?: string | null
  next_of_kin_phone?: string | null
  next_of_kin_relation?: string | null
  is_active: boolean
  created_at: string
}

export interface ActiveLeaseDetails {
  id: string
  unit_id: string
  property_id?: string
  unit_number: string
  property_name: string
  property_address?: string | null
  base_rent: number
  fixed_service_charge?: number
  deposit_amount: number
  start_date: string
  end_date?: string | null
  lease_status?: string | null
}

export interface TenantInvoice {
  id: string
  billing_month: string
  base_rent_amount: number
  utilities_amount: number
  total_amount: number
  status: 'unpaid' | 'partial' | 'paid'
  created_at: string
}

export interface TenantPaymentTransaction {
  id: string
  receipt_id?: string | null
  amount: number
  transaction_date: string
  transaction_type: string
  payment_method: string | null
  external_reference: string | null
  status: 'pending' | 'verified' | 'bounced' | null
  description: string
  created_at: string
}

export interface TenantLedgerData {
  tenant: TenantProfile
  activeLease: ActiveLeaseDetails | null
  invoices: TenantInvoice[]
  transactions: TenantPaymentTransaction[]
  kpi: {
    total_invoiced: number
    total_paid: number
    outstanding_balance: number
  }
}

/**
 * Fetches the comprehensive financial ledger and profile for a specific tenant.
 * Applies PII phone masking if caller is a property coordinator.
 */
export async function getTenantLedger(tenantId: string): Promise<TenantLedgerData | null> {
  try {
    if (!tenantId) return null

    const supabase = await createClient()
    const { agencyId, role } = await getUserAgencyContext()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const admin =
      supabaseUrl && serviceRoleKey
        ? createAdminClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : supabase

    // 1. Fetch Tenant Profile
    const { data: tenantData, error: tenantErr } = await admin
      .from('tenants')
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone_number,
        id_number,
        vehicle_registration,
        next_of_kin_name,
        next_of_kin_phone,
        next_of_kin_relation,
        is_active,
        created_at,
        agency_id,
        user_id
      `)
      .eq('id', tenantId)
      .maybeSingle()

    if (tenantErr || !tenantData) {
      console.error('Error finding tenant:', tenantErr)
      return null
    }

    if (tenantData.agency_id && tenantData.agency_id !== agencyId && role !== 'agency_owner') {
      console.warn('Unauthorized access to tenant from different agency')
      return null
    }

    // Role-based PII Masking: Property managers see masked phone numbers
    const isOwner = role === 'agency_owner'
    const displayedPhone = isOwner
      ? tenantData.phone_number
      : maskPhoneNumber(tenantData.phone_number || '')

    const tenantProfile: TenantProfile = {
      id: tenantData.id,
      first_name: tenantData.first_name,
      last_name: tenantData.last_name,
      email: tenantData.email,
      phone_number: displayedPhone,
      id_number: tenantData.id_number,
      vehicle_registration: tenantData.vehicle_registration,
      next_of_kin_name: tenantData.next_of_kin_name,
      next_of_kin_phone: isOwner
        ? tenantData.next_of_kin_phone
        : maskPhoneNumber(tenantData.next_of_kin_phone || ''),
      next_of_kin_relation: tenantData.next_of_kin_relation,
      is_active: tenantData.is_active !== false,
      created_at: tenantData.created_at,
    }

    // 2. Fetch Active Lease with Unit & Property
    const { data: leaseData } = await admin
      .from('leases')
      .select(`
        id,
        unit_id,
        deposit_amount,
        start_date,
        end_date,
        lease_status,
        is_active,
        units (
          id,
          unit_number,
          base_rent,
          fixed_service_charge,
          property_id,
          properties (
            id,
            name,
            address
          )
        )
      `)
      .eq('tenant_id', tenantId)
      .order('is_active', { ascending: false })
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    let activeLease: ActiveLeaseDetails | null = null
    if (leaseData) {
      const u = leaseData.units as any
      const p = u?.properties as any
      activeLease = {
        id: leaseData.id,
        unit_id: leaseData.unit_id,
        property_id: u?.property_id,
        unit_number: u?.unit_number || 'N/A',
        property_name: p?.name || 'Property Site',
        property_address: p?.address || null,
        base_rent: Number(u?.base_rent || 0),
        fixed_service_charge: Number(u?.fixed_service_charge || 0),
        deposit_amount: Number(leaseData.deposit_amount || 0),
        start_date: leaseData.start_date,
        end_date: leaseData.end_date,
        lease_status: leaseData.lease_status || (leaseData.is_active ? 'active' : 'expired'),
      }
    }

    // 3. Fetch Invoices (Rent + Bundled Utilities)
    const { data: invoicesData } = await admin
      .from('invoices')
      .select(`
        id,
        billing_month,
        base_rent_amount,
        utilities_amount,
        total_amount,
        status,
        created_at
      `)
      .eq('tenant_id', tenantId)
      .order('billing_month', { ascending: false })

    const invoices: TenantInvoice[] = (invoicesData || []).map((inv) => ({
      id: inv.id,
      billing_month: inv.billing_month,
      base_rent_amount: Number(inv.base_rent_amount || 0),
      utilities_amount: Number(inv.utilities_amount || 0),
      total_amount: Number(inv.total_amount || 0),
      status: (inv.status || 'unpaid') as 'unpaid' | 'partial' | 'paid',
      created_at: inv.created_at,
    }))

    // 4. Fetch All Transactions (Payments made)
    // Lookup by tenant_id or linked user_id
    const userOrTenantFilter = tenantData.user_id
      ? `tenant_id.eq.${tenantId},tenant_id.eq.${tenantData.user_id}`
      : `tenant_id.eq.${tenantId}`

    const { data: txData } = await admin
      .from('transactions')
      .select(`
        id,
        receipt_id,
        amount,
        transaction_date,
        transaction_type,
        payment_method,
        external_reference,
        status,
        description,
        created_at
      `)
      .or(userOrTenantFilter)
      .order('transaction_date', { ascending: false })

    const transactions: TenantPaymentTransaction[] = (txData || []).map((tx) => ({
      id: tx.id,
      receipt_id: tx.receipt_id,
      amount: Number(tx.amount || 0),
      transaction_date: tx.transaction_date,
      transaction_type: tx.transaction_type,
      payment_method: tx.payment_method || (tx.description?.includes('MPESA') ? 'MPESA' : 'BANK_TRANSFER'),
      external_reference: tx.external_reference || null,
      status: (tx.status || 'verified') as 'pending' | 'verified' | 'bounced',
      description: tx.description || 'Payment Transaction',
      created_at: tx.created_at,
    }))

    // 5. Calculate KPI Metrics
    // Sum of all billed invoices
    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total_amount, 0)

    // Sum of all cleared/verified payments
    const totalPaid = transactions
      .filter((t) => ['income', 'payment'].includes(t.transaction_type) && t.status !== 'bounced')
      .reduce((sum, t) => sum + t.amount, 0)

    const outstandingBalance = Math.max(0, totalInvoiced - totalPaid)

    return {
      tenant: tenantProfile,
      activeLease,
      invoices,
      transactions,
      kpi: {
        total_invoiced: Math.round(totalInvoiced * 100) / 100,
        total_paid: Math.round(totalPaid * 100) / 100,
        outstanding_balance: Math.round(outstandingBalance * 100) / 100,
      },
    }
  } catch (err) {
    console.error('getTenantLedger error:', err)
    return null
  }
}

export interface RecordManualPaymentInput {
  tenantId: string
  amount: number
  paymentMethod: string
  transactionDate?: string
  referenceCode?: string
  description?: string
}

export interface RecordManualPaymentResult {
  success: boolean
  receipt_id?: string
  transaction_id?: string
  error?: string
}

/**
 * Records a manual payment (Cash, Bank Deposit, Direct Transfer) specifically for a tenant's ledger.
 * Automatically verifies the payment and settles open invoices.
 */
export async function recordTenantManualPayment(
  input: FormData | RecordManualPaymentInput
): Promise<RecordManualPaymentResult> {
  try {
    const supabase = await createClient()
    const { agencyId, userId, role } = await getUserAgencyContext()

    if (!agencyId) {
      return { success: false, error: 'Unauthorized: Missing agency context.' }
    }

    let tenantId = ''
    let amount = 0
    let paymentMethod = 'CASH'
    let transactionDate = ''
    let referenceCode = ''
    let description = ''

    if (input instanceof FormData) {
      tenantId = (input.get('tenantId') as string)?.trim() || ''
      amount = parseFloat((input.get('amount') as string) || '0')
      paymentMethod = (input.get('paymentMethod') as string)?.trim() || 'CASH'
      transactionDate = (input.get('transactionDate') as string)?.trim() || ''
      referenceCode = (input.get('referenceCode') as string)?.trim() || ''
      description = (input.get('description') as string)?.trim() || ''
    } else {
      tenantId = input.tenantId?.trim() || ''
      amount = Number(input.amount || 0)
      paymentMethod = input.paymentMethod?.trim() || 'CASH'
      transactionDate = input.transactionDate?.trim() || ''
      referenceCode = input.referenceCode?.trim() || ''
      description = input.description?.trim() || ''
    }

    if (!tenantId) {
      return { success: false, error: 'Tenant ID is required.' }
    }

    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: 'Payment amount must be greater than zero.' }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const admin =
      supabaseUrl && serviceRoleKey
        ? createAdminClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : supabase

    // Lookup tenant's active lease to identify property & unit
    const { data: lease } = await admin
      .from('leases')
      .select('id, unit_id, agency_id, units(id, unit_number, property_id)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .maybeSingle()

    const unit = lease?.units as any
    const propertyId = unit?.property_id || null
    const unitId = lease?.unit_id || null
    const unitNum = unit?.unit_number || 'Assigned Unit'

    const receipt_id = crypto.randomUUID()
    const txDate = transactionDate || new Date().toISOString().split('T')[0]
    const shortRef = referenceCode || `REC-${receipt_id.slice(0, 8).toUpperCase()}`

    const finalDescription =
      description ||
      `Manual payment [Ref: ${shortRef}] - Unit ${unitNum} (${paymentMethod.toUpperCase()})`

    // Insert verified income transaction
    const { data: newTx, error: txError } = await admin
      .from('transactions')
      .insert([
        {
          agency_id: agencyId,
          property_id: propertyId,
          unit_id: unitId,
          tenant_id: tenantId,
          transaction_type: 'income',
          amount,
          transaction_date: txDate,
          payment_method: paymentMethod.toUpperCase(),
          external_reference: referenceCode || null,
          status: 'verified',
          receipt_id,
          description: finalDescription,
        },
      ])
      .select('id')
      .single()

    if (txError) {
      console.error('Error inserting manual payment:', txError)
      return { success: false, error: txError.message || 'Failed to record manual payment.' }
    }

    // Automatically check for open unpaid or partial invoice for this tenant
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
      const newStatus = amount >= invTotal ? 'paid' : 'partial'
      await admin
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', openInvoice.id)
    }

    revalidatePath(`/dashboard/tenants/${tenantId}`)
    revalidatePath('/dashboard/tenants')
    revalidatePath('/dashboard/financials')
    revalidatePath('/dashboard/billing')
    revalidatePath('/portal')

    return {
      success: true,
      receipt_id,
      transaction_id: newTx?.id,
    }
  } catch (err: any) {
    console.error('recordTenantManualPayment exception:', err)
    return { success: false, error: err?.message || 'Server error while recording payment.' }
  }
}

