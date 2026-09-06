// app/dashboard/team/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getUserAgencyContext } from '@/utils/supabase/get-context'

export async function inviteManager(formData: FormData) {
  const { agencyId, role } = await getUserAgencyContext()

  // Security check: Only Agency Owners should be able to invite staff
  if (role !== 'agency_owner') {
    redirect('/dashboard/team?message=Unauthorized: Only agency owners can invite staff')
  }

  const email = formData.get('email') as string
  const first_name = formData.get('first_name') as string
  const last_name = formData.get('last_name') as string

  // Initialize the Admin client to bypass client-side auth restrictions
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Send the invite and inject the metadata for our Database Trigger
  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: {
      first_name,
      last_name,
      role: 'property_manager',
      agency_id: agencyId
    }
  })

  if (error) {
    console.error('Error inviting user:', error)
    redirect('/dashboard/team?message=Failed to send invitation')
  }

  revalidatePath('/dashboard/team')
  redirect('/dashboard/team')
}