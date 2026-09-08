// app/auth/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    redirect('/login?message=Email and password are required')
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (signInError) {
    redirect('/login?message=Invalid credentials or account does not exist')
  }

  // Check the user's role and is_active flag in profiles table
  const { data: { user } } = await supabase.auth.getUser()
  let isTenant = false

  if (user) {
    let { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single()

    // Defensive fallback: If RLS blocks profile SELECT for inactive users, verify with admin client
    if (!profile && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { createClient: createAdminClient } = await import('@supabase/supabase-js')
        const admin = createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        const { data: adminProfile } = await admin
          .from('profiles')
          .select('role, is_active')
          .eq('id', user.id)
          .single()

        if (adminProfile) {
          profile = adminProfile
        }
      } catch (err) {
        console.error('Admin profile check error:', err)
      }
    }

    // Security Gate: Verify is_active flag. If false, immediately signOut() and redirect
    if (profile && profile.is_active === false) {
      await supabase.auth.signOut()
      redirect('/login?error=account_suspended')
    }

    if (profile?.role === 'tenant') {
      isTenant = true
    }
  }

  revalidatePath('/', 'layout')

  if (isTenant) {
    redirect('/portal')
  }

  redirect('/dashboard')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
