// app/portal/maintenance/page.tsx
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { createTenantTicket } from './actions'
import TenantMaintenanceView from './components/TenantMaintenanceView'

export default async function TenantMaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const message = resolvedSearchParams.message

  const supabase = await createClient()

  // 1. Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  // 2. Fetch tenant profile for auth.uid()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle()

  let activeLease: any = null
  let tickets: any[] = []

  if (tenant) {
    // 3. Fetch active lease for property/unit context
    const { data: lease } = await supabase
      .from('leases')
      .select(`
        id,
        unit_id,
        is_active,
        units (
          unit_number,
          properties (
            name,
            location
          )
        )
      `)
      .or(`tenant_id.eq.${tenant.id},tenant_id.eq.${user.id}`)
      .eq('is_active', true)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    activeLease = lease

    // 4. Fetch past tickets submitted by this tenant
    const { data: tenantTickets } = await supabase
      .from('maintenance_tickets')
      .select(`
        id,
        issue_description,
        status,
        created_at,
        resolved_at,
        cost,
        image_url,
        units (
          unit_number,
          properties (
            name
          )
        )
      `)
      .or(`reported_by.eq.${tenant.id},tenant_id.eq.${tenant.id}`)
      .order('created_at', { ascending: false })

    tickets = tenantTickets || []
  }

  return (
    <TenantMaintenanceView
      tickets={tickets}
      activeLease={activeLease}
      createTicketAction={createTenantTicket}
      message={message}
    />
  )
}
