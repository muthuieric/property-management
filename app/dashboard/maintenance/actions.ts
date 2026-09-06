// app/dashboard/maintenance/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export async function resolveTicket(formData: FormData) {
  const ticket_id = formData.get('ticket_id') as string
  const supabase = await createClient()

  const { error } = await supabase
    .from('maintenance_tickets')
    .update({ 
      status: 'Resolved',
      resolved_at: new Date().toISOString()
    })
    .eq('id', ticket_id)

  if (error) {
    console.error('Error resolving ticket:', error)
  }

  // Refresh the page to show the updated status instantly
  revalidatePath('/dashboard/maintenance')
}