// app/dashboard/maintenance/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { uploadFileToR2 } from '@/utils/storage/r2'
import { getUserAgencyContext } from '@/utils/supabase/get-context'

export async function resolveTicket(formData: FormData) {
  const ticket_id = formData.get('ticket_id') as string
  const supabase = await createClient()

  const { error } = await supabase
    .from('maintenance_tickets')
    .update({ 
      status: 'Resolved',
      resolved_at: new Date().toISOString()
    })
    .eq('id', ticket_id)

  if (error) {
    console.error('Error resolving ticket:', error)
  }

  // Refresh the pages to show updated status instantly
  revalidatePath('/dashboard/maintenance')
  revalidatePath('/dashboard')
  revalidatePath('/portal/maintenance')
  revalidatePath('/portal/clearance')
}

export async function updateTicketDetails(formData: FormData) {
  const supabase = await createClient()

  const ticket_id = formData.get('ticket_id') as string
  const status = formData.get('status') as string
  const contractor_id = formData.get('contractor_id') as string
  const rawCost = formData.get('cost') as string

  if (!ticket_id) return

  const cost = rawCost && !isNaN(parseFloat(rawCost)) ? parseFloat(rawCost) : 0

  const updatePayload: Record<string, any> = {
    status: status || 'Pending',
    assigned_to: contractor_id && contractor_id.trim() ? contractor_id.trim() : null,
    cost: cost,
  }

  if (status === 'Resolved') {
    updatePayload.resolved_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('maintenance_tickets')
    .update(updatePayload)
    .eq('id', ticket_id)

  if (error) {
    console.error('Error updating ticket details:', error)
  }

  revalidatePath('/dashboard/maintenance')
  revalidatePath('/dashboard')
  revalidatePath('/portal/maintenance')
  revalidatePath('/portal/clearance')
}

export async function createTicket(formData: FormData) {
  try {
    const supabase = await createClient()
    const { agencyId } = await getUserAgencyContext()

    const locationData = formData.get('location_data') as string
    const contractor_id = formData.get('contractor_id') as string
    const issue_description = formData.get('issue_description') as string
    const imageFile = formData.get('image') as File | null

    if (!locationData) {
      return { success: false, error: 'Please select a reporting property and tenant.' }
    }

    if (!issue_description || !issue_description.trim()) {
      return { success: false, error: 'Please enter an issue description.' }
    }

    const [unit_id, reported_by] = locationData.split('|')
    let image_url = null

    if (imageFile && imageFile.size > 0) {
      try {
        image_url = await uploadFileToR2(imageFile, 'maintenance-issues')
      } catch (error) {
        console.error('Upload failed:', error)
        return { success: false, error: 'Image upload failed. Please try again.' }
      }
    }

    const { error } = await supabase
      .from('maintenance_tickets')
      .insert([
        { 
          unit_id, 
          reported_by, 
          assigned_to: contractor_id && contractor_id.trim() ? contractor_id.trim() : null,
          issue_description,
          image_url, 
          status: 'Pending',
          agency_id: agencyId
        }
      ])

    if (error) {
      console.error('Error creating ticket:', error)
      return { success: false, error: error.message || 'Error logging maintenance ticket.' }
    }

    revalidatePath('/dashboard/maintenance')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('createTicket error:', err)
    return { success: false, error: err.message || 'Unexpected server error' }
  }
}

export async function addContractor(formData: FormData) {
  try {
    const supabase = await createClient()
    const { agencyId } = await getUserAgencyContext()

    const name = formData.get('name') as string
    const specialty = formData.get('specialty') as string
    const phone_number = formData.get('phone_number') as string
    const email = formData.get('email') as string

    if (!name || !specialty) {
      return { success: false, error: 'Name and Specialty are required.' }
    }

    const { error } = await supabase
      .from('contractors')
      .insert([
        { 
          name, 
          specialty, 
          phone_number: phone_number || null, 
          email: email || null,
          agency_id: agencyId
        }
      ])

    if (error) {
      console.error('Error adding contractor:', error)
      return { success: false, error: error.message || 'Error saving contractor record.' }
    }

    revalidatePath('/dashboard/maintenance')
    return { success: true }
  } catch (err: any) {
    console.error('addContractor error:', err)
    return { success: false, error: err.message || 'Unexpected server error' }
  }
}
