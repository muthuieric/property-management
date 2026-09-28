// app/dashboard/leasing/page.tsx
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'
import LeasingKanbanBoard from './components/LeasingKanbanBoard'
import { UnitOption, TenantOption } from '@/app/dashboard/components/CreateLeaseDrawer'
import { getLeads } from './actions'

export const dynamic = 'force-dynamic'

export default async function LeasingPage() {
  const supabase = await createClient()
  const { agencyId, userId, role } = await getUserAgencyContext()
  const isOwner = role === 'agency_owner'

  // 1. Fetch properties for this agency (scoped to assigned manager if coordinator)
  let propertiesQuery = supabase
    .from('properties')
    .select('id, name')
    .eq('agency_id', agencyId)
    .order('name', { ascending: true })

  if (!isOwner) {
    propertiesQuery = propertiesQuery.eq('manager_id', userId)
  }

  const { data: propertiesData } = await propertiesQuery
  const properties = propertiesData || []
  const assignedPropertyIds = properties.map((p) => p.id)

  // 2. Fetch leads with server-side Enterprise PII Masking
  const leads = await getLeads()

  // 3. Fetch coordinators (property managers / agency owners in this agency)
  const { data: coordinatorsData } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('agency_id', agencyId)
    .in('role', ['property_manager', 'agency_owner'])
    .order('first_name', { ascending: true })

  const coordinators = coordinatorsData || []

  // 4. Fetch vacant units for allocation in CreateLeaseDrawer & matching
  let vacantUnitsQuery = supabase
    .from('units')
    .select(`
      id,
      unit_number,
      base_rent,
      rent_amount,
      property_id,
      properties ( id, name )
    `)
    .eq('agency_id', agencyId)
    .eq('is_occupied', false)
    .order('unit_number', { ascending: true })

  if (!isOwner && assignedPropertyIds.length > 0) {
    vacantUnitsQuery = vacantUnitsQuery.in('property_id', assignedPropertyIds)
  }

  const { data: vUnits } = await vacantUnitsQuery
  const vacantUnits: UnitOption[] = (vUnits || []).map((u: any) => ({
    id: u.id,
    unit_number: u.unit_number,
    base_rent: Number(u.base_rent || u.rent_amount || 0),
    property_name: u.properties?.name || 'Property Site',
  }))

  // 5. Fetch tenants for CreateLeaseDrawer selection
  const { data: tenantsData } = await supabase
    .from('tenants')
    .select('id, first_name, last_name, email, phone_number')
    .eq('agency_id', agencyId)
    .order('first_name', { ascending: true })

  const tenants: TenantOption[] = (tenantsData || []).map((t) => ({
    id: t.id,
    first_name: t.first_name,
    last_name: t.last_name,
    email: t.email || undefined,
    phone_number: t.phone_number || undefined,
  }))

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full max-w-7xl mx-auto space-y-6">
      <LeasingKanbanBoard
        initialLeads={leads}
        properties={properties}
        coordinators={coordinators}
        vacantUnits={vacantUnits}
        tenants={tenants}
      />
    </div>
  )
}

