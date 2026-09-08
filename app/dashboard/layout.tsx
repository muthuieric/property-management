// app/dashboard/layout.tsx
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from './components/DashboardShell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  
  // Verify user once at the layout level
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  // Fetch profile to identify role and display name
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, first_name, last_name')
    .eq('id', user.id)
    .maybeSingle()

  const userRole = profile?.role || 'agency_owner'
  const userName = profile?.first_name 
    ? `${profile.first_name} ${profile.last_name || ''}`.trim()
    : undefined

  return (
    <DashboardShell
      userEmail={user.email || 'admin@test.com'}
      userRole={userRole}
      userName={userName}
    >
      {children}
    </DashboardShell>
  )
}
