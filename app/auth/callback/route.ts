import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function GET(req: Request) {
  const supabase = await createClient()

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/'

  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  }

  // After magic-link sign-in, route tenants to the portal, everyone else to dashboard
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'tenant') {
      redirect('/portal')
    }
  }

  redirect(next)
}
