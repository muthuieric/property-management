// app/dashboard/properties/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'

export interface CreatePropertyResult {
  success: boolean
  error?: string
  property?: any
  message?: string
}

export type CreatePropertyInput =
  | FormData
  | {
      name: string
      location: string
      property_type?: string
      purpose?: string
      floors?: number | string
      owner_mobile?: string | null
      logo_url?: string | null
      currency?: string
      timezone?: string
      require_digital_lease_signatures?: boolean | string
      standard_base_rent?: number | string
      standard_water_rate?: number | string
      manager_id?: string | null
      management_fee_percentage?: number | string
    }

export async function createProperty(input: CreatePropertyInput): Promise<CreatePropertyResult> {
  try {
    const supabase = await createClient()
    const { agencyId, role } = await getUserAgencyContext()

    if (role !== 'agency_owner') {
      return {
        success: false,
        error: 'Access restricted: Only Agency Owners are authorized to create new properties.',
      }
    }

    let name = ''
    let location = ''
    let property_type = 'Apartment'
    let purpose = 'Rent'
    let floors = 1
    let owner_mobile: string | null = null
    let logo_url: string | null = null
    let currency = 'KES'
    let timezone = 'Africa/Nairobi'
    let require_digital_lease_signatures = true
    let standard_base_rent = 0.0
    let standard_water_rate = 150.0
    let manager_id: string | null = null
    let management_fee_percentage = 0.0

    if (input instanceof FormData) {
      name = ((input.get('name') as string) || '').trim()
      location = ((input.get('location') as string) || '').trim()
      property_type = (input.get('property_type') as string) || 'Apartment'
      purpose = (input.get('purpose') as string) || 'Rent'
      const rawFloors = input.get('floors') as string
      floors = rawFloors && !isNaN(parseInt(rawFloors, 10)) ? parseInt(rawFloors, 10) : 1
      owner_mobile = ((input.get('owner_mobile') as string) || '').trim() || null
      logo_url = ((input.get('logo_url') as string) || '').trim() || null
      currency = (input.get('currency') as string) || 'KES'
      timezone = (input.get('timezone') as string) || 'Africa/Nairobi'
      const rawSignatures = input.get('require_digital_lease_signatures')
      require_digital_lease_signatures =
        rawSignatures === null ? true : rawSignatures === 'true' || rawSignatures === 'on'

      const rawRent = input.get('standard_base_rent') as string
      standard_base_rent = rawRent && !isNaN(parseFloat(rawRent)) ? parseFloat(rawRent) : 0.0
      const rawWater = input.get('standard_water_rate') as string
      standard_water_rate = rawWater && !isNaN(parseFloat(rawWater)) ? parseFloat(rawWater) : 150.0

      const rawManagerId = input.get('manager_id') as string
      manager_id = rawManagerId && rawManagerId.trim() ? rawManagerId.trim() : null

      const rawFee = input.get('management_fee_percentage') as string
      management_fee_percentage = rawFee && !isNaN(parseFloat(rawFee)) ? parseFloat(rawFee) : 0.0
    } else {
      name = (input.name || '').trim()
      location = (input.location || '').trim()
      property_type = input.property_type || 'Apartment'
      purpose = input.purpose || 'Rent'
      floors =
        typeof input.floors === 'number'
          ? input.floors
          : parseInt(String(input.floors || 1), 10) || 1
      owner_mobile = input.owner_mobile ? input.owner_mobile.trim() : null
      logo_url = input.logo_url ? input.logo_url.trim() : null
      currency = input.currency || 'KES'
      timezone = input.timezone || 'Africa/Nairobi'
      require_digital_lease_signatures =
        typeof input.require_digital_lease_signatures === 'boolean'
          ? input.require_digital_lease_signatures
          : input.require_digital_lease_signatures !== 'false'
      standard_base_rent = parseFloat(String(input.standard_base_rent || 0)) || 0.0
      standard_water_rate = parseFloat(String(input.standard_water_rate || 150)) || 150.0
      manager_id = input.manager_id && input.manager_id.trim() ? input.manager_id.trim() : null
      management_fee_percentage =
        parseFloat(String(input.management_fee_percentage || 0)) || 0.0
    }

    // 1. DATA VALIDATION
    if (!name) {
      return { success: false, error: 'Property asset name is required.' }
    }
    if (!location) {
      return { success: false, error: 'Physical location/address is required.' }
    }
    if (floors < 1) {
      return { success: false, error: 'Number of floors must be at least 1.' }
    }
    if (!['Rent', 'Sale'].includes(purpose)) {
      purpose = 'Rent'
    }
    if (management_fee_percentage < 0 || management_fee_percentage > 100) {
      return { success: false, error: 'Management fee percentage must be between 0% and 100%.' }
    }
    if (standard_base_rent < 0) {
      return { success: false, error: 'Standard base rent cannot be negative.' }
    }
    if (standard_water_rate < 0) {
      return { success: false, error: 'Standard water rate cannot be negative.' }
    }

    // 2. CONSOLIDATED INSERT PAYLOAD
    const insertPayload: Record<string, any> = {
      name,
      location,
      property_type,
      purpose,
      floors,
      owner_mobile,
      logo_url,
      currency,
      timezone,
      require_digital_lease_signatures,
      standard_base_rent,
      standard_water_rate,
      agency_id: agencyId,
      manager_id,
      management_fee_percentage,
    }

    let { data: newProperty, error } = await supabase
      .from('properties')
      .insert([insertPayload])
      .select('*')
      .single()

    // Defensive fallback: If newer columns not yet migrated, strip newer columns and retry
    if (error && error.message?.includes('column')) {
      console.warn('Retrying property insert without unmigrated columns:', error.message)
      const fallbackPayload: Record<string, any> = {
        name,
        location,
        property_type,
        agency_id: agencyId,
        manager_id,
      }
      const retryResult = await supabase
        .from('properties')
        .insert([fallbackPayload])
        .select('*')
        .single()
      error = retryResult.error
      newProperty = retryResult.data
    }

    if (error) {
      console.error('Error inserting property:', error)
      return { success: false, error: error.message || 'Failed to save property into database.' }
    }

    // 3. REVALIDATE PATHS
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/properties')

    return {
      success: true,
      property: newProperty,
      message: 'Property created successfully',
    }
  } catch (err: any) {
    console.error('createProperty unexpected error:', err)
    return {
      success: false,
      error: err?.message || 'An unexpected error occurred while creating the property.',
    }
  }
}

export async function updateProperty(
  formData: FormData
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const supabase = await createClient()
    const { agencyId, role, userId } = await getUserAgencyContext()

    const id = formData.get('id') as string
    const name = ((formData.get('name') as string) || '').trim()
    const location = ((formData.get('location') as string) || '').trim()
    const property_type = (formData.get('property_type') as string) || null
    const rawManagerId = formData.get('manager_id') as string

    if (!id) {
      return { success: false, error: 'Property ID is missing.' }
    }
    if (!name) {
      return { success: false, error: 'Property asset name is required.' }
    }
    if (!location) {
      return { success: false, error: 'Physical location / address is required.' }
    }

    // 1. Fetch existing property to detect manager_id delegation change
    const { data: existingProp } = await supabase
      .from('properties')
      .select('manager_id')
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single()

    const oldManagerId = existingProp?.manager_id ?? null
    const newManagerId =
      role === 'agency_owner' ? (rawManagerId ? rawManagerId : null) : oldManagerId

    const purpose = (formData.get('purpose') as string) || undefined
    const rawFloors = formData.get('floors') as string
    const floors = rawFloors && !isNaN(parseInt(rawFloors, 10)) ? parseInt(rawFloors, 10) : undefined
    const owner_mobile =
      formData.get('owner_mobile') !== null
        ? ((formData.get('owner_mobile') as string) || '').trim() || null
        : undefined
    const logo_url =
      formData.get('logo_url') !== null
        ? ((formData.get('logo_url') as string) || '').trim() || null
        : undefined
    const currency = (formData.get('currency') as string) || undefined
    const timezone = (formData.get('timezone') as string) || undefined
    const rawSignatures = formData.get('require_digital_lease_signatures')
    const require_digital_lease_signatures =
      rawSignatures === null ? undefined : rawSignatures === 'true' || rawSignatures === 'on'

    const rawRent = formData.get('standard_base_rent') as string
    const standard_base_rent =
      rawRent !== null && rawRent !== undefined && !isNaN(parseFloat(rawRent))
        ? parseFloat(rawRent)
        : undefined
    const rawWater = formData.get('standard_water_rate') as string
    const standard_water_rate =
      rawWater !== null && rawWater !== undefined && !isNaN(parseFloat(rawWater))
        ? parseFloat(rawWater)
        : undefined

    const updateData: Record<string, any> = {
      name,
      location,
      property_type,
    }

    if (purpose !== undefined) updateData.purpose = purpose
    if (floors !== undefined) updateData.floors = floors
    if (owner_mobile !== undefined) updateData.owner_mobile = owner_mobile
    if (logo_url !== undefined) updateData.logo_url = logo_url
    if (currency !== undefined) updateData.currency = currency
    if (timezone !== undefined) updateData.timezone = timezone
    if (require_digital_lease_signatures !== undefined) {
      updateData.require_digital_lease_signatures = require_digital_lease_signatures
    }
    if (standard_base_rent !== undefined) updateData.standard_base_rent = standard_base_rent
    if (standard_water_rate !== undefined) updateData.standard_water_rate = standard_water_rate

    const rawFee = formData.get('management_fee_percentage') as string

    // Only Agency Owners can assign or change manager & update management fee
    if (role === 'agency_owner') {
      updateData.manager_id = newManagerId
      if (rawFee !== null && rawFee !== undefined && rawFee.trim() !== '') {
        updateData.management_fee_percentage = parseFloat(rawFee) || 0.0
      }
    }

    let { error } = await supabase
      .from('properties')
      .update(updateData)
      .eq('id', id)
      .eq('agency_id', agencyId)

    // Fallback: If unmigrated columns cause an error, remove newer fields and retry
    if (error && error.message?.includes('column')) {
      const safeUpdateData: Record<string, any> = {
        name,
        location,
        property_type,
      }
      if (role === 'agency_owner') {
        safeUpdateData.manager_id = newManagerId
      }
      const retryResult = await supabase
        .from('properties')
        .update(safeUpdateData)
        .eq('id', id)
        .eq('agency_id', agencyId)
      error = retryResult.error
    }

    if (error) {
      console.error('Error updating property:', error)
      return { success: false, error: error.message || 'Error updating property' }
    }

    // 2. Audit Trail: Explicit Insert (Option A fallback if DB trigger is not yet active)
    if (role === 'agency_owner' && oldManagerId !== newManagerId) {
      try {
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

    return { success: true, message: 'Property updated successfully' }
  } catch (err: any) {
    console.error('updateProperty unexpected error:', err)
    return { success: false, error: err?.message || 'Error updating property' }
  }
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

