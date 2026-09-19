'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getUserAgencyContext } from '@/utils/supabase/get-context'
import { syncSingleTenantToKaribu, syncAgencyDirectoryToKaribu } from '@/utils/karibu/sync'
import { testConnection } from '@/utils/karibu/client'

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
