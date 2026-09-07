// app/dashboard/add-property/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'

export async function addProperty(formData: FormData) {
  const supabase = await createClient()
  
  // Grab current user's agency ID and role
  const { agencyId, role } = await getUserAgencyContext()

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
      }
    ])

  if (error) {
    console.error('Error inserting property:', error)
    redirect('/dashboard/add-property?message=Error saving property')
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/properties')
  redirect('/dashboard')
}