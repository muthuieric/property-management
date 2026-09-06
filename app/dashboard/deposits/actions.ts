// app/dashboard/deposits/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export async function endLease(formData: FormData) {
  const supabase = await createClient()

  const lease_id = formData.get('lease_id') as string
  const unit_id = formData.get('unit_id') as string

  // 1. Mark the lease as inactive and set today as the end date
  const { error: leaseError } = await supabase
    .from('leases')
    .update({
      is_active: false,
      end_date: new Date().toISOString().split('T')[0] // Formats as YYYY-MM-DD
    })
    .eq('id', lease_id)

  if (leaseError) {
    console.error('Error ending lease:', leaseError)
    return
  }

  // 2. Mark the unit as vacant again
  const { error: unitError } = await supabase
    .from('units')
    .update({ is_occupied: false })
    .eq('id', unit_id)

  if (unitError) {
    console.error('Error updating unit status:', unitError)
    return
  }

  // 3. Refresh the UI to instantly reflect the changes
  revalidatePath('/dashboard/deposits')
  revalidatePath('/dashboard/tenants')
  revalidatePath('/dashboard')
}