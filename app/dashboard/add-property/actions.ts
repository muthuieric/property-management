// app/dashboard/add-property/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context' // 1. Import it

export async function addProperty(formData: FormData) {
  const supabase = await createClient()
  
  // 2. Grab the current user's agency ID
  const { agencyId } = await getUserAgencyContext()

  const name = formData.get('name') as string
  const location = formData.get('location') as string
  const property_type = formData.get('property_type') as string

  // 3. Inject it into the insert statement
  const { error } = await supabase
    .from('properties')
    .insert([
      { 
        name, 
        location, 
        property_type,
        agency_id: agencyId // Links the property to the paying customer!
      }
    ])

  if (error) {
    console.error('Error inserting property:', error)
    redirect('/dashboard/add-property?message=Error saving property')
  }

  revalidatePath('/dashboard')
  redirect('/dashboard')
}