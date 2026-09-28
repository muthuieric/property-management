'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getUserAgencyContext } from '@/utils/supabase/get-context'
import { syncSingleTenantToKaribu, syncAgencyDirectoryToKaribu } from '@/utils/karibu/sync'
import { testConnection } from '@/utils/karibu/client'
import { maskPhoneNumber } from '@/app/lib/utils/masking'

export interface AddTenantResult {
  success: boolean
  error?: string
}

export async function addTenant(formData: FormData): Promise<AddTenantResult> {
  // Verify service key credentials early
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      success: false,
      error: 'Missing Supabase Service Role credentials. Please configure SUPABASE_SERVICE_ROLE_KEY.',
    }
  }

  const supabaseAdmin = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  // 1. Fetch the logged-in user and their agency_id from their profiles record
  let agencyId: string | null = null
  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authUserError } = await supabase.auth.getUser()

    if (authUserError || !user) {
      return { success: false, error: 'Unauthorized: Active user session not found. Please log in.' }
    }

    const { data: profileRecord, error: profileFetchErr } = await supabaseAdmin
      .from('profiles')
      .select('agency_id')
      .eq('id', user.id)
      .single()

    agencyId = profileRecord?.agency_id || null

    if (!agencyId) {
      const ctx = await getUserAgencyContext()
      agencyId = ctx.agencyId || null
    }
  } catch (authContextErr: any) {
    console.error('Error resolving agency context:', authContextErr)
    return { success: false, error: authContextErr?.message || 'Failed to resolve agency context.' }
  }

  if (!agencyId) {
    return { success: false, error: 'Could not resolve agency context for the current user.' }
  }

  // 2. Validate form fields
  const first_name = (formData.get('first_name') as string)?.trim()
  const last_name = (formData.get('last_name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const phone_number = (formData.get('phone_number') as string)?.trim()
  const property_id = (formData.get('property_id') as string)?.trim() || undefined
  const rawPassword = (formData.get('password') as string)?.trim()
  const password = rawPassword || 'TenantPass2026!'

  if (!first_name) {
    return { success: false, error: 'First name is required.' }
  }
  if (!last_name) {
    return { success: false, error: 'Last name is required.' }
  }
  if (!email) {
    return { success: false, error: 'Email address is required.' }
  }
  if (!phone_number) {
    return { success: false, error: 'Phone number is required.' }
  }

  // 3. Strict try/catch wrapping createUser and database insert logic
  let newUserId: string | null = null

  try {
    // 3a. Create auth user via Supabase Admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name,
        last_name,
        role: 'tenant',
        agency_id: agencyId,
      },
    })

    if (authError) {
      console.error('supabaseAdmin.auth.admin.createUser error:', authError)
      return { success: false, error: authError.message }
    }

    if (!authData?.user?.id) {
      return { success: false, error: 'Failed to generate user identifier from auth service.' }
    }

    newUserId = authData.user.id

    // 3b. Insert/Upsert into profiles table explicitly including agency_id
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert([
        {
          id: newUserId,
          agency_id: agencyId,
          role: 'tenant',
          first_name,
          last_name,
          is_active: true,
        },
      ])

    if (profileError) {
      console.error('Database insert into profiles failed:', profileError)
      // Rollback created auth user
      try {
        await supabaseAdmin.auth.admin.deleteUser(newUserId)
      } catch {}
      return { success: false, error: profileError.message }
    }

    // 3c. Insert into tenants table explicitly including agency_id
    const { error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert([
        {
          id: newUserId,
          user_id: newUserId,
          first_name,
          last_name,
          email,
          phone_number,
          agency_id: agencyId,
          is_active: true,
        },
      ])

    if (tenantError) {
      console.error('Database insert into tenants failed:', tenantError)
      // Rollback profile and auth user
      try {
        await supabaseAdmin.from('profiles').delete().eq('id', newUserId)
      } catch {}
      try {
        await supabaseAdmin.auth.admin.deleteUser(newUserId)
      } catch {}
      return { success: false, error: tenantError.message }
    }

    // 3d. Synchronize newly registered tenant to Karibu VMS
    try {
      await syncSingleTenantToKaribu(newUserId, { propertyId: property_id })
    } catch (vmsErr: any) {
      console.warn('[Karibu VMS] Non-blocking registration sync warning:', vmsErr)
    }
  } catch (err: any) {
    console.error('Unhandled exception during tenant registration:', err)
    if (newUserId) {
      try {
        await supabaseAdmin.from('profiles').delete().eq('id', newUserId)
      } catch {}
      try {
        await supabaseAdmin.auth.admin.deleteUser(newUserId)
      } catch {}
    }
    return { success: false, error: err?.message || 'An unexpected error occurred while registering the tenant.' }
  }

  // 4. Invalidate Next.js cache across all relevant views
  try {
    revalidatePath('/dashboard/tenants')
    revalidatePath('/dashboard/property/[id]', 'page')
    revalidatePath('/dashboard')
  } catch (cacheErr: any) {
    console.warn('Cache revalidation warning:', cacheErr)
  }

  return { success: true }
}

/**
 * Bulk synchronize all agency properties and tenants to Karibu VMS
 */
export async function syncAllTenantsToKaribuAction(): Promise<{
  success: boolean
  message: string
  groupsCount?: number
  usersCount?: number
  error?: string
}> {
  try {
    const { agencyId } = await getUserAgencyContext()
    if (!agencyId) {
      return { success: false, message: 'Could not resolve agency identifier.', error: 'Unauthorized' }
    }

    const res = await syncAgencyDirectoryToKaribu(agencyId)
    revalidatePath('/dashboard/tenants')
    return res
  } catch (err: any) {
    console.error('syncAllTenantsToKaribuAction failed:', err)
    return {
      success: false,
      message: err?.message || 'Directory synchronization encountered an unexpected error.',
      error: err?.message,
    }
  }
}

/**
 * Synchronize a single tenant to Karibu VMS
 */
export async function syncSingleTenantAction(tenantId: string): Promise<{
  success: boolean
  message: string
  error?: string
}> {
  try {
    const res = await syncSingleTenantToKaribu(tenantId)
    revalidatePath('/dashboard/tenants')
    return res
  } catch (err: any) {
    console.error(`syncSingleTenantAction failed for ${tenantId}:`, err)
    return {
      success: false,
      message: err?.message || 'Tenant synchronization failed.',
      error: err?.message,
    }
  }
}

/**
 * Test connectivity with Karibu VMS Directory Sync API
 */
export async function testKaribuConnectionAction(): Promise<{
  ok: boolean
  message: string
}> {
  try {
    return await testConnection()
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Failed to connect to Karibu VMS.',
    }
  }
}

/**
 * Fetches tenant records for the active agency with Enterprise PII Masking.
 * Strictly verifies user role:
 * - 'agency_owner' / 'super_admin': Returns raw phone numbers unmasked.
 * - 'property_manager' / 'property_coordinator': Overwrites phone_number and owner_mobile with maskPhoneNumber before returning.
 * Crucial Security Note: Raw phone numbers never leave the server if the user is a property coordinator.
 */
export async function getTenants(): Promise<any[]> {
  const supabase = await createServerClient()
  const { userId, agencyId, role } = await getUserAgencyContext()
  const isOwner = role === 'agency_owner' || role === 'super_admin'

  let assignedPropertyIds: string[] = []
  if (!isOwner) {
    const { data: assignedProps } = await supabase
      .from('properties')
      .select('id')
      .eq('agency_id', agencyId)
      .eq('manager_id', userId)

    assignedPropertyIds = (assignedProps || []).map((p) => p.id)
  }

  let tenants: any[] = []

  if (!isOwner) {
    if (assignedPropertyIds.length > 0) {
      const { data: scopedLeases } = await supabase
        .from('leases')
        .select(`
          tenant_id,
          units!inner ( property_id )
        `)
        .eq('agency_id', agencyId)
        .in('units.property_id', assignedPropertyIds)

      const assignedTenantIds = Array.from(
        new Set((scopedLeases || []).map((l: any) => l.tenant_id).filter(Boolean))
      )

      if (assignedTenantIds.length > 0) {
        const { data } = await supabase
          .from('tenants')
          .select('*')
          .eq('agency_id', agencyId)
          .in('id', assignedTenantIds)
          .order('first_name', { ascending: true })

        tenants = data || []
      }
    }
  } else {
    const { data } = await supabase
      .from('tenants')
      .select('*')
      .eq('agency_id', agencyId)
      .order('first_name', { ascending: true })

    tenants = data || []
  }

  // Strictly enforce PII Data Masking based on role
  if (isOwner) {
    return tenants
  }

  // If coordinator / manager: mask phone numbers
  return tenants.map((t) => ({
    ...t,
    phone_number: maskPhoneNumber(t.phone_number),
    owner_mobile: t.owner_mobile ? maskPhoneNumber(t.owner_mobile) : t.owner_mobile,
  }))
}

export interface CreateTenantWithLeasePayload {
  fullName: string
  phoneNumber: string
  email: string
  idNumber?: string
  unitId: string
  leaseStartDate: string
  leaseEndDate?: string
  depositAmount?: number
  vehicleRegistration?: string
  nextOfKinName?: string
  nextOfKinPhone?: string
  nextOfKinRelation?: string
}

export interface VacantUnitItem {
  id: string
  unit_number: string
  property_id: string
  property_name: string
  base_rent: number
}

/**
 * Fetches vacant units for the current agency/coordinator to allocate in the onboarding wizard.
 */
export async function getVacantUnits(): Promise<VacantUnitItem[]> {
  const supabase = await createServerClient()
  const { agencyId, userId, role } = await getUserAgencyContext()
  const isOwner = role === 'agency_owner' || role === 'super_admin'

  let targetPropertyIds: string[] = []
  if (isOwner) {
    const { data: props } = await supabase
      .from('properties')
      .select('id')
      .eq('agency_id', agencyId)
    targetPropertyIds = (props || []).map((p) => p.id)
  } else {
    const { data: assignedProps } = await supabase
      .from('properties')
      .select('id')
      .eq('agency_id', agencyId)
      .eq('manager_id', userId)
    targetPropertyIds = (assignedProps || []).map((p) => p.id)
  }

  if (targetPropertyIds.length === 0) return []

  const { data: units } = await supabase
    .from('units')
    .select(`
      id,
      unit_number,
      base_rent,
      property_id,
      properties ( name )
    `)
    .in('property_id', targetPropertyIds)
    .eq('is_occupied', false)
    .order('unit_number', { ascending: true })

  return (units || []).map((u: any) => ({
    id: u.id,
    unit_number: u.unit_number,
    property_id: u.property_id,
    property_name: u.properties?.name || 'Property Site',
    base_rent: u.base_rent ? Number(u.base_rent) : 0,
  }))
}

/**
 * 3-Step Wizard Action: Creates a tenant with comprehensive KYC and automatically provisions their active lease.
 */
export async function createTenantWithLease(
  payload: CreateTenantWithLeasePayload
): Promise<{ success: boolean; tenantId?: string; leaseId?: string; error?: string }> {
  try {
    const supabase = await createServerClient()
    const { agencyId } = await getUserAgencyContext()

    if (!payload.fullName?.trim()) {
      return { success: false, error: 'Full name is required.' }
    }
    if (!payload.phoneNumber?.trim()) {
      return { success: false, error: 'Phone number is required.' }
    }
    if (!payload.email?.trim()) {
      return { success: false, error: 'Email address is required.' }
    }
    if (!payload.unitId) {
      return { success: false, error: 'Unit allocation is required.' }
    }
    if (!payload.leaseStartDate) {
      return { success: false, error: 'Lease start date is required.' }
    }

    const nameParts = payload.fullName.trim().split(/\s+/)
    const firstName = nameParts[0] || 'Resident'
    const lastName = nameParts.slice(1).join(' ') || firstName
    const email = payload.email.trim().toLowerCase()
    const phoneNumber = payload.phoneNumber.trim()

    // 1. Verify unit belongs to agency
    const { data: unitRecord, error: unitCheckErr } = await supabase
      .from('units')
      .select('id, property_id, base_rent, properties(id, agency_id)')
      .eq('id', payload.unitId)
      .maybeSingle()

    if (unitCheckErr || !unitRecord) {
      return { success: false, error: 'Selected unit could not be found.' }
    }

    const unitAgencyId = (unitRecord.properties as any)?.agency_id
    if (unitAgencyId && unitAgencyId !== agencyId) {
      return { success: false, error: 'Unauthorized unit selection across agency borders.' }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return { success: false, error: 'Missing service role configuration.' }
    }

    const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // 2. Create Auth User or resolve existing
    let userId: string
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      password: 'TenantPass2026!',
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        role: 'tenant',
        agency_id: agencyId,
      },
    })

    if (authErr) {
      // If user already registered, look them up
      const { data: existingUser } = await admin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      if (existingUser?.id) {
        userId = existingUser.id
      } else {
        return { success: false, error: `Auth creation failed: ${authErr.message}` }
      }
    } else {
      userId = authData.user.id
    }

    // 3. Upsert Profile
    await admin.from('profiles').upsert([
      {
        id: userId,
        agency_id: agencyId,
        role: 'tenant',
        first_name: firstName,
        last_name: lastName,
        is_active: true,
      },
    ])

    // 4. Insert Tenant record with comprehensive KYC
    const tenantPayload = {
      id: userId,
      user_id: userId,
      first_name: firstName,
      last_name: lastName,
      email,
      phone_number: phoneNumber,
      agency_id: agencyId,
      is_active: true,
      id_number: payload.idNumber?.trim() || null,
      vehicle_registration: payload.vehicleRegistration?.trim() || null,
      next_of_kin_name: payload.nextOfKinName?.trim() || null,
      next_of_kin_phone: payload.nextOfKinPhone?.trim() || null,
      next_of_kin_relation: payload.nextOfKinRelation?.trim() || null,
    }

    const { error: tenantErr } = await admin.from('tenants').upsert([tenantPayload])

    if (tenantErr) {
      console.error('Tenant upsert error:', tenantErr)
      return { success: false, error: `Failed to save tenant KYC: ${tenantErr.message}` }
    }

    // 5. Provision Lease in public.leases
    const depositAmount =
      payload.depositAmount != null
        ? Number(payload.depositAmount)
        : Number(unitRecord.base_rent || 0)

    const { data: newLease, error: leaseErr } = await admin
      .from('leases')
      .insert([
        {
          unit_id: payload.unitId,
          tenant_id: userId,
          start_date: payload.leaseStartDate,
          end_date: payload.leaseEndDate || null,
          deposit_amount: depositAmount,
          is_active: true,
          lease_status: 'active',
          agency_id: agencyId,
        },
      ])
      .select('id')
      .single()

    if (leaseErr) {
      console.error('Lease creation error:', leaseErr)
      return { success: false, error: `Failed to provision lease: ${leaseErr.message}` }
    }

    // 6. Mark unit as occupied
    await admin.from('units').update({ is_occupied: true }).eq('id', payload.unitId)

    // 7. Non-blocking Karibu VMS access sync
    syncSingleTenantToKaribu(userId).catch(() => {})

    // 8. Invalidate caches
    revalidatePath('/dashboard/tenants')
    revalidatePath('/dashboard/leases')
    revalidatePath(`/dashboard/property/${unitRecord.property_id}`)
    revalidatePath('/dashboard/properties')

    return {
      success: true,
      tenantId: userId,
      leaseId: newLease?.id,
    }
  } catch (err: unknown) {
    console.error('Unhandled error in createTenantWithLease:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An error occurred during onboarding.',
    }
  }
}

/**
 * Bulk CSV Tenant Importer: Batch imports tenants, assigns them to units, and provisions leases.
 */
export async function bulkImportTenants(
  propertyId: string,
  tenantsArray: Array<Record<string, unknown>>
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const supabase = await createServerClient()
    const { agencyId, role } = await getUserAgencyContext()

    if (!propertyId) {
      return { success: false, error: 'Missing target property ID.' }
    }

    if (!tenantsArray || !Array.isArray(tenantsArray) || tenantsArray.length === 0) {
      return { success: false, error: 'No tenant rows provided.' }
    }

    // Verify property belongs to agency
    const { data: property } = await supabase
      .from('properties')
      .select('id, agency_id')
      .eq('id', propertyId)
      .maybeSingle()

    if (!property || (property.agency_id !== agencyId && role !== 'super_admin')) {
      return { success: false, error: 'Unauthorized property access.' }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return { success: false, error: 'Missing service role configuration.' }
    }

    const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Fetch units for this property to map unit numbers
    const { data: existingUnits } = await admin
      .from('units')
      .select('id, unit_number, base_rent')
      .eq('property_id', propertyId)

    const unitMap = new Map<string, { id: string; base_rent: number }>()
    existingUnits?.forEach((u) => {
      unitMap.set(u.unit_number.trim().toLowerCase(), {
        id: u.id,
        base_rent: Number(u.base_rent || 0),
      })
    })

    let importedCount = 0

    for (const row of tenantsArray) {
      const fullName = String(row['Full Name'] ?? row['name'] ?? row['Tenant Name'] ?? '').trim()
      const phone = String(row['Phone'] ?? row['phone_number'] ?? row['Mobile'] ?? '').trim()
      const unitNumber = String(row['Unit Number'] ?? row['unit'] ?? row['Unit'] ?? '').trim()
      const leaseStart = String(
        row['Lease Start (YYYY-MM-DD)'] ?? row['lease_start'] ?? row['Start Date'] ?? new Date().toISOString().slice(0, 10)
      ).trim()
      const depositRaw = String(row['Deposit Paid KES'] ?? row['deposit'] ?? row['Deposit'] ?? '0').replace(/[^0-9.]/g, '')

      if (!fullName || !phone) continue

      const nameParts = fullName.split(/\s+/)
      const firstName = nameParts[0] || 'Resident'
      const lastName = nameParts.slice(1).join(' ') || firstName
      const generatedEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/[^a-z0-9]/g, '')}${Math.floor(Math.random() * 900 + 100)}@tenant.luffi.tech`

      // 1. Resolve or create unit
      let unitInfo = unitMap.get(unitNumber.toLowerCase())
      if (!unitInfo && unitNumber) {
        const { data: newUnit } = await admin
          .from('units')
          .insert([
            {
              property_id: propertyId,
              agency_id: agencyId,
              unit_number: unitNumber,
              base_rent: 0,
              is_occupied: true,
            },
          ])
          .select('id, base_rent')
          .single()

        if (newUnit) {
          unitInfo = { id: newUnit.id, base_rent: 0 }
          unitMap.set(unitNumber.toLowerCase(), unitInfo)
        }
      }

      // 2. Create Auth user
      const { data: authData } = await admin.auth.admin.createUser({
        email: generatedEmail,
        password: 'TenantPass2026!',
        email_confirm: true,
        user_metadata: { first_name: firstName, last_name: lastName, role: 'tenant', agency_id: agencyId },
      })

      if (!authData?.user?.id) continue
      const userId = authData.user.id

      // 3. Upsert Profile & Tenant record
      await admin.from('profiles').upsert([
        { id: userId, agency_id: agencyId, role: 'tenant', first_name: firstName, last_name: lastName, is_active: true },
      ])

      await admin.from('tenants').upsert([
        {
          id: userId,
          user_id: userId,
          first_name: firstName,
          last_name: lastName,
          email: generatedEmail,
          phone_number: phone,
          agency_id: agencyId,
          is_active: true,
        },
      ])

      // 4. Create active lease if unit resolved
      if (unitInfo) {
        const depositAmount = Number(depositRaw) || unitInfo.base_rent || 0
        await admin.from('leases').insert([
          {
            unit_id: unitInfo.id,
            tenant_id: userId,
            start_date: leaseStart,
            deposit_amount: depositAmount,
            is_active: true,
            lease_status: 'active',
            agency_id: agencyId,
          },
        ])

        await admin.from('units').update({ is_occupied: true }).eq('id', unitInfo.id)
      }

      importedCount++
    }

    revalidatePath('/dashboard/tenants')
    revalidatePath('/dashboard/leases')
    revalidatePath(`/dashboard/property/${propertyId}`)

    return { success: true, count: importedCount }
  } catch (err: unknown) {
    console.error('Error in bulkImportTenants:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Bulk import encountered an error.',
    }
  }
}

/**
 * Generates a self-serve 7-day secure onboarding invite token for a tenant.
 */
export async function generateTenantInvite(
  phone: string,
  unitId: string
): Promise<{ success: boolean; inviteToken?: string; inviteUrl?: string; error?: string }> {
  try {
    const supabase = await createServerClient()
    const { agencyId } = await getUserAgencyContext()

    if (!phone?.trim()) {
      return { success: false, error: 'Tenant phone number is required.' }
    }
    if (!unitId) {
      return { success: false, error: 'Target unit allocation is required.' }
    }

    // Verify unit belongs to agency
    const { data: unit, error: unitErr } = await supabase
      .from('units')
      .select('id, property_id, properties(agency_id)')
      .eq('id', unitId)
      .maybeSingle()

    if (unitErr || !unit) {
      return { success: false, error: 'Target unit not found.' }
    }

    const unitAgencyId = (unit.properties as any)?.agency_id
    if (unitAgencyId && unitAgencyId !== agencyId) {
      return { success: false, error: 'Unauthorized access to this unit.' }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return { success: false, error: 'Missing server credentials.' }
    }

    const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const inviteToken = crypto.randomUUID()
    const { data: invite, error: inviteErr } = await admin
      .from('tenant_invites')
      .insert([
        {
          property_id: unit.property_id,
          unit_id: unitId,
          tenant_phone: phone.trim(),
          invite_token: inviteToken,
          status: 'pending',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ])
      .select('invite_token')
      .single()

    if (inviteErr || !invite) {
      return { success: false, error: `Failed to create invite: ${inviteErr?.message}` }
    }

    const inviteUrl = `/onboarding/${invite.invite_token}`

    return {
      success: true,
      inviteToken: invite.invite_token,
      inviteUrl,
    }
  } catch (err: unknown) {
    console.error('Error generating tenant invite:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to generate tenant invite.',
    }
  }
}

/**
 * Public Onboarding Action: Called by prospective tenant to submit KYC data and claim invite.
 */
export async function completeTenantOnboarding(
  token: string,
  kycData: {
    fullName: string
    email: string
    idNumber?: string
    vehicleRegistration?: string
    nextOfKinName?: string
    nextOfKinPhone?: string
    nextOfKinRelation?: string
  }
): Promise<{ success: boolean; tenantId?: string; error?: string }> {
  try {
    if (!token) {
      return { success: false, error: 'Missing invitation token.' }
    }
    if (!kycData.fullName?.trim()) {
      return { success: false, error: 'Full name is required.' }
    }
    if (!kycData.email?.trim()) {
      return { success: false, error: 'Email address is required.' }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return { success: false, error: 'Server configuration error.' }
    }

    const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // 1. Verify invite
    const { data: invite, error: inviteErr } = await admin
      .from('tenant_invites')
      .select('id, property_id, unit_id, tenant_phone, status, expires_at, properties(agency_id)')
      .eq('invite_token', token)
      .maybeSingle()

    if (inviteErr || !invite) {
      return { success: false, error: 'Invitation link is invalid or does not exist.' }
    }

    if (invite.status !== 'pending') {
      return { success: false, error: 'This invitation has already been completed.' }
    }

    if (new Date(invite.expires_at) < new Date()) {
      return { success: false, error: 'This invitation link has expired. Please contact your property manager.' }
    }

    const agencyId = (invite.properties as any)?.agency_id
    const nameParts = kycData.fullName.trim().split(/\s+/)
    const firstName = nameParts[0] || 'Resident'
    const lastName = nameParts.slice(1).join(' ') || firstName
    const email = kycData.email.trim().toLowerCase()
    const phone = invite.tenant_phone

    // 2. Create Auth user
    let userId: string
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email,
      password: 'TenantPass2026!',
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName, role: 'tenant', agency_id: agencyId },
    })

    if (authErr) {
      const { data: existing } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
      if (existing?.id) {
        userId = existing.id
      } else {
        return { success: false, error: authErr.message }
      }
    } else {
      userId = authUser.user.id
    }

    // 3. Upsert Profile
    await admin.from('profiles').upsert([
      { id: userId, agency_id: agencyId, role: 'tenant', first_name: firstName, last_name: lastName, is_active: true },
    ])

    // 4. Upsert Tenant KYC
    await admin.from('tenants').upsert([
      {
        id: userId,
        user_id: userId,
        first_name: firstName,
        last_name: lastName,
        email,
        phone_number: phone,
        agency_id: agencyId,
        is_active: true,
        id_number: kycData.idNumber?.trim() || null,
        vehicle_registration: kycData.vehicleRegistration?.trim() || null,
        next_of_kin_name: kycData.nextOfKinName?.trim() || null,
        next_of_kin_phone: kycData.nextOfKinPhone?.trim() || null,
        next_of_kin_relation: kycData.nextOfKinRelation?.trim() || null,
      },
    ])

    // 5. Create active lease for allocated unit
    await admin.from('leases').insert([
      {
        unit_id: invite.unit_id,
        tenant_id: userId,
        start_date: new Date().toISOString().slice(0, 10),
        deposit_amount: 0,
        is_active: true,
        lease_status: 'active',
        agency_id: agencyId,
      },
    ])

    await admin.from('units').update({ is_occupied: true }).eq('id', invite.unit_id)

    // 6. Mark invite as completed
    await admin.from('tenant_invites').update({ status: 'completed' }).eq('id', invite.id)

    // Non-blocking Karibu sync
    syncSingleTenantToKaribu(userId).catch(() => {})

    revalidatePath('/dashboard/tenants')
    revalidatePath('/dashboard/leases')

    return { success: true, tenantId: userId }
  } catch (err: unknown) {
    console.error('Error completing tenant onboarding:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to complete registration.',
    }
  }
}

export interface InviteDetailsResult {
  valid: boolean
  error?: string
  invite?: {
    id: string
    token: string
    phone: string
    status: string
    expiresAt: string
    unitNumber: string
    propertyName: string
    propertyLocation?: string
  }
}

/**
 * Public function to inspect an invite token's validity and retrieve unit/property metadata.
 */
export async function getInviteDetails(token: string): Promise<InviteDetailsResult> {
  try {
    if (!token) {
      return { valid: false, error: 'No invitation token provided.' }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      return { valid: false, error: 'Server configuration error.' }
    }

    const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: invite, error: inviteErr } = await admin
      .from('tenant_invites')
      .select(`
        id,
        invite_token,
        tenant_phone,
        status,
        expires_at,
        unit_id,
        units (
          unit_number,
          properties (
            name,
            location
          )
        )
      `)
      .eq('invite_token', token)
      .maybeSingle()

    if (inviteErr || !invite) {
      return { valid: false, error: 'This invitation link is invalid or does not exist.' }
    }

    if (invite.status === 'completed') {
      return { valid: false, error: 'This invitation has already been completed.' }
    }

    if (invite.status === 'cancelled') {
      return { valid: false, error: 'This invitation has been revoked by property management.' }
    }

    if (new Date(invite.expires_at) < new Date()) {
      return {
        valid: false,
        error: 'This invitation link has expired. Please request a new invite from your property coordinator.',
      }
    }

    const unit = invite.units as any
    const property = unit?.properties as any

    return {
      valid: true,
      invite: {
        id: invite.id,
        token: invite.invite_token,
        phone: invite.tenant_phone,
        status: invite.status,
        expiresAt: invite.expires_at,
        unitNumber: unit?.unit_number || 'Assigned Unit',
        propertyName: property?.name || 'Property Site',
        propertyLocation: property?.location || '',
      },
    }
  } catch (err: unknown) {
    console.error('Error fetching invite details:', err)
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'An error occurred while validating the invitation.',
    }
  }
}



