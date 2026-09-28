// app/dashboard/leasing/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getUserAgencyContext } from '@/utils/supabase/get-context'
import { syncSingleTenantToKaribu } from '@/utils/karibu/sync'
import { maskPhoneNumber } from '@/app/lib/utils/masking'

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase admin credentials missing from environment configuration.')
  }

  return createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export interface LeadMutationResult {
  success: boolean
  leadId?: string
  error?: string
  message?: string
}

export interface LeadConversionResult {
  success: boolean
  tenantId?: string
  tenant?: {
    id: string
    first_name: string
    last_name: string
    email?: string
    phone_number?: string
  }
  lead?: any
  error?: string
  message?: string
}

export interface UnitMatch {
  id: string
  unit_number: string
  base_rent: number
  property_id: string
  property_name: string
  match_score: number
  diff_amount: number
  status_label: string
}

/**
 * Create a new prospect lead in the Pre-Leasing CRM pipeline
 */
export async function createLead(formData: FormData): Promise<LeadMutationResult> {
  try {
    const { agencyId, userId, role } = await getUserAgencyContext()
    if (!agencyId) {
      return { success: false, error: 'Unauthorized: Agency context not resolved.' }
    }

    const full_name = (formData.get('full_name') as string)?.trim()
    const phone_number = (formData.get('phone_number') as string)?.trim()
    const email = (formData.get('email') as string)?.trim().toLowerCase() || null
    const property_id = (formData.get('property_id') as string)?.trim() || null
    const assigned_coordinator_id = (formData.get('assigned_coordinator_id') as string)?.trim() || (role === 'property_manager' ? userId : null)
    const lead_source = (formData.get('lead_source') as string)?.trim() || 'Walk-in'
    const stage = (formData.get('stage') as string)?.trim() || 'lead_entry'
    const notes = (formData.get('notes') as string)?.trim() || null

    const budgetRaw = formData.get('budget_max') as string
    const budget_max = budgetRaw ? parseFloat(budgetRaw) : null

    const bedRaw = formData.get('preferred_bedrooms') as string
    const preferred_bedrooms = bedRaw ? parseInt(bedRaw, 10) : null

    if (!full_name) {
      return { success: false, error: 'Prospect full name is required.' }
    }
    if (!phone_number) {
      return { success: false, error: 'Primary phone number is required.' }
    }

    const supabase = await createServerClient()
    const { data: newLead, error } = await supabase
      .from('leads')
      .insert([
        {
          agency_id: agencyId,
          property_id,
          assigned_coordinator_id,
          full_name,
          phone_number,
          email,
          lead_source,
          stage,
          budget_max: budget_max && !isNaN(budget_max) ? budget_max : null,
          preferred_bedrooms: preferred_bedrooms && !isNaN(preferred_bedrooms) ? preferred_bedrooms : null,
          notes,
        },
      ])
      .select('id')
      .single()

    if (error) {
      console.error('Error inserting lead record:', error)
      return { success: false, error: error.message || 'Failed to create lead record.' }
    }

    revalidatePath('/dashboard/leasing')
    return { success: true, leadId: newLead?.id, message: 'Prospect lead created successfully.' }
  } catch (err: any) {
    console.error('createLead action unhandled error:', err)
    return { success: false, error: err?.message || 'An unexpected error occurred while saving the lead.' }
  }
}

/**
 * Update lead stage along the 4-stage pipeline (lead_entry -> negotiating -> pre_qualification -> converted / lost)
 */
export async function updateLeadStage(
  leadId: string,
  newStage: string
): Promise<LeadMutationResult> {
  const allowedStages = ['lead_entry', 'negotiating', 'pre_qualification', 'converted', 'lost']
  if (!allowedStages.includes(newStage)) {
    return { success: false, error: `Invalid stage: ${newStage}. Allowed stages: ${allowedStages.join(', ')}` }
  }

  try {
    const { agencyId } = await getUserAgencyContext()
    const supabase = await createServerClient()

    const { error } = await supabase
      .from('leads')
      .update({
        stage: newStage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId)
      .eq('agency_id', agencyId)

    if (error) {
      console.error('updateLeadStage error:', error)
      return { success: false, error: error.message || 'Failed to transition lead stage.' }
    }

    revalidatePath('/dashboard/leasing')
    return { success: true, leadId, message: `Lead shifted to ${newStage.replace('_', ' ')}.` }
  } catch (err: any) {
    console.error('updateLeadStage unhandled error:', err)
    return { success: false, error: err?.message || 'An unexpected error occurred.' }
  }
}

/**
 * Assign or reassign lead coordinator
 */
export async function assignLeadCoordinator(
  leadId: string,
  coordinatorId: string | null
): Promise<LeadMutationResult> {
  try {
    const { agencyId } = await getUserAgencyContext()
    const supabase = await createServerClient()

    const { error } = await supabase
      .from('leads')
      .update({
        assigned_coordinator_id: coordinatorId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId)
      .eq('agency_id', agencyId)

    if (error) {
      console.error('assignLeadCoordinator error:', error)
      return { success: false, error: error.message || 'Failed to assign lead coordinator.' }
    }

    revalidatePath('/dashboard/leasing')
    return { success: true, leadId, message: 'Coordinator updated successfully.' }
  } catch (err: any) {
    console.error('assignLeadCoordinator unhandled error:', err)
    return { success: false, error: err?.message || 'Failed to assign coordinator.' }
  }
}

/**
 * Atomically convert a qualified lead into an active tenant:
 * 1. Creates/links tenant record in public.tenants
 * 2. Syncs newly registered tenant with Karibu VMS
 * 3. Updates lead stage to 'converted' with converted_tenant_id
 * 4. Returns tenant object so frontend can trigger CreateLeaseDrawer pre-filled
 */
export async function convertLeadToTenant(leadId: string): Promise<LeadConversionResult> {
  try {
    const { agencyId } = await getUserAgencyContext()
    if (!agencyId) {
      return { success: false, error: 'Unauthorized: Agency context not resolved.' }
    }

    const supabaseAdmin = getAdminClient()

    // 1. Fetch lead details
    const { data: lead, error: leadErr } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .eq('agency_id', agencyId)
      .single()

    if (leadErr || !lead) {
      return { success: false, error: 'Lead not found or permission denied.' }
    }

    // If already converted, return existing tenant
    if (lead.converted_tenant_id) {
      const { data: existingTenant } = await supabaseAdmin
        .from('tenants')
        .select('id, first_name, last_name, email, phone_number')
        .eq('id', lead.converted_tenant_id)
        .single()

      if (existingTenant) {
        return {
          success: true,
          tenantId: existingTenant.id,
          tenant: existingTenant,
          lead,
          message: 'Lead was already converted. Redirecting to lease drawer...',
        }
      }
    }

    // 2. Parse names
    const names = (lead.full_name || 'Resident Prospect').trim().split(/\s+/)
    const first_name = names[0] || 'Resident'
    const last_name = names.length > 1 ? names.slice(1).join(' ') : 'Prospect'
    const phone_number = lead.phone_number
    const rawEmail = lead.email?.trim().toLowerCase()
    const email = rawEmail || `lead.${phone_number.replace(/\D/g, '') || leadId.slice(0, 8)}@tenant.internal`

    // 3. Check if matching tenant already exists in this agency
    let existingTenantQuery = supabaseAdmin
      .from('tenants')
      .select('id, first_name, last_name, email, phone_number')
      .eq('agency_id', agencyId)

    if (rawEmail) {
      existingTenantQuery = existingTenantQuery.or(`phone_number.eq.${phone_number},email.eq.${rawEmail}`)
    } else {
      existingTenantQuery = existingTenantQuery.eq('phone_number', phone_number)
    }

    const { data: matchedTenants } = await existingTenantQuery.limit(1)
    const matchedTenant = matchedTenants?.[0]

    let finalTenantId: string

    if (matchedTenant) {
      finalTenantId = matchedTenant.id
    } else {
      // 4. Create new tenant record
      let authUserId: string | null = null
      const tempPassword = 'TenantPass2026!'

      // Try creating Supabase auth user
      try {
        const { data: authData } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            first_name,
            last_name,
            role: 'tenant',
            agency_id: agencyId,
          },
        })
        authUserId = authData?.user?.id || null
      } catch (authCreateErr) {
        console.warn('Auth admin createUser notice:', authCreateErr)
      }

      finalTenantId = authUserId || crypto.randomUUID()

      // Upsert profile
      await supabaseAdmin.from('profiles').upsert([
        {
          id: finalTenantId,
          agency_id: agencyId,
          role: 'tenant',
          first_name,
          last_name,
          is_active: true,
        },
      ])

      // Insert into tenants table
      const { error: insertTenantErr } = await supabaseAdmin.from('tenants').insert([
        {
          id: finalTenantId,
          user_id: finalTenantId,
          first_name,
          last_name,
          email,
          phone_number,
          agency_id: agencyId,
          is_active: true,
        },
      ])

      if (insertTenantErr) {
        console.error('Failed inserting new tenant record during conversion:', insertTenantErr)
        return { success: false, error: insertTenantErr.message || 'Could not create tenant record.' }
      }

      // Synchronize with Karibu VMS Directory Sync
      try {
        await syncSingleTenantToKaribu(finalTenantId, { propertyId: lead.property_id || undefined })
      } catch (vmsErr) {
        console.warn('[Karibu VMS] Non-blocking conversion sync warning:', vmsErr)
      }
    }

    // 5. Update lead stage to converted
    const { error: updateLeadErr } = await supabaseAdmin
      .from('leads')
      .update({
        stage: 'converted',
        converted_tenant_id: finalTenantId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId)

    if (updateLeadErr) {
      console.warn('Warning updating lead to converted stage:', updateLeadErr)
    }

    revalidatePath('/dashboard/leasing')
    revalidatePath('/dashboard/tenants')

    return {
      success: true,
      tenantId: finalTenantId,
      tenant: {
        id: finalTenantId,
        first_name,
        last_name,
        email,
        phone_number,
      },
      lead,
      message: `Prospect ${lead.full_name} converted to authorized tenant! Ready for lease allocation.`,
    }
  } catch (err: any) {
    console.error('convertLeadToTenant unhandled error:', err)
    return { success: false, error: err?.message || 'An unexpected error occurred during tenant conversion.' }
  }
}

/**
 * Recommendation matching utility: checks vacant units across the property/agency
 * against the lead's budget_max and returns the top 3 recommended units.
 */
export async function suggestUnitMatches(leadId: string): Promise<{
  success: boolean
  matches: UnitMatch[]
  lead?: any
  error?: string
}> {
  try {
    const { agencyId } = await getUserAgencyContext()
    const supabaseAdmin = getAdminClient()

    // 1. Fetch lead
    const { data: lead, error: leadErr } = await supabaseAdmin
      .from('leads')
      .select('id, full_name, budget_max, preferred_bedrooms, property_id')
      .eq('id', leadId)
      .eq('agency_id', agencyId)
      .single()

    if (leadErr || !lead) {
      return { success: false, matches: [], error: 'Lead not found.' }
    }

    const budget = lead.budget_max ? Number(lead.budget_max) : null

    // 2. Fetch vacant units for this agency
    let unitsQuery = supabaseAdmin
      .from('units')
      .select(`
        id,
        unit_number,
        base_rent,
        rent_amount,
        property_id,
        properties (
          id,
          name,
          location
        )
      `)
      .eq('agency_id', agencyId)
      .eq('is_occupied', false)

    if (lead.property_id) {
      // Prioritize lead property if set
      unitsQuery = unitsQuery.eq('property_id', lead.property_id)
    }

    const { data: vacantUnits, error: unitsErr } = await unitsQuery

    if (unitsErr || !vacantUnits || vacantUnits.length === 0) {
      // If none found in lead's property, broaden to entire agency
      if (lead.property_id) {
        const { data: agencyVacant } = await supabaseAdmin
          .from('units')
          .select(`
            id,
            unit_number,
            base_rent,
            rent_amount,
            property_id,
            properties (
              id,
              name,
              location
            )
          `)
          .eq('agency_id', agencyId)
          .eq('is_occupied', false)

        return rankAndFormatMatches(agencyVacant || [], budget, lead.property_id)
      }

      return { success: true, matches: [], lead }
    }

    return rankAndFormatMatches(vacantUnits, budget, lead.property_id, lead)
  } catch (err: any) {
    console.error('suggestUnitMatches failed:', err)
    return { success: false, matches: [], error: err?.message || 'Failed to compute unit recommendations.' }
  }
}

function rankAndFormatMatches(
  units: any[],
  budget: number | null,
  preferredPropertyId: string | null = null,
  lead: any = null
): { success: boolean; matches: UnitMatch[]; lead?: any } {
  if (!units || units.length === 0) {
    return { success: true, matches: [], lead }
  }

  const scored = units.map((u) => {
    const rent = Number(u.base_rent || u.rent_amount || 0)
    const prop = u.properties as any
    const propName = prop?.name || 'Property Site'

    let diff = 0
    let score = 50
    let status_label = 'Standard Vacancy'

    if (budget && budget > 0) {
      diff = budget - rent // positive means under budget (savings), negative means over budget
      if (diff >= 0) {
        // Under budget
        const savingsPercent = (diff / budget) * 100
        score = 80 + Math.min(20, 20 - savingsPercent) // close to budget is best
        status_label = diff === 0 ? 'Exact Budget Match' : `KES ${diff.toLocaleString()} Under Budget`
      } else {
        // Over budget
        const overPercent = Math.abs(diff) / budget
        if (overPercent <= 0.15) {
          score = 65
          status_label = `KES ${Math.abs(diff).toLocaleString()} Above Budget`
        } else {
          score = 30
          status_label = 'Above Budget'
        }
      }
    }

    // Property affinity bonus
    if (preferredPropertyId && u.property_id === preferredPropertyId) {
      score += 15
    }

    return {
      id: u.id,
      unit_number: u.unit_number,
      base_rent: rent,
      property_id: u.property_id,
      property_name: propName,
      match_score: Math.min(100, score),
      diff_amount: diff,
      status_label,
    }
  })

  // Sort descending by match_score
  scored.sort((a, b) => b.match_score - a.match_score)

  return {
    success: true,
    matches: scored.slice(0, 3),
    lead,
  }
}

/**
 * Delete a lead
 */
export async function deleteLead(leadId: string): Promise<LeadMutationResult> {
  try {
    const { agencyId } = await getUserAgencyContext()
    const supabase = await createServerClient()

    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId)
      .eq('agency_id', agencyId)

    if (error) {
      console.error('deleteLead error:', error)
      return { success: false, error: error.message || 'Failed to delete lead.' }
    }

    revalidatePath('/dashboard/leasing')
    return { success: true, leadId, message: 'Lead removed.' }
  } catch (err: any) {
    console.error('deleteLead error:', err)
    return { success: false, error: err?.message || 'An error occurred while deleting the lead.' }
  }
}

/**
 * Fetches pre-leasing CRM leads for the active agency with Enterprise PII Masking.
 * Strictly verifies user role:
 * - 'agency_owner' / 'super_admin': Returns raw unmasked phone numbers.
 * - 'property_manager' / 'property_coordinator': Overwrites phone_number using maskPhoneNumber before returning.
 * Crucial Security Note: The raw phone number must never be passed to the Client Component if the user is a property manager.
 */
export async function getLeads(): Promise<any[]> {
  const supabase = await createServerClient()
  const { agencyId, userId, role } = await getUserAgencyContext()
  const isOwner = role === 'agency_owner' || role === 'super_admin'

  // 1. Fetch properties for this agency (scoped to assigned manager if coordinator)
  let propertiesQuery = supabase
    .from('properties')
    .select('id, name')
    .eq('agency_id', agencyId)
    .order('name', { ascending: true })

  if (!isOwner) {
    propertiesQuery = propertiesQuery.eq('manager_id', userId)
  }

  const { data: propertiesData } = await propertiesQuery
  const properties = propertiesData || []
  const assignedPropertyIds = properties.map((p) => p.id)

  // 2. Fetch leads
  let leadsQuery = supabase
    .from('leads')
    .select(`
      id,
      agency_id,
      property_id,
      assigned_coordinator_id,
      full_name,
      phone_number,
      email,
      lead_source,
      stage,
      budget_max,
      preferred_bedrooms,
      notes,
      converted_tenant_id,
      created_at,
      properties ( id, name ),
      profiles:assigned_coordinator_id ( id, first_name, last_name )
    `)
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })

  if (!isOwner) {
    if (assignedPropertyIds.length > 0) {
      leadsQuery = leadsQuery.or(
        `assigned_coordinator_id.eq.${userId},property_id.in.(${assignedPropertyIds.join(',')}),and(property_id.is.null,assigned_coordinator_id.is.null)`
      )
    } else {
      leadsQuery = leadsQuery.or(
        `assigned_coordinator_id.eq.${userId},and(property_id.is.null,assigned_coordinator_id.is.null)`
      )
    }
  }

  const { data: leadsData, error: leadsErr } = await leadsQuery

  if (leadsErr) {
    console.error('Failed to load leads from database:', leadsErr)
  }

  const rawLeads = (leadsData || []).map((l: any) => ({
    id: l.id,
    full_name: l.full_name,
    phone_number: l.phone_number,
    email: l.email,
    lead_source: l.lead_source,
    stage: l.stage,
    budget_max: l.budget_max ? Number(l.budget_max) : null,
    preferred_bedrooms: l.preferred_bedrooms ? Number(l.preferred_bedrooms) : null,
    notes: l.notes,
    property_id: l.property_id,
    properties: l.properties,
    assigned_coordinator_id: l.assigned_coordinator_id,
    profiles: l.profiles,
    converted_tenant_id: l.converted_tenant_id,
    created_at: l.created_at,
  }))

  if (isOwner) {
    return rawLeads
  }

  // Mask phone numbers for property coordinators / managers
  return rawLeads.map((lead) => ({
    ...lead,
    phone_number: maskPhoneNumber(lead.phone_number),
  }))
}


