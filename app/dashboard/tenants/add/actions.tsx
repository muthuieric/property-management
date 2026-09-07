'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'

export async function addTenant(formData: FormData) {
  const supabase = await createClient()
  const { agencyId } = await getUserAgencyContext()

  const first_name = formData.get('first_name') as string
  const last_name = formData.get('last_name') as string
  const email = formData.get('email') as string
  const phone_number = formData.get('phone_number') as string

  const { data: tenant, error } = await supabase
    .from('tenants')
    .insert([
      { 
        first_name, 
        last_name, 
        email, 
        phone_number,
        agency_id: agencyId // Stamp it!
      }
    ])
    .select() // Return the created tenant so we can use their ID if needed

  if (error) {
    console.error('Error adding tenant:', error)
    redirect('/dashboard/tenants/add?message=Error adding tenant')
  }

  revalidatePath('/dashboard/tenants')
  redirect('/dashboard/tenants')
}