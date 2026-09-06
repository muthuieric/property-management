// app/dashboard/maintenance/tickets/new/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { uploadFileToR2 } from '@/utils/storage/r2'
import { getUserAgencyContext } from '@/utils/supabase/get-context' // <-- Added

export async function createTicket(formData: FormData) {
  const supabase = await createClient()
  const { agencyId } = await getUserAgencyContext() // <-- Added

  const locationData = formData.get('location_data') as string
  const contractor_id = formData.get('contractor_id') as string
  const issue_description = formData.get('issue_description') as string
  const imageFile = formData.get('image') as File | null

  if (!locationData) {
    redirect('/dashboard/maintenance/tickets/new?message=Please select a property and tenant')
  }

  const [unit_id, reported_by] = locationData.split('|')
  let image_url = null

  if (imageFile && imageFile.size > 0) {
    try {
      image_url = await uploadFileToR2(imageFile, 'maintenance-issues')
    } catch (error) {
      console.error('Upload failed:', error)
      redirect('/dashboard/maintenance/tickets/new?message=Image upload failed')
    }
  }

  // Insert the ticket with the agency_id
  const { error } = await supabase
    .from('maintenance_tickets')
    .insert([
      { 
        unit_id, 
        reported_by, 
        assigned_to: contractor_id || null,
        issue_description,
        image_url, 
        status: 'Open',
        agency_id: agencyId // <-- Stamped with Agency ID
      }
    ])

  if (error) {
    console.error('Error creating ticket:', error)
    redirect('/dashboard/maintenance/tickets/new?message=Error creating ticket')
  }

  revalidatePath('/dashboard/maintenance')
  redirect('/dashboard/maintenance')
}