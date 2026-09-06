'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'

export async function createLease(formData: FormData) {
  const supabase = await createClient()
  const { agencyId } = await getUserAgencyContext()

  const unit_id = formData.get('unit_id') as string
  const tenant_id = formData.get('tenant_id') as string
  const start_date = formData.get('start_date') as string
  const deposit_amount = formData.get('deposit_amount') as string

  // 1. Create the lease with the agency_id
  const { error: leaseError } = await supabase
    .from('leases')
    .insert([
      { 
        unit_id, 
        tenant_id, 
        start_date, 
        deposit_amount,
        is_active: true,
        agency_id: agencyId // Stamp it!
      }
    ])

  if (leaseError) {
    console.error('Error creating lease:', leaseError)
    redirect('/dashboard/leases/new?message=Error creating lease')
  }

  // 2. Mark the unit as occupied
  await supabase
    .from('units')
    .update({ is_occupied: true })
    .eq('id', unit_id)

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/deposits')
  redirect('/dashboard/deposits')
}