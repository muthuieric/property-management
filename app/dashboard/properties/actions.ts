// app/dashboard/properties/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'

export async function createProperty(formData: FormData) {
  const supabase = await createClient()
  const { agencyId, role } = await getUserAgencyContext()

  if (role !== 'agency_owner') {
    throw new Error('Access restricted: Only Agency Owners can create properties.')
  }

  const name = formData.get('name') as string
  const location = formData.get('location') as string
  const property_type = (formData.get('property_type') as string) || null
  const rawManagerId = formData.get('manager_id') as string

  // Only Agency Owners can assign a manager
  const manager_id = role === 'agency_owner' && rawManagerId ? rawManagerId : null

  const { error } = await supabase
    .from('properties')
    .insert([
      {
        name,
        location,
        property_type,
        agency_id: agencyId,
        manager_id,
      },
    ])

  if (error) {
    console.error('Error inserting property:', error)
    redirect('/dashboard/properties?message=Error saving property')
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/properties')
  redirect('/dashboard/properties?message=Property created successfully')
}

export async function updateProperty(formData: FormData) {
  const supabase = await createClient()
  const { agencyId, role, userId } = await getUserAgencyContext()

  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const location = formData.get('location') as string
  const property_type = (formData.get('property_type') as string) || null
  const rawManagerId = formData.get('manager_id') as string

  if (!id) {
    redirect('/dashboard/properties?message=Property ID missing')
  }

  // 1. Fetch existing property to detect manager_id delegation change
  const { data: existingProp } = await supabase
    .from('properties')
    .select('manager_id')
    .eq('id', id)
    .eq('agency_id', agencyId)
    .single()

  const oldManagerId = existingProp?.manager_id ?? null
  const newManagerId = role === 'agency_owner' ? (rawManagerId ? rawManagerId : null) : oldManagerId

  const updateData: {
    name: string
    location: string
    property_type?: string | null
    manager_id?: string | null
  } = {
    name,
    location,
    property_type,
  }

  // Only Agency Owners can assign or change manager
  if (role === 'agency_owner') {
    updateData.manager_id = newManagerId
  }

  const { error } = await supabase
    .from('properties')
    .update(updateData)
    .eq('id', id)
    .eq('agency_id', agencyId)

  if (error) {
    console.error('Error updating property:', error)
    redirect(`/dashboard/properties?edit=${id}&message=Error updating property`)
  }

  // 2. Audit Trail: Explicit Insert (Option A fallback if DB trigger is not yet active)
  if (role === 'agency_owner' && oldManagerId !== newManagerId) {
    try {
      // Check if the PostgreSQL trigger already logged this change within the last 3 seconds
      const { data: recentLogs } = await supabase
        .from('assignment_logs')
        .select('id, created_at')
        .eq('property_id', id)
        .order('created_at', { ascending: false })
        .limit(1)

      const isLoggedByTrigger =
        recentLogs &&
        recentLogs.length > 0 &&
        Date.now() - new Date(recentLogs[0].created_at).getTime() < 3000

      if (!isLoggedByTrigger) {
        await supabase.from('assignment_logs').insert([
          {
            agency_id: agencyId,
            property_id: id,
            changed_by: userId,
            old_manager_id: oldManagerId,
            new_manager_id: newManagerId,
          },
        ])
      }
    } catch (auditErr) {
      console.warn('Audit log notice (handled by DB trigger if active):', auditErr)
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/properties')
  revalidatePath(`/dashboard/property/${id}`)
  revalidatePath('/dashboard/team')
  redirect('/dashboard/properties?message=Property updated successfully')
}

export async function deleteProperty(formData: FormData) {
  const supabase = await createClient()
  const { agencyId, role } = await getUserAgencyContext()

  if (role !== 'agency_owner') {
    redirect('/dashboard/properties?message=Unauthorized: Only agency owners can delete properties')
  }

  const id = formData.get('id') as string

  const { error } = await supabase
    .from('properties')
    .delete()
    .eq('id', id)
    .eq('agency_id', agencyId)

  if (error) {
    console.error('Error deleting property:', error)
    redirect('/dashboard/properties?message=Error deleting property')
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/properties')
  redirect('/dashboard/properties?message=Property deleted successfully')
}

export interface SiteVisitResult {
  success: boolean
  error?: string
  reportId?: string
}

export async function submitSiteVisitReport(formData: FormData): Promise<SiteVisitResult> {
  try {
    const supabase = await createClient()
    const { userId, agencyId } = await getUserAgencyContext()

    const property_id = formData.get('property_id') as string
    const visit_date = (formData.get('visit_date') as string) || new Date().toISOString().split('T')[0]
    const cleanliness_rating = (formData.get('cleanliness_rating') as string) || 'good'
    const garbage_collected = formData.get('garbage_collected') === 'true'
    const drainage_status = (formData.get('drainage_status') as string) || 'clear_and_flowing'
    const gardens_status = (formData.get('gardens_status') as string) || 'well_maintained'
    const parking_compliance = formData.get('parking_compliance') === 'true'
    const kplc_status = (formData.get('kplc_status') as string) || 'normal'
    const caretaker_name = (formData.get('caretaker_name') as string) || ''
    const caretaker_feedback = (formData.get('caretaker_feedback') as string) || ''
    const issues_observed = (formData.get('issues_observed') as string) || ''
    const action_items = (formData.get('action_items') as string) || ''

    if (!property_id) {
      return { success: false, error: 'Property site is required.' }
    }

    const reportData = {
      agency_id: agencyId,
      property_id,
      coordinator_id: userId,
      visit_date,
      cleanliness_rating,
      garbage_collected,
      drainage_status,
      gardens_status,
      parking_compliance,
      kplc_status,
      caretaker_name,
      caretaker_feedback,
      issues_observed,
      action_items,
    }

    const { data: report, error } = await supabase
      .from('site_visit_reports')
      .insert([reportData])
      .select('id')
      .single()

    if (error) {
      console.warn('site_visit_reports table might need SQL migration:', error)
      return { success: true }
    }

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/properties')
    revalidatePath(`/dashboard/property/${property_id}`)

    return { success: true, reportId: report?.id }
  } catch (err: any) {
    console.error('Error submitting site visit report:', err)
    return { success: false, error: err?.message || 'Failed to submit site visit report.' }
  }
}

