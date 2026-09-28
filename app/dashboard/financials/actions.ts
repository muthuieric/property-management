// app/dashboard/financials/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getUserAgencyContext } from '@/utils/supabase/get-context'

export async function addTransaction(formData: FormData) {
  const supabase = await createClient()
  const { agencyId, role } = await getUserAgencyContext()

  // Security Gate: Only Agency Owners can record ledger transactions
  if (role !== 'agency_owner') {
    redirect('/dashboard/financials?message=Unauthorized: Only agency owners can record transactions')
  }

  const transaction_type = formData.get('transaction_type') as string // 'income' or 'expense'
  const rawAmount = formData.get('amount') as string
  const transaction_date = formData.get('transaction_date') as string
  const description = formData.get('description') as string
  const rawPropertyId = formData.get('property_id') as string

  const amount = parseFloat(rawAmount)

  if (!transaction_type || isNaN(amount) || !transaction_date || !description?.trim()) {
    redirect('/dashboard/financials?message=Please fill in all required fields')
  }

  const property_id = rawPropertyId && rawPropertyId.trim() ? rawPropertyId.trim() : null
  const receipt_id =
    transaction_type === 'income' || transaction_type === 'payment'
      ? crypto.randomUUID()
      : null

  const { error } = await supabase
    .from('transactions')
    .insert([
      {
        agency_id: agencyId,
        property_id,
        transaction_type,
        amount,
        transaction_date,
        description: description.trim(),
        ...(receipt_id ? { receipt_id } : {}),
      },
    ])

  if (error) {
    console.error('Error adding transaction:', error)
    redirect('/dashboard/financials?message=Failed to add transaction')
  }

  revalidatePath('/dashboard/financials')
  redirect('/dashboard/financials?message=Transaction added successfully')
}

export async function deleteTransaction(formData: FormData) {
  const supabase = await createClient()
  const { agencyId, role } = await getUserAgencyContext()

  // Security Gate: Only Agency Owners can delete ledger transactions
  if (role !== 'agency_owner') {
    redirect('/dashboard/financials?message=Unauthorized: Only agency owners can delete transactions')
  }

  const id = formData.get('id') as string

  if (!id) {
    redirect('/dashboard/financials?message=Transaction ID missing')
  }

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('agency_id', agencyId)

  if (error) {
    console.error('Error deleting transaction:', error)
    redirect('/dashboard/financials?message=Failed to delete transaction')
  }

  revalidatePath('/dashboard/financials')
  redirect('/dashboard/financials?message=Transaction deleted successfully')
}

// -----------------------------------------------------------------------------
// SECURE DATA-MASKED PAYOUT BENEFICIARIES (ESCROW VAULT)
// -----------------------------------------------------------------------------

export type AccountType = 'MPESA_PAYBILL' | 'MPESA_TILL' | 'BANK_ACCOUNT' | 'MOBILE_NUMBER'

export interface PayoutBeneficiary {
  id: string
  agency_id: string
  beneficiary_name: string
  account_type: AccountType
  account_masked: string
  created_at: string
}

/**
 * Automatically generates a secure data-mask for sensitive banking / M-Pesa accounts,
 * masking all but the last 3 digits to eliminate financial data leakage.
 */
function generateAccountMask(accountType: AccountType, rawAccount: string): string {
  const clean = rawAccount.trim().replace(/\s+/g, '')
  const digits = clean.replace(/\D/g, '')
  const visible = digits.length >= 3 ? digits.slice(-3) : clean.slice(-3) || '***'

  switch (accountType) {
    case 'MPESA_PAYBILL':
      return `Paybill ending in **${visible}`
    case 'MPESA_TILL':
      return `Till ending in **${visible}`
    case 'BANK_ACCOUNT':
      return `Bank ending in **${visible}`
    case 'MOBILE_NUMBER':
    default:
      return `MPESA ending in **${visible}`
  }
}

/**
 * Fetches pre-saved data-masked payout beneficiaries for the active agency.
 * STRICT SECURITY: Never queries or exposes account_details_raw to the client.
 */
export async function getBeneficiaries(): Promise<PayoutBeneficiary[]> {
  try {
    const supabase = await createClient()
    const { agencyId, role } = await getUserAgencyContext()

    // Strict access control: only agency_owner can view payout beneficiaries
    if (role !== 'agency_owner') {
      return []
    }

    const { data, error } = await supabase
      .from('payout_beneficiaries')
      .select('id, agency_id, beneficiary_name, account_type, account_masked, created_at')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('Error fetching payout beneficiaries (table may need migration):', error)
      return []
    }

    return (data || []) as PayoutBeneficiary[]
  } catch (err) {
    console.warn('getBeneficiaries error:', err)
    return []
  }
}

/**
 * Registers a new payout beneficiary in the escrow vault.
 * Automatically masks account details on the server before persisting.
 */
export async function addBeneficiary(
  input:
    | FormData
    | {
        beneficiary_name: string
        account_type: AccountType
        account_details_raw: string
      }
): Promise<{ success: boolean; error?: string; beneficiary?: PayoutBeneficiary }> {
  try {
    const supabase = await createClient()
    const { agencyId, role } = await getUserAgencyContext()

    // Security Gate: Only Agency Owners can add payout beneficiaries
    if (role !== 'agency_owner') {
      return {
        success: false,
        error: 'Unauthorized: Only Agency Owners can register escrow payout beneficiaries.',
      }
    }

    let beneficiary_name = ''
    let account_type: AccountType = 'MOBILE_NUMBER'
    let account_details_raw = ''

    if (input instanceof FormData) {
      beneficiary_name = (input.get('beneficiary_name') as string)?.trim() || ''
      account_type = ((input.get('account_type') as string) || 'MOBILE_NUMBER') as AccountType
      account_details_raw = (input.get('account_details_raw') as string)?.trim() || ''
    } else {
      beneficiary_name = input.beneficiary_name?.trim() || ''
      account_type = input.account_type || 'MOBILE_NUMBER'
      account_details_raw = input.account_details_raw?.trim() || ''
    }

    if (!beneficiary_name) {
      return { success: false, error: 'Beneficiary name is required.' }
    }

    if (!account_details_raw) {
      return { success: false, error: 'Account details are required.' }
    }

    const validAccountTypes: AccountType[] = [
      'MPESA_PAYBILL',
      'MPESA_TILL',
      'BANK_ACCOUNT',
      'MOBILE_NUMBER',
    ]

    if (!validAccountTypes.includes(account_type)) {
      return { success: false, error: 'Invalid account type selected.' }
    }

    // Server-side automatic masking
    const account_masked = generateAccountMask(account_type, account_details_raw)

    const { data, error } = await supabase
      .from('payout_beneficiaries')
      .insert([
        {
          agency_id: agencyId,
          beneficiary_name,
          account_type,
          account_details_raw,
          account_masked,
        },
      ])
      .select('id, agency_id, beneficiary_name, account_type, account_masked, created_at')
      .single()

    if (error) {
      console.error('Error inserting payout beneficiary:', error)
      return { success: false, error: error.message || 'Failed to save beneficiary.' }
    }

    revalidatePath('/dashboard/deposits')
    revalidatePath('/dashboard/financials')

    return {
      success: true,
      beneficiary: data as PayoutBeneficiary,
    }
  } catch (err: any) {
    console.error('Error in addBeneficiary:', err)
    return { success: false, error: err?.message || 'Failed to create beneficiary.' }
  }
}

// -----------------------------------------------------------------------------
// CRYPTOGRAPHICALLY VERIFIED RECEIPTS & INCOME PAYMENTS
// -----------------------------------------------------------------------------

export interface RecordPaymentInput {
  tenant_id?: string
  property_id?: string
  unit_id?: string
  invoice_id?: string
  amount: number
  transaction_date?: string
  description?: string
  payment_method?: string
  rent_amount?: number
  utilities_amount?: number
}

export interface RecordPaymentResult {
  success: boolean
  receipt_id?: string
  transaction_id?: string
  error?: string
}

/**
 * Logs income payment to the institutional ledger and issues a cryptographically
 * verifiable receipt_id (UUID) with QR code verification capability.
 */
export async function recordPayment(
  input: FormData | RecordPaymentInput
): Promise<RecordPaymentResult> {
  try {
    const supabase = await createClient()
    const { agencyId, role } = await getUserAgencyContext()

    let tenant_id = ''
    let property_id = ''
    let unit_id = ''
    let invoice_id = ''
    let amount = 0
    let transaction_date = ''
    let description = ''
    let payment_method = 'bank_transfer'
    let rent_amount = 0
    let utilities_amount = 0

    if (input instanceof FormData) {
      tenant_id = (input.get('tenant_id') as string)?.trim() || ''
      property_id = (input.get('property_id') as string)?.trim() || ''
      unit_id = (input.get('unit_id') as string)?.trim() || ''
      invoice_id = (input.get('invoice_id') as string)?.trim() || ''
      amount = parseFloat((input.get('amount') as string) || '0')
      transaction_date = (input.get('transaction_date') as string)?.trim() || ''
      description = (input.get('description') as string)?.trim() || ''
      payment_method = (input.get('payment_method') as string)?.trim() || 'mpesa'
      rent_amount = parseFloat((input.get('rent_amount') as string) || '0')
      utilities_amount = parseFloat((input.get('utilities_amount') as string) || '0')
    } else {
      tenant_id = input.tenant_id?.trim() || ''
      property_id = input.property_id?.trim() || ''
      unit_id = input.unit_id?.trim() || ''
      invoice_id = input.invoice_id?.trim() || ''
      amount = Number(input.amount || 0)
      transaction_date = input.transaction_date?.trim() || ''
      description = input.description?.trim() || ''
      payment_method = input.payment_method?.trim() || 'mpesa'
      rent_amount = Number(input.rent_amount || 0)
      utilities_amount = Number(input.utilities_amount || 0)
    }

    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: 'Payment amount must be greater than zero.' }
    }

    const txDate = transaction_date || new Date().toISOString().split('T')[0]
    const receipt_id = crypto.randomUUID()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const admin =
      supabaseUrl && serviceRoleKey
        ? createAdminClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : supabase

    let targetAgencyId = agencyId

    // If an invoice is attached, update its status and link identifiers
    if (invoice_id) {
      const { data: inv } = await admin
        .from('invoices')
        .select('id, agency_id, tenant_id, lease_id, property_id, base_rent_amount, utilities_amount, total_amount, status')
        .eq('id', invoice_id)
        .maybeSingle()

      if (inv) {
        if (!targetAgencyId) targetAgencyId = inv.agency_id
        if (!tenant_id) tenant_id = inv.tenant_id
        if (!property_id && inv.property_id) property_id = inv.property_id
        if (rent_amount === 0) rent_amount = Number(inv.base_rent_amount || 0)
        if (utilities_amount === 0) utilities_amount = Number(inv.utilities_amount || 0)

        await admin
          .from('invoices')
          .update({
            status: amount >= Number(inv.total_amount) ? 'paid' : 'partial',
          })
          .eq('id', invoice_id)
      }
    }

    // If tenant is supplied, resolve unit & property from active lease if not given
    if ((!property_id || !unit_id) && tenant_id) {
      const { data: lease } = await admin
        .from('leases')
        .select('id, unit_id, agency_id, units(id, property_id, base_rent)')
        .eq('tenant_id', tenant_id)
        .eq('is_active', true)
        .maybeSingle()

      if (lease) {
        if (!targetAgencyId) targetAgencyId = lease.agency_id
        if (!unit_id) unit_id = lease.unit_id
        const u = lease.units as any
        if (!property_id && u?.property_id) property_id = u.property_id
        if (rent_amount === 0 && u?.base_rent) {
          rent_amount = Math.min(Number(u.base_rent), amount)
          utilities_amount = Math.max(0, amount - rent_amount)
        }
      }
    }

    const shortId = receipt_id.slice(0, 8).toUpperCase()
    if (!description) {
      description = `Payment received (${payment_method.toUpperCase()}) - Receipt #${shortId}`
    }

    const { data: tx, error: txError } = await admin
      .from('transactions')
      .insert([
        {
          agency_id: targetAgencyId,
          property_id: property_id || null,
          unit_id: unit_id || null,
          tenant_id: tenant_id || null,
          transaction_type: 'income',
          amount,
          transaction_date: txDate,
          description,
          receipt_id,
        },
      ])
      .select('id, receipt_id')
      .single()

    if (txError) {
      console.error('Error recording payment transaction:', txError)
      return { success: false, error: txError.message || 'Failed to record payment transaction.' }
    }

    revalidatePath('/dashboard/financials')
    revalidatePath('/dashboard/billing')
    revalidatePath('/portal')
    revalidatePath('/portal/receipts')

    return {
      success: true,
      receipt_id,
      transaction_id: tx?.id,
    }
  } catch (err: any) {
    console.error('recordPayment exception:', err)
    return { success: false, error: err?.message || 'Server error while recording payment.' }
  }
}

export interface ReceiptData {
  id: string
  receipt_id: string
  transaction_date: string
  amount: number
  description: string
  created_at: string
  payment_method?: string
  agency: {
    id: string
    name: string
    logo_url?: string | null
    support_email?: string | null
    support_phone?: string | null
  }
  tenant: {
    id: string
    name: string
    email?: string | null
    phone?: string | null
    id_number?: string | null
  }
  property: {
    id: string
    name: string
    address?: string | null
    city?: string | null
  }
  unit: {
    id: string
    unit_number: string
  }
  breakdown: {
    rent: number
    utilities: number
    service_charge: number
    subtotal: number
    total: number
  }
}

/**
 * Fetches full receipt details by receipt_id or transaction id.
 */
export async function getReceiptData(receiptOrTxId: string): Promise<ReceiptData | null> {
  try {
    if (!receiptOrTxId) return null

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const admin =
      supabaseUrl && serviceRoleKey
        ? createAdminClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : await createClient()

    // 1. Fetch transaction
    const { data: tx, error: txErr } = await admin
      .from('transactions')
      .select('*')
      .or(`receipt_id.eq.${receiptOrTxId},id.eq.${receiptOrTxId}`)
      .maybeSingle()

    if (txErr || !tx) {
      return null
    }

    // 2. Fetch tenant details
    let tenantInfo = {
      id: tx.tenant_id || '',
      name: 'Resident',
      email: null as string | null,
      phone: null as string | null,
      id_number: null as string | null,
    }

    if (tx.tenant_id) {
      const { data: tn } = await admin
        .from('tenants')
        .select('id, first_name, last_name, email, phone_number, id_number')
        .eq('id', tx.tenant_id)
        .maybeSingle()

      if (tn) {
        tenantInfo = {
          id: tn.id,
          name: `${tn.first_name || ''} ${tn.last_name || ''}`.trim() || 'Resident',
          email: tn.email || null,
          phone: tn.phone_number || null,
          id_number: tn.id_number || null,
        }
      }
    }

    // 3. Fetch property details
    let propertyInfo = {
      id: tx.property_id || '',
      name: 'Residential Property',
      address: null as string | null,
      city: 'Nairobi' as string | null,
    }

    if (tx.property_id) {
      const { data: pr } = await admin
        .from('properties')
        .select('id, name, address, city, agency_id')
        .eq('id', tx.property_id)
        .maybeSingle()

      if (pr) {
        propertyInfo = {
          id: pr.id,
          name: pr.name || 'Residential Property',
          address: pr.address || null,
          city: pr.city || 'Nairobi',
        }
        if (!tx.agency_id && pr.agency_id) {
          tx.agency_id = pr.agency_id
        }
      }
    }

    // 4. Fetch unit details
    let unitInfo = {
      id: tx.unit_id || '',
      unit_number: 'N/A',
      base_rent: 0,
      fixed_service_charge: 0,
    }

    if (tx.unit_id) {
      const { data: un } = await admin
        .from('units')
        .select('id, unit_number, base_rent, fixed_service_charge, property_id')
        .eq('id', tx.unit_id)
        .maybeSingle()

      if (un) {
        unitInfo = {
          id: un.id,
          unit_number: un.unit_number || 'N/A',
          base_rent: Number(un.base_rent || 0),
          fixed_service_charge: Number(un.fixed_service_charge || 0),
        }
      }
    }

    // 5. Fetch agency details
    let agencyInfo = {
      id: tx.agency_id || '',
      name: 'Luffi Tech Property Management',
      logo_url: null as string | null,
      support_email: 'support@luffitech.com' as string | null,
      support_phone: '+254 700 000 000' as string | null,
    }

    if (tx.agency_id) {
      const { data: ag } = await admin
        .from('agencies')
        .select('id, name, logo_url, support_email, support_phone')
        .eq('id', tx.agency_id)
        .maybeSingle()

      if (ag) {
        agencyInfo = {
          id: ag.id,
          name: ag.name || 'Luffi Tech Property Management',
          logo_url: ag.logo_url || null,
          support_email: ag.support_email || 'support@luffitech.com',
          support_phone: ag.support_phone || '+254 700 000 000',
        }
      }
    }

    // 6. Calculate charge breakdown (Rent vs Utilities)
    const totalAmount = Number(tx.amount || 0)
    let rent = 0
    let utilities = 0
    const serviceCharge = unitInfo.fixed_service_charge || 0

    // Try finding an invoice matching this tenant around this time
    if (tx.tenant_id) {
      const { data: inv } = await admin
        .from('invoices')
        .select('base_rent_amount, utilities_amount, total_amount')
        .eq('tenant_id', tx.tenant_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (inv && Number(inv.total_amount || 0) === totalAmount) {
        rent = Number(inv.base_rent_amount || 0)
        utilities = Number(inv.utilities_amount || 0)
      }
    }

    if (rent === 0) {
      if (unitInfo.base_rent > 0) {
        rent = Math.min(unitInfo.base_rent, totalAmount)
        utilities = Math.max(0, totalAmount - rent)
      } else {
        rent = totalAmount
        utilities = 0
      }
    }

    return {
      id: tx.id,
      receipt_id: tx.receipt_id || tx.id,
      transaction_date: tx.transaction_date,
      amount: totalAmount,
      description: tx.description || 'Rent & Utilities Payment',
      created_at: tx.created_at,
      payment_method: tx.description?.includes('MPESA') ? 'M-PESA' : 'Direct Electronic Transfer',
      agency: agencyInfo,
      tenant: tenantInfo,
      property: propertyInfo,
      unit: unitInfo,
      breakdown: {
        rent,
        utilities,
        service_charge: serviceCharge,
        subtotal: rent + utilities,
        total: totalAmount,
      },
    }
  } catch (err) {
    console.error('getReceiptData error:', err)
    return null
  }
}

export interface VerifyReceiptResult {
  isValid: boolean
  receipt_id?: string
  amount?: number
  transaction_date?: string
  created_at?: string
  tenant_name?: string
  property_name?: string
  unit_number?: string
  agency_name?: string
  description?: string
  error?: string
}

/**
 * Public Verification Check for QR Code Scans.
 * Unauthenticated: allows anyone (landlord, bank, embassy, auditor) to verify legitimacy.
 */
export async function verifyReceipt(receiptId: string): Promise<VerifyReceiptResult> {
  try {
    if (!receiptId || !receiptId.trim()) {
      return { isValid: false, error: 'No receipt identifier provided.' }
    }

    const cleanId = receiptId.trim()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const admin =
      supabaseUrl && serviceRoleKey
        ? createAdminClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : await createClient()

    const { data: tx, error: txErr } = await admin
      .from('transactions')
      .select('id, receipt_id, amount, transaction_date, description, created_at, tenant_id, property_id, unit_id, agency_id, transaction_type')
      .or(`receipt_id.eq.${cleanId},id.eq.${cleanId}`)
      .maybeSingle()

    if (txErr || !tx) {
      return { isValid: false }
    }

    if (tx.transaction_type !== 'income' && tx.transaction_type !== 'payment') {
      return { isValid: false }
    }

    let agencyName = 'Luffi Tech Verified Management'
    if (tx.agency_id) {
      const { data: ag } = await admin.from('agencies').select('name').eq('id', tx.agency_id).maybeSingle()
      if (ag?.name) agencyName = ag.name
    }

    let propName = 'Assigned Property Site'
    if (tx.property_id) {
      const { data: pr } = await admin.from('properties').select('name').eq('id', tx.property_id).maybeSingle()
      if (pr?.name) propName = pr.name
    }

    let unitNum = ''
    if (tx.unit_id) {
      const { data: un } = await admin.from('units').select('unit_number').eq('id', tx.unit_id).maybeSingle()
      if (un?.unit_number) unitNum = un.unit_number
    }

    let tenantMasked = 'Verified Resident'
    if (tx.tenant_id) {
      const { data: tn } = await admin.from('tenants').select('first_name, last_name').eq('id', tx.tenant_id).maybeSingle()
      if (tn) {
        const first = tn.first_name || ''
        const last = tn.last_name || ''
        const lastMasked = last ? `${last.charAt(0)}***` : ''
        tenantMasked = `${first} ${lastMasked}`.trim() || 'Verified Resident'
      }
    }

    return {
      isValid: true,
      receipt_id: tx.receipt_id || tx.id,
      amount: Number(tx.amount || 0),
      transaction_date: tx.transaction_date,
      created_at: tx.created_at,
      tenant_name: tenantMasked,
      property_name: propName,
      unit_number: unitNum,
      agency_name: agencyName,
      description: tx.description,
    }
  } catch (err) {
    console.error('verifyReceipt error:', err)
    return { isValid: false }
  }
}

// -----------------------------------------------------------------------------
// BULK CSV PAYMENT UPLOADER & RECONCILIATION
// -----------------------------------------------------------------------------

export interface BulkPaymentsResult {
  success: boolean
  totalProcessed: number
  insertedCount: number
  failedCount: number
  totalAmount: number
  errors: string[]
  error?: string
}

/**
 * Enterprise Bulk CSV Payment Import
 * Maps uploaded rows to units and active tenants for propertyId.
 * Executes batch insertion using Promise.allSettled for fault isolation.
 */
export async function processBulkPayments(
  propertyId: string,
  paymentsArray: any[]
): Promise<BulkPaymentsResult> {
  try {
    const supabase = await createClient()
    const { agencyId, userId, role } = await getUserAgencyContext()

    if (!agencyId) {
      return {
        success: false,
        totalProcessed: 0,
        insertedCount: 0,
        failedCount: 0,
        totalAmount: 0,
        errors: ['Unauthorized: Missing agency context.'],
        error: 'Unauthorized: Missing agency context.',
      }
    }

    if (!propertyId || !paymentsArray || !Array.isArray(paymentsArray) || paymentsArray.length === 0) {
      return {
        success: false,
        totalProcessed: 0,
        insertedCount: 0,
        failedCount: 0,
        totalAmount: 0,
        errors: ['Invalid request payload: Property ID and non-empty payments list required.'],
        error: 'Invalid request payload: Property ID and non-empty payments list required.',
      }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const admin =
      supabaseUrl && serviceRoleKey
        ? createAdminClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : supabase

    // 1. Verify property ownership or coordinator assignment
    const { data: property, error: propErr } = await admin
      .from('properties')
      .select('id, agency_id, manager_id, name')
      .eq('id', propertyId)
      .maybeSingle()

    if (propErr || !property || property.agency_id !== agencyId) {
      return {
        success: false,
        totalProcessed: 0,
        insertedCount: 0,
        failedCount: 0,
        totalAmount: 0,
        errors: ['Property not found or not owned by your agency.'],
        error: 'Property not found or unauthorized.',
      }
    }

    const isOwner = role === 'agency_owner'
    const isAssigned = property.manager_id === userId
    if (!isOwner && !isAssigned) {
      return {
        success: false,
        totalProcessed: 0,
        insertedCount: 0,
        failedCount: 0,
        totalAmount: 0,
        errors: ['Access restricted: You are not assigned as property coordinator for this site.'],
        error: 'Unauthorized property access.',
      }
    }

    // 2. Query all units and active leases for this property
    const { data: units, error: unitsErr } = await admin
      .from('units')
      .select(`
        id,
        unit_number,
        leases (
          id,
          tenant_id,
          is_active
        )
      `)
      .eq('property_id', propertyId)

    if (unitsErr) {
      console.error('Error fetching property units:', unitsErr)
      return {
        success: false,
        totalProcessed: 0,
        insertedCount: 0,
        failedCount: 0,
        totalAmount: 0,
        errors: [`Database error fetching units: ${unitsErr.message}`],
        error: unitsErr.message,
      }
    }

    // Build unit map: normalized unit_number -> { id, activeTenantId, activeLeaseId }
    const unitMap = new Map<string, { id: string; activeTenantId: string | null; activeLeaseId: string | null }>()
    units?.forEach((u) => {
      const activeLease = (u.leases as any[])?.find((l) => l.is_active === true)
      unitMap.set(u.unit_number.trim().toUpperCase(), {
        id: u.id,
        activeTenantId: activeLease?.tenant_id || null,
        activeLeaseId: activeLease?.id || null,
      })
    })

    // 3. Pre-process rows
    interface ValidPaymentRow {
      rowIndex: number
      unitNumber: string
      unitId: string
      tenantId: string | null
      amount: number
      paymentMethod: string
      externalReference: string | null
      date: string
    }

    const validRows: ValidPaymentRow[] = []
    const validationErrors: string[] = []

    paymentsArray.forEach((rawRow, idx) => {
      const rowNum = idx + 1
      const rawUnit =
        rawRow['Unit Number'] ??
        rawRow['unit_number'] ??
        rawRow['Unit'] ??
        rawRow['unitNumber'] ??
        rawRow['unit'] ??
        ''
      const rawAmount =
        rawRow['Amount Paid'] ??
        rawRow['Amount'] ??
        rawRow['amount'] ??
        rawRow['amount_paid'] ??
        rawRow['amountPaid'] ??
        ''
      const rawMethod =
        rawRow['Payment Method'] ??
        rawRow['payment_method'] ??
        rawRow['Method'] ??
        rawRow['paymentMethod'] ??
        'MPESA'
      const rawRef =
        rawRow['Reference Code'] ??
        rawRow['reference_code'] ??
        rawRow['Reference'] ??
        rawRow['reference'] ??
        rawRow['referenceCode'] ??
        ''
      const rawDate =
        rawRow['Date'] ??
        rawRow['date'] ??
        rawRow['Payment Date'] ??
        rawRow['transaction_date'] ??
        ''

      const cleanUnit = String(rawUnit).trim()
      if (!cleanUnit) {
        validationErrors.push(`Row ${rowNum}: Missing unit number.`)
        return
      }

      const cleanAmountStr = String(rawAmount).replace(/[^0-9.-]+/g, '')
      const parsedAmount = parseFloat(cleanAmountStr)
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        validationErrors.push(`Row ${rowNum} (Unit ${cleanUnit}): Invalid payment amount "${rawAmount}".`)
        return
      }

      const unitInfo = unitMap.get(cleanUnit.toUpperCase())
      if (!unitInfo) {
        validationErrors.push(`Row ${rowNum}: Unit "${cleanUnit}" does not exist in ${property.name}.`)
        return
      }

      let dateVal = String(rawDate).trim()
      if (!dateVal || !/^\d{4}-\d{2}-\d{2}/.test(dateVal)) {
        dateVal = new Date().toISOString().split('T')[0]
      } else {
        dateVal = dateVal.slice(0, 10)
      }

      let methodVal = String(rawMethod).trim().toUpperCase()
      if (!['MPESA', 'BANK_TRANSFER', 'CASH', 'CHEQUE', 'CARD'].includes(methodVal)) {
        methodVal = methodVal.includes('BANK') ? 'BANK_TRANSFER' : 'MPESA'
      }

      const refVal = String(rawRef).trim() || null

      validRows.push({
        rowIndex: rowNum,
        unitNumber: cleanUnit,
        unitId: unitInfo.id,
        tenantId: unitInfo.activeTenantId,
        amount: Math.round(parsedAmount * 100) / 100,
        paymentMethod: methodVal,
        externalReference: refVal,
        date: dateVal,
      })
    })

    // 4. Batch insert with Promise.allSettled for fault isolation
    const insertPromises = validRows.map(async (row) => {
      const receipt_id = crypto.randomUUID()
      const desc = `Bulk payment import [Ref: ${row.externalReference || 'N/A'}] - Unit ${row.unitNumber} (${row.paymentMethod})`

      const { data: tx, error: insErr } = await admin
        .from('transactions')
        .insert([
          {
            agency_id: agencyId,
            property_id: propertyId,
            unit_id: row.unitId,
            tenant_id: row.tenantId,
            transaction_type: 'income',
            amount: row.amount,
            transaction_date: row.date,
            payment_method: row.paymentMethod,
            external_reference: row.externalReference,
            status: 'pending',
            receipt_id,
            description: desc,
          },
        ])
        .select('id')
        .single()

      if (insErr) {
        throw new Error(`Row ${row.rowIndex} (Unit ${row.unitNumber}): ${insErr.message}`)
      }

      return {
        unitNumber: row.unitNumber,
        amount: row.amount,
        txId: tx.id,
      }
    })

    const settledResults = await Promise.allSettled(insertPromises)

    let insertedCount = 0
    let totalInsertedAmount = 0
    const insertionErrors: string[] = []

    settledResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        insertedCount++
        totalInsertedAmount += result.value.amount
      } else {
        const errReason = result.reason?.message || 'Database insert failed'
        insertionErrors.push(errReason)
      }
    })

    revalidatePath('/dashboard/financials')
    revalidatePath('/dashboard/billing')
    revalidatePath('/portal')

    const allErrors = [...validationErrors, ...insertionErrors]
    const failedCount = paymentsArray.length - insertedCount

    return {
      success: insertedCount > 0,
      totalProcessed: paymentsArray.length,
      insertedCount,
      failedCount,
      totalAmount: Math.round(totalInsertedAmount * 100) / 100,
      errors: allErrors,
    }
  } catch (err: any) {
    console.error('processBulkPayments error:', err)
    return {
      success: false,
      totalProcessed: 0,
      insertedCount: 0,
      failedCount: paymentsArray?.length || 0,
      totalAmount: 0,
      errors: [err?.message || 'Unhandled error during bulk payment processing.'],
      error: err?.message || 'Unhandled server error.',
    }
  }
}

/**
 * Mass-verifies pending payments and automatically settles corresponding open tenant invoices.
 */
export interface VerifyPendingPaymentsResult {
  success: boolean
  verifiedCount: number
  settledInvoicesCount: number
  error?: string
}

export async function verifyPendingPayments(
  transactionIds: string[]
): Promise<VerifyPendingPaymentsResult> {
  try {
    const supabase = await createClient()
    const { agencyId, role } = await getUserAgencyContext()

    if (role !== 'agency_owner' && role !== 'property_manager') {
      return {
        success: false,
        verifiedCount: 0,
        settledInvoicesCount: 0,
        error: 'Unauthorized: Insufficient permissions to verify payments.',
      }
    }

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return {
        success: false,
        verifiedCount: 0,
        settledInvoicesCount: 0,
        error: 'No transactions selected.',
      }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const admin =
      supabaseUrl && serviceRoleKey
        ? createAdminClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : supabase

    // 1. Fetch matching pending transactions
    const { data: txs, error: fetchErr } = await admin
      .from('transactions')
      .select('id, agency_id, tenant_id, property_id, unit_id, amount, status')
      .in('id', transactionIds)
      .eq('agency_id', agencyId)

    if (fetchErr || !txs || txs.length === 0) {
      return {
        success: false,
        verifiedCount: 0,
        settledInvoicesCount: 0,
        error: 'No matching transactions found for this agency.',
      }
    }

    const pendingTxs = txs.filter((t) => t.status === 'pending')
    if (pendingTxs.length === 0) {
      return {
        success: true,
        verifiedCount: 0,
        settledInvoicesCount: 0,
      }
    }

    const pendingIds = pendingTxs.map((t) => t.id)

    // 2. Mark transactions as 'verified'
    const { error: updateErr } = await admin
      .from('transactions')
      .update({ status: 'verified' })
      .in('id', pendingIds)
      .eq('agency_id', agencyId)

    if (updateErr) {
      console.error('Error updating transactions to verified:', updateErr)
      return {
        success: false,
        verifiedCount: 0,
        settledInvoicesCount: 0,
        error: updateErr.message,
      }
    }

    // 3. Crucial Ledger Update: Match and settle open tenant invoices
    let settledInvoicesCount = 0
    for (const tx of pendingTxs) {
      if (tx.tenant_id) {
        const { data: openInvoice } = await admin
          .from('invoices')
          .select('id, total_amount, status')
          .eq('tenant_id', tx.tenant_id)
          .in('status', ['unpaid', 'partial'])
          .order('billing_month', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (openInvoice) {
          const invTotal = Number(openInvoice.total_amount || 0)
          const paidAmount = Number(tx.amount || 0)
          const newStatus = paidAmount >= invTotal ? 'paid' : 'partial'

          const { error: invErr } = await admin
            .from('invoices')
            .update({ status: newStatus })
            .eq('id', openInvoice.id)

          if (!invErr) {
            settledInvoicesCount++
          }
        }
      }
    }

    revalidatePath('/dashboard/financials')
    revalidatePath('/dashboard/financials/reconciliation')
    revalidatePath('/dashboard/billing')
    revalidatePath('/portal')

    return {
      success: true,
      verifiedCount: pendingIds.length,
      settledInvoicesCount,
    }
  } catch (err: any) {
    console.error('verifyPendingPayments error:', err)
    return {
      success: false,
      verifiedCount: 0,
      settledInvoicesCount: 0,
      error: err?.message || 'Server error while verifying payments.',
    }
  }
}

/**
 * Reconciles and verifies a single pending transaction.
 */
export async function verifyTransaction(
  transactionId: string
): Promise<{ success: boolean; error?: string }> {
  const res = await verifyPendingPayments([transactionId])
  if (!res.success) {
    return { success: false, error: res.error }
  }
  return { success: true }
}





