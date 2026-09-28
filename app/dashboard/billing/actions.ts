'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getUserAgencyContext } from '@/utils/supabase/get-context'

export interface GenerateInvoicesResult {
  success: boolean
  count: number
  totalAmount: number
  skippedCount?: number
  error?: string
}

export interface InvoiceItem {
  id: string
  tenant_id: string
  lease_id: string
  property_id?: string
  billing_month: string
  base_rent_amount: number
  utilities_amount: number
  total_amount: number
  status: 'unpaid' | 'partial' | 'paid'
  created_at: string
  tenant_name?: string
  tenant_email?: string
  tenant_phone?: string
  unit_number?: string
  property_name?: string
}

/**
 * Normalizes any Date or string into the standard first-of-month date string (YYYY-MM-01).
 */
function normalizeToFirstOfMonth(dateInput: string | Date): string {
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return `${dateInput.slice(0, 7)}-01`
  }
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}$/.test(dateInput)) {
    return `${dateInput}-01`
  }
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

/**
 * Global Monthly Invoice Generator ("Bill All")
 * - Gathers all active leases for the specified property (or all agency properties)
 * - Gathers bundled utility readings (status = 'bundled') for each unit
 * - Inserts/upserts an invoice record in public.invoices
 * - Automatically transitions utility_readings from 'bundled' to 'invoiced'
 * - Records corresponding tenant ledger transactions
 */
export async function generateMonthlyInvoices(
  propertyId: string,
  billingMonthInput: string | Date
): Promise<GenerateInvoicesResult> {
  try {
    const supabase = await createServerClient()
    const { userId, agencyId, role } = await getUserAgencyContext()
    const isOwner = role === 'agency_owner' || role === 'super_admin'

    const billingMonth = normalizeToFirstOfMonth(billingMonthInput)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const admin =
      supabaseUrl && serviceRoleKey
        ? createAdminClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : supabase

    // 1. Identify target properties
    let targetPropertyIds: string[] = []
    if (propertyId && propertyId !== 'ALL') {
      const { data: prop, error: propErr } = await supabase
        .from('properties')
        .select('id, agency_id, manager_id')
        .eq('id', propertyId)
        .maybeSingle()

      if (propErr || !prop) {
        return { success: false, count: 0, totalAmount: 0, error: 'Property not found.' }
      }
      if (prop.agency_id !== agencyId && !isOwner) {
        return { success: false, count: 0, totalAmount: 0, error: 'Unauthorized property access.' }
      }
      if (!isOwner && prop.manager_id !== userId) {
        return { success: false, count: 0, totalAmount: 0, error: 'Unauthorized for this property site.' }
      }
      targetPropertyIds = [prop.id]
    } else {
      // All properties in scope
      let propQuery = supabase.from('properties').select('id, manager_id').eq('agency_id', agencyId)
      if (!isOwner) {
        propQuery = propQuery.eq('manager_id', userId)
      }
      const { data: props } = await propQuery
      targetPropertyIds = (props || []).map((p) => p.id)
    }

    if (targetPropertyIds.length === 0) {
      return { success: false, count: 0, totalAmount: 0, error: 'No managed properties found in scope.' }
    }

    // 2. Fetch all active leases in targeted properties
    const { data: activeLeases, error: leaseErr } = await admin
      .from('leases')
      .select(`
        id,
        tenant_id,
        unit_id,
        deposit_amount,
        is_active,
        lease_status,
        units (
          id,
          unit_number,
          base_rent,
          property_id,
          properties (
            id,
            name,
            agency_id,
            standard_base_rent
          )
        ),
        tenants (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .in('units.property_id', targetPropertyIds)
      .eq('is_active', true)

    if (leaseErr) {
      console.error('Error fetching active leases for billing run:', leaseErr)
      return { success: false, count: 0, totalAmount: 0, error: `Failed to fetch leases: ${leaseErr.message}` }
    }

    if (!activeLeases || activeLeases.length === 0) {
      return {
        success: true,
        count: 0,
        totalAmount: 0,
        error: 'No active leases found in the selected properties to bill.',
      }
    }

    // 3. Fetch existing invoices for this month to guarantee idempotency
    const leaseIds = activeLeases.map((l) => l.id)
    const { data: existingInvoices } = await admin
      .from('invoices')
      .select('id, lease_id')
      .in('lease_id', leaseIds)
      .eq('billing_month', billingMonth)

    const existingInvoiceLeaseMap = new Map<string, string>()
    existingInvoices?.forEach((inv) => {
      existingInvoiceLeaseMap.set(inv.lease_id, inv.id)
    })

    // 4. Fetch all bundled utility readings for units in scope
    const unitIds = Array.from(new Set(activeLeases.map((l) => l.unit_id).filter(Boolean)))
    const { data: bundledReadings } = await admin
      .from('utility_readings')
      .select('id, unit_id, total_charge, consumption, rate_per_unit, reading_date')
      .in('unit_id', unitIds)
      .eq('status', 'bundled')

    // Group bundled readings by unit_id
    const unitBundledReadingsMap = new Map<string, any[]>()
    bundledReadings?.forEach((r) => {
      const list = unitBundledReadingsMap.get(r.unit_id) || []
      list.push(r)
      unitBundledReadingsMap.set(r.unit_id, list)
    })

    let generatedCount = 0
    let totalPortfolioBilled = 0
    let skippedCount = 0
    const processedReadingIds: string[] = []
    const transactionsToInsert: any[] = []

    const formattedMonthName = new Date(billingMonth).toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
    })

    // 5. Process each active lease
    for (const lease of activeLeases) {
      if (!lease.tenant_id || !lease.unit_id) continue

      // Idempotency: skip if already invoiced for this month
      if (existingInvoiceLeaseMap.has(lease.id)) {
        skippedCount++
        continue
      }

      const unit = lease.units as any
      const property = unit?.properties as any
      const propId = unit?.property_id || property?.id
      const unitNumber = unit?.unit_number || 'Unit'
      const propName = property?.name || 'Property Site'

      // Resolve base rent
      const baseRent = Number(unit?.base_rent || property?.standard_base_rent || 0)

      // Resolve bundled utilities
      const unitReadings = unitBundledReadingsMap.get(lease.unit_id) || []
      const utilitiesAmount = unitReadings.reduce(
        (sum: number, r: any) => sum + Number(r.total_charge || 0),
        0
      )
      const totalAmount = Math.round((baseRent + utilitiesAmount) * 100) / 100

      // Collect reading IDs to transition to 'invoiced'
      unitReadings.forEach((r) => processedReadingIds.push(r.id))

      // 5a. Insert invoice
      const { data: newInvoice, error: invErr } = await admin
        .from('invoices')
        .insert([
          {
            agency_id: agencyId,
            property_id: propId,
            tenant_id: lease.tenant_id,
            lease_id: lease.id,
            billing_month: billingMonth,
            base_rent_amount: baseRent,
            utilities_amount: utilitiesAmount,
            total_amount: totalAmount,
            status: 'unpaid',
            created_by: userId,
          },
        ])
        .select('id')
        .single()

      if (invErr) {
        console.error(`Error inserting invoice for lease ${lease.id}:`, invErr)
        continue
      }

      // 5b. Prepare ledger transaction entry
      const description =
        utilitiesAmount > 0
          ? `Monthly Rent & Utilities Invoice (${formattedMonthName}) - Unit ${unitNumber} at ${propName} [Rent: KES ${baseRent.toLocaleString()} + Water: KES ${utilitiesAmount.toLocaleString()}]`
          : `Monthly Rent Invoice (${formattedMonthName}) - Unit ${unitNumber} at ${propName} [Rent: KES ${baseRent.toLocaleString()}]`

      transactionsToInsert.push({
        agency_id: agencyId,
        property_id: propId,
        unit_id: lease.unit_id,
        tenant_id: lease.tenant_id,
        transaction_type: 'expense',
        amount: totalAmount,
        transaction_date: billingMonth,
        description,
      })

      generatedCount++
      totalPortfolioBilled += totalAmount
    }

    // 6. Update processed utility_readings from 'bundled' to 'invoiced'
    if (processedReadingIds.length > 0) {
      await admin
        .from('utility_readings')
        .update({ status: 'invoiced' })
        .in('id', processedReadingIds)
    }

    // 7. Insert synchronized ledger transactions
    if (transactionsToInsert.length > 0) {
      await admin.from('transactions').insert(transactionsToInsert)
    }

    revalidatePath('/dashboard/billing')
    revalidatePath('/dashboard/utilities')
    revalidatePath('/dashboard/financials')
    revalidatePath('/dashboard/clearance')
    revalidatePath('/dashboard/tenants')

    return {
      success: true,
      count: generatedCount,
      totalAmount: totalPortfolioBilled,
      skippedCount,
    }
  } catch (err: unknown) {
    console.error('Unhandled error in generateMonthlyInvoices:', err)
    return {
      success: false,
      count: 0,
      totalAmount: 0,
      error: err instanceof Error ? err.message : 'An error occurred while generating monthly invoices.',
    }
  }
}

/**
 * Fetches invoices for the billing dashboard with joins for tenant and unit.
 */
export async function getMonthlyInvoices(
  propertyId?: string,
  billingMonth?: string
): Promise<InvoiceItem[]> {
  try {
    const supabase = await createServerClient()
    const { userId, agencyId, role } = await getUserAgencyContext()
    const isOwner = role === 'agency_owner' || role === 'super_admin'

    let query = supabase
      .from('invoices')
      .select(`
        id,
        tenant_id,
        lease_id,
        property_id,
        billing_month,
        base_rent_amount,
        utilities_amount,
        total_amount,
        status,
        created_at,
        tenants (
          first_name,
          last_name,
          email,
          phone_number
        ),
        leases (
          id,
          units (
            unit_number,
            properties (
              id,
              name,
              manager_id
            )
          )
        )
      `)
      .order('billing_month', { ascending: false })
      .order('created_at', { ascending: false })

    if (propertyId && propertyId !== 'ALL') {
      query = query.eq('property_id', propertyId)
    }

    if (billingMonth) {
      const normalized = normalizeToFirstOfMonth(billingMonth)
      query = query.eq('billing_month', normalized)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching invoices:', error)
      return []
    }

    let filtered = data || []
    if (!isOwner) {
      filtered = filtered.filter((inv: any) => {
        const prop = inv.leases?.units?.properties
        return prop?.manager_id === userId
      })
    }

    return filtered.map((inv: any) => {
      const tenant = inv.tenants
      const unit = inv.leases?.units
      const property = unit?.properties

      return {
        id: inv.id,
        tenant_id: inv.tenant_id,
        lease_id: inv.lease_id,
        property_id: inv.property_id || property?.id,
        billing_month: inv.billing_month,
        base_rent_amount: Number(inv.base_rent_amount || 0),
        utilities_amount: Number(inv.utilities_amount || 0),
        total_amount: Number(inv.total_amount || 0),
        status: inv.status,
        created_at: inv.created_at,
        tenant_name: `${tenant?.first_name || ''} ${tenant?.last_name || ''}`.trim() || 'Resident',
        tenant_email: tenant?.email || '',
        tenant_phone: tenant?.phone_number || '',
        unit_number: unit?.unit_number || 'N/A',
        property_name: property?.name || 'Property Site',
      }
    })
  } catch (err) {
    console.error('Error in getMonthlyInvoices:', err)
    return []
  }
}

/**
 * Fetches managed properties list for the billing filter selector.
 */
export async function getBillingProperties(): Promise<Array<{ id: string; name: string }>> {
  try {
    const supabase = await createServerClient()
    const { userId, agencyId, role } = await getUserAgencyContext()
    const isOwner = role === 'agency_owner' || role === 'super_admin'

    let query = supabase
      .from('properties')
      .select('id, name, manager_id')
      .eq('agency_id', agencyId)
      .order('name', { ascending: true })

    if (!isOwner) {
      query = query.eq('manager_id', userId)
    }

    const { data } = await query
    return (data || []).map((p) => ({ id: p.id, name: p.name }))
  } catch (err) {
    console.error('Error in getBillingProperties:', err)
    return []
  }
}

/**
 * Updates an invoice status (e.g. to 'paid').
 */
export async function updateInvoiceStatus(
  invoiceId: string,
  newStatus: 'unpaid' | 'partial' | 'paid'
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerClient()
    const { error } = await supabase
      .from('invoices')
      .update({ status: newStatus })
      .eq('id', invoiceId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/billing')
    revalidatePath('/dashboard/financials')

    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update status.',
    }
  }
}

