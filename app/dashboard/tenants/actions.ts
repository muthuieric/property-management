'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'

export async function addTenant(formData: FormData) {
  try {
    const supabase = await createClient()
    const { agencyId } = await getUserAgencyContext()

    const first_name = formData.get('first_name') as string
    const last_name = formData.get('last_name') as string
    const email = formData.get('email') as string
    const phone_number = formData.get('phone_number') as string

    if (!first_name || !last_name || !email || !phone_number) {
      return { success: false, error: 'All fields are required.' }
    }

    const { error } = await supabase
      .from('tenants')
      .insert([
        { 
          first_name, 
          last_name, 
          email, 
          phone_number,
          agency_id: agencyId,
          is_active: true
        }
      ])

    if (error) {
      console.error('Error adding tenant:', error)
      return { success: false, error: error.message || 'Error creating tenant record' }
    }

    revalidatePath('/dashboard/tenants')
    return { success: true }
  } catch (err: any) {
    console.error('addTenant action error:', err)
    return { success: false, error: err.message || 'Unexpected server error' }
  }
}
