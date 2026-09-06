// app/dashboard/maintenance/contractors/add/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context' // <-- Added

export async function addContractor(formData: FormData) {
  const supabase = await createClient()
  const { agencyId } = await getUserAgencyContext() // <-- Added

  const name = formData.get('name') as string
  const specialty = formData.get('specialty') as string
  const phone_number = formData.get('phone_number') as string
  const email = formData.get('email') as string

  const { error } = await supabase
    .from('contractors')
    .insert([
      { 
        name, 
        specialty, 
        phone_number, 
        email,
        agency_id: agencyId // <-- Stamped with Agency ID
      }
    ])

  if (error) {
    console.error('Error adding contractor:', error)
    redirect('/dashboard/maintenance/contractors/add?message=Error saving contractor')
  }

  revalidatePath('/dashboard/maintenance')
  redirect('/dashboard/maintenance')
}