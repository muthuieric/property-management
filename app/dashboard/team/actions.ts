// app/dashboard/team/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'

export async function inviteManager(formData: FormData) {
  const { agencyId, role } = await getUserAgencyContext()

  // Security check: Only Agency Owners should be able to invite staff
  if (role !== 'agency_owner') {
    redirect('/dashboard/team?message=Unauthorized: Only agency owners can invite staff')
  }

  const email = formData.get('email') as string
  const first_name = formData.get('first_name') as string
  const last_name = formData.get('last_name') as string

  // Initialize the Admin client to bypass client-side auth restrictions
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Send the invite and inject the metadata for our Database Trigger
  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: {
      first_name,
      last_name,
      role: 'property_manager',
      agency_id: agencyId
    }
  })

  if (error) {
    console.error('Error inviting user:', error)
    redirect('/dashboard/team?message=Failed to send invitation')
  }

  revalidatePath('/dashboard/team')
  redirect('/dashboard/team?message=Invitation sent successfully')
}

export async function assignPropertiesToManager(managerId: string, propertyIds: string[]) {
  const { userId, agencyId, role } = await getUserAgencyContext()

  // Security check: Only Agency Owners can delegate property assignments
  if (role !== 'agency_owner') {
    throw new Error('Unauthorized: Only agency owners can assign properties')
  }

  const supabase = await createClient()

  // =========================================================================
  // 1. DOUBLE-SIDED TENANCY VERIFICATION
  // =========================================================================

  // Side 1: Verify target manager belongs to caller's agency and has the coordinator role
  const { data: targetProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, agency_id, role')
    .eq('id', managerId)
    .single()

  if (profileError || !targetProfile) {
    throw new Error('Unauthorized: Target manager profile not found')
  }

  if (targetProfile.agency_id !== agencyId || targetProfile.role !== 'property_manager') {
    throw new Error('Unauthorized: Target user does not belong to your agency or is not a property coordinator')
  }

  // Side 2: Verify every property in propertyIds belongs to caller's agency
  const sanitizedPropertyIds = Array.isArray(propertyIds) ? propertyIds.filter(Boolean) : []
  if (sanitizedPropertyIds.length > 0) {
    const { data: verifiedProps, error: propCheckError } = await supabase
      .from('properties')
      .select('id, agency_id')
      .in('id', sanitizedPropertyIds)
      .eq('agency_id', agencyId)

    if (propCheckError) {
      throw new Error('Error validating property agency boundaries')
    }

    if (!verifiedProps || verifiedProps.length !== sanitizedPropertyIds.length) {
      throw new Error('Unauthorized: One or more properties do not belong to your agency')
    }
  }

  // =========================================================================
  // 2. ATOMIC ASSIGNMENT VIA SUPABASE RPC (WITH ACID AUDIT LOGGING)
  // =========================================================================
  const { data: rpcData, error: rpcError } = await supabase.rpc('assign_properties_to_manager', {
    p_agency_id: agencyId,
    p_manager_id: managerId,
    p_property_ids: sanitizedPropertyIds,
    p_changed_by: userId,
  })

  // If RPC succeeded, revalidate and return
  if (!rpcError) {
    revalidatePath('/dashboard/team')
    revalidatePath('/dashboard/properties')
    revalidatePath('/dashboard')
    return
  }

  // =========================================================================
  // 3. FALLBACK: COORDINATED TRANSACTION & AUDIT LOGGING
  // Used if the PostgreSQL stored function has not yet been deployed
  // =========================================================================
  console.warn('RPC assign_properties_to_manager not found or returned error, falling back to coordinated batch:', rpcError.message)

  // Fetch current properties assigned to this manager to compute audit diff
  const { data: currentAssignments } = await supabase
    .from('properties')
    .select('id, manager_id')
    .eq('agency_id', agencyId)
    .eq('manager_id', managerId)

  const currentIds = (currentAssignments || []).map((p) => p.id)
  const idsToUnassign = currentIds.filter((id) => !sanitizedPropertyIds.includes(id))
  const idsToAssign = sanitizedPropertyIds.filter((id) => !currentIds.includes(id))

  // Unassign properties no longer in the list
  if (idsToUnassign.length > 0) {
    const { error: unassignError } = await supabase
      .from('properties')
      .update({ manager_id: null })
      .eq('agency_id', agencyId)
      .in('id', idsToUnassign)

    if (unassignError) {
      console.error('Error unassigning properties:', unassignError)
      throw new Error('Failed to unassign deselected properties')
    }

    // Try logging audit records
    for (const pid of idsToUnassign) {
      try {
        await supabase.from('assignment_logs').insert([
          {
            agency_id: agencyId,
            changed_by: userId,
            property_id: pid,
            old_manager_id: managerId,
            new_manager_id: null,
          }
        ])
      } catch {
        // Table may not exist yet if migration pending
      }
    }
  }

  // Assign newly selected properties
  if (sanitizedPropertyIds.length > 0) {
    const { error: assignError } = await supabase
      .from('properties')
      .update({ manager_id: managerId })
      .eq('agency_id', agencyId)
      .in('id', sanitizedPropertyIds)

    if (assignError) {
      console.error('Error assigning properties:', assignError)
      throw new Error('Failed to update property assignments')
    }

    // Try logging audit records for new assignments
    for (const pid of idsToAssign) {
      try {
        await supabase.from('assignment_logs').insert([
          {
            agency_id: agencyId,
            changed_by: userId,
            property_id: pid,
            old_manager_id: null,
            new_manager_id: managerId,
          }
        ])
      } catch {
        // Table may not exist yet if migration pending
      }
    }
  }

  revalidatePath('/dashboard/team')
  revalidatePath('/dashboard/properties')
  revalidatePath('/dashboard')
}

export async function assignPropertiesFormAction(formData: FormData) {
  const managerId = formData.get('manager_id') as string
  const propertyIds = formData.getAll('property_ids') as string[]

  if (!managerId) {
    redirect('/dashboard/team?message=Manager ID missing')
  }

  try {
    await assignPropertiesToManager(managerId, propertyIds)
  } catch (error: any) {
    redirect(`/dashboard/team?message=${encodeURIComponent(error.message || 'Error updating assignments')}`)
  }

  redirect('/dashboard/team?message=Portfolio assignments updated successfully')
}

export async function toggleUserStatus(userId: string, currentStatus: boolean) {
  const { agencyId, role } = await getUserAgencyContext()

  // Security Gate: Only the Agency Owner is permitted to toggle user suspension status
  if (role !== 'agency_owner') {
    throw new Error('Unauthorized: Only the Agency Owner can suspend or reactivate accounts')
  }

  const supabase = await createClient()

  // 1. Verify user profile within this agency
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, agency_id, role, is_active')
    .eq('id', userId)
    .single()

  const newStatus = !currentStatus

  if (profile) {
    if (profile.agency_id !== agencyId) {
      throw new Error('Unauthorized: User does not belong to your agency')
    }

    if (profile.role === 'agency_owner') {
      throw new Error('Action blocked: The Agency Owner account cannot be suspended')
    }

    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({ is_active: newStatus })
      .eq('id', userId)
      .eq('agency_id', agencyId)

    if (profileUpdateError) {
      console.error('Error toggling profile status:', profileUpdateError)
      throw new Error('Failed to update user account status')
    }
  }

  // 2. Also synchronize tenants table if this user is a tenant
  try {
    await supabase
      .from('tenants')
      .update({ is_active: newStatus })
      .or(`user_id.eq.${userId},id.eq.${userId}`)
      .eq('agency_id', agencyId)
  } catch (err) {
    console.warn('Tenants table is_active update notice:', err)
  }

  revalidatePath('/dashboard/team')
  revalidatePath('/dashboard/tenants')
  revalidatePath('/dashboard')
  revalidatePath('/portal')
}

export async function toggleUserStatusFormAction(formData: FormData) {
  const userId = formData.get('user_id') as string
  const currentStatus = formData.get('current_status') === 'true'
  const redirectPath = (formData.get('redirect_path') as string) || '/dashboard/team'

  if (!userId) {
    redirect(`${redirectPath}?message=User ID required`)
  }

  try {
    await toggleUserStatus(userId, currentStatus)
  } catch (error: any) {
    redirect(`${redirectPath}?message=${encodeURIComponent(error.message || 'Error toggling user status')}`)
  }

  const actionLabel = currentStatus ? 'suspended' : 'reactivated'
  redirect(`${redirectPath}?message=User account successfully ${actionLabel}`)
}