// app/dashboard/properties/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'

export async function createProperty(formData: FormData) {
  const supabase = await createClient()
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
  const { agencyId, role } = await getUserAgencyContext()

  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const location = formData.get('location') as string
  const property_type = (formData.get('property_type') as string) || null
  const rawManagerId = formData.get('manager_id') as string

  if (!id) {
    redirect('/dashboard/properties?message=Property ID missing')
  }

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
    updateData.manager_id = rawManagerId ? rawManagerId : null
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

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/properties')
  revalidatePath(`/dashboard/property/${id}`)
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

