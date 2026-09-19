// app/portal/layout.tsx
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import PortalShell from './components/PortalShell'

export default async function TenantPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // 1. Verify user authentication at the layout level
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    redirect('/login')
  }

  // 2. Fetch tenant profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  const displayName = profile?.first_name
    ? `${profile.first_name} ${profile.last_name || ''}`.trim()
    : undefined

  return (
    <PortalShell
      userEmail={user.email || ''}
      userName={displayName}
    >
      {children}
    </PortalShell>
  )
}
