'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context' // 1. Add this import

export async function addUnit(formData: FormData) {
  const supabase = await createClient()
  const { agencyId } = await getUserAgencyContext() // 2. Get the Agency ID

  const property_id = formData.get('property_id') as string
  const unit_number = formData.get('unit_number') as string
  const base_rent = formData.get('base_rent') as string
  const square_footage = formData.get('square_footage') as string

  const { error } = await supabase
    .from('units')
    .insert([
      { 
        property_id, 
        unit_number, 
        base_rent: Number(base_rent) || 0,
        square_footage: square_footage ? Number(square_footage) || null : null,
        is_occupied: false,
        agency_id: agencyId
      }
    ])

  if (error) {
    console.error('Error adding unit:', error)
    redirect(`/dashboard/property/${property_id}?message=Error saving unit`)
  }

  revalidatePath(`/dashboard/property/${property_id}`)
  redirect(`/dashboard/property/${property_id}`)
}