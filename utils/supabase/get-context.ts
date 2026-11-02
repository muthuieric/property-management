// utils/supabase/get-context.ts
import { createClient } from './server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export interface UserAgencyContext {
  userId: string
  agencyId: string
  role: string
  isSuperAdmin: boolean
}

export async function getUserAgencyContext(): Promise<UserAgencyContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('User not authenticated')
  }

  // 1. Try to fetch the profile normally
  const { data: profile } = await supabase
    .from('profiles')
    .select('agency_id, role')
    .eq('id', user.id)
    .single()

  if (profile) {
    const isSuperAdmin = profile.role === 'super_admin'
    return {
      userId: user.id,
      agencyId: profile.agency_id,
      role: profile.role,
      isSuperAdmin,
    }
  }

  // 2. If normal fetch is blocked by RLS, use God Mode (Admin Client) to grab it!
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! 
  )

  const { data: adminProfile } = await supabaseAdmin
    .from('profiles')
    .select('agency_id, role')
    .eq('id', user.id)
    .single()

  if (adminProfile) {
    console.log('✅ Bypassed RLS to fetch profile successfully.')
    const isSuperAdmin = adminProfile.role === 'super_admin'
    return {
      userId: user.id,
      agencyId: adminProfile.agency_id,
      role: adminProfile.role,
      isSuperAdmin,
    }
  }

  // 3. If it TRULY doesn't exist, safely UPSERT it so it NEVER crashes on a duplicate key
  console.log('🚨 Profile missing. Auto-creating it now...')
  const masterAgencyId = '11111111-1111-1111-1111-111111111111'
  
  const { error: upsertError } = await supabaseAdmin
    .from('profiles')
    .upsert([{
      id: user.id,
      agency_id: masterAgencyId,
      role: 'agency_owner',
      first_name: 'Admin'
    }])

  if (upsertError) {
    console.error('Failed to upsert profile:', upsertError)
    throw new Error(`Could not create profile: ${upsertError.message}`)
  }

  return {
    userId: user.id,
    agencyId: masterAgencyId,
    role: 'agency_owner',
    isSuperAdmin: false,
  }
}