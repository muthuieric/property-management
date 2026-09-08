// app/signup/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function registerAgency(formData: FormData) {
  const supabase = await createClient()

  const first_name = formData.get('first_name') as string
  const last_name = formData.get('last_name') as string
  const agency_name = formData.get('agency_name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!first_name || !last_name || !agency_name || !email || !password) {
    redirect('/signup?message=All fields are required')
  }

  // 1. Call supabase.auth.signUp() with email and password
  const {
    data: { user },
    error: signUpError,
  } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name,
        last_name,
      },
    },
  })

  if (signUpError || !user) {
    console.error('Sign up error:', signUpError)
    redirect(
      `/signup?message=${encodeURIComponent(
        signUpError?.message || 'Failed to register account'
      )}`
    )
  }

  // 2. Initialize Admin Client using SUPABASE_SERVICE_ROLE_KEY
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 3. INSERT new record into agencies table returning new agency_id
  const { data: agency, error: agencyError } = await supabaseAdmin
    .from('agencies')
    .insert([{ name: agency_name }])
    .select('id')
    .single()

  if (agencyError || !agency) {
    console.error('Agency creation error:', agencyError)
    redirect('/signup?message=Failed to create agency workspace')
  }

  const agencyId = agency.id

  // 4. INSERT / UPSERT into profiles table linking user to agency_id with role 'agency_owner'
  // Pass is_active: true explicitly to prevent immediate lockouts
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert([
      {
        id: user.id,
        agency_id: agencyId,
        role: 'agency_owner',
        first_name,
        last_name,
        is_active: true,
      },
    ])

  if (profileError) {
    console.error('Profile creation error:', profileError)
    redirect('/signup?message=Failed to initialize agency profile')
  }

  // 5. Redirect user to /dashboard upon success
  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
