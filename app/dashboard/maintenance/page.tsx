// app/dashboard/maintenance/page.tsx
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'
import Link from 'next/link'
import { resolveTicket, updateTicketDetails } from './actions'
import MaintenanceActionTriggers from './components/MaintenanceActionTriggers'
import AddContractorButton from './components/AddContractorButton'

function calculateDuration(startStr: string, endStr?: string | null) {
  const start = new Date(startStr).getTime()
  const end = endStr ? new Date(endStr).getTime() : Date.now()
  const diffMs = Math.max(0, end - start)
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 60) return `${diffMinutes}m`
  if (diffHours < 24) return `${diffHours}h ${diffMinutes % 60}m`
  if (diffDays === 1) return `1d ${diffHours % 24}h`
  return `${diffDays} days`
}

export default async function MaintenancePage() {
  const supabase = await createClient()
  const { userId, agencyId, role } = await getUserAgencyContext()

  // 1. Fetch coordinator's assigned properties (or all properties for agency owner)
  let propertiesQuery = supabase
    .from('properties')
    .select('id, name')
    .eq('agency_id', agencyId)

  if (role === 'property_manager') {
    propertiesQuery = propertiesQuery.eq('manager_id', userId)
  }

  const { data: properties } = await propertiesQuery
  let assignedProperties = properties || []

  // Fallback for agency owner if not explicitly assigned
  if (role === 'agency_owner' && assignedProperties.length === 0) {
    const { data: allProps } = await supabase
      .from('properties')
      .select('id, name')
      .eq('agency_id', agencyId)
    assignedProperties = allProps || []
  }

  const propertyIds = assignedProperties.map((p) => p.id)

  // 2. Fetch Contractors for assignment dropdown
  const { data: contractors } = await supabase
    .from('contractors')
    .select('*')
    .eq('agency_id', agencyId)
    .order('name', { ascending: true })

  // 3. Fetch Tickets linked to coordinator's assigned properties (or entire agency for owner)
  let ticketList: any[] = []

  if (role === 'property_manager') {
    if (propertyIds.length === 0) {
      // Coordinators with 0 assigned properties have no active tickets in their scope
      ticketList = []
    } else {
      const { data: tickets, error: ticketsError } = await supabase
        .from('maintenance_tickets')
        .select(`
          id,
          issue_description,
          status,
          created_at,
          resolved_at,
          cost,
          image_url,
          assigned_to,
          unit_id,
          units!inner (
            id,
            unit_number,
            property_id,
            properties!inner ( id, name )
          ),
          tenants:tenants!maintenance_tickets_tenant_id_fkey ( first_name, last_name, phone_number ),
          contractors ( id, name, specialty, phone_number )
        `)
        .eq('agency_id', agencyId)
        .in('units.property_id', propertyIds)
        .order('created_at', { ascending: false })

      if (ticketsError) {
        console.error('Error fetching maintenance tickets:', ticketsError)
      }
      ticketList = tickets || []
    }
  } else {
    // Agency Owner: sees all tickets across the entire agency
    const { data: tickets, error: ticketsError } = await supabase
      .from('maintenance_tickets')
      .select(`
        id,
        issue_description,
        status,
        created_at,
        resolved_at,
        cost,
        image_url,
        assigned_to,
        unit_id,
        units!inner (
          id,
          unit_number,
          property_id,
          properties!inner ( id, name )
        ),
        tenants:tenants!maintenance_tickets_tenant_id_fkey ( first_name, last_name, phone_number ),
        contractors ( id, name, specialty, phone_number )
      `)
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })

    if (ticketsError) {
      console.error('Error fetching maintenance tickets:', ticketsError)
    }
    ticketList = tickets || []
  }

  // 4. Calculate SLA metrics
  const now = Date.now()
  const openTickets = ticketList.filter((t: any) => t.status !== 'Resolved')
  const slaBreachedTickets = openTickets.filter((t: any) => {
    const ageInHours = (now - new Date(t.created_at).getTime()) / (1000 * 60 * 60)
    return ageInHours >= 48
  })

  // 5. Fetch active leases for the Log Ticket Drawer (scoped to assigned properties for coordinators)
  let rawLeases: any[] = []
  if (role === 'property_manager') {
    if (propertyIds.length > 0) {
      const { data } = await supabase
        .from('leases')
        .select(`
          unit_id,
          tenant_id,
          tenants ( first_name, last_name ),
          units!inner ( unit_number, property_id, properties ( name ) )
        `)
        .eq('is_active', true)
        .eq('agency_id', agencyId)
        .in('units.property_id', propertyIds)
      rawLeases = data || []
    }
  } else {
    const { data } = await supabase
      .from('leases')
      .select(`
        unit_id,
        tenant_id,
        tenants ( first_name, last_name ),
        units ( unit_number, properties ( name ) )
      `)
      .eq('is_active', true)
      .eq('agency_id', agencyId)
    rawLeases = data || []
  }

  const activeLeaseOptions = rawLeases?.map((l: any) => ({
    unit_id: l.unit_id,
    tenant_id: l.tenant_id,
    label: `${l.units?.properties?.name || 'Property'}, Unit ${l.units?.unit_number} (${l.tenants?.first_name || ''} ${l.tenants?.last_name || ''})`
  })) || []

  const contractorOptions = contractors?.map((c: any) => ({
    id: c.id,
    name: c.name,
    specialty: c.specialty || 'General',
  })) || []

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-900 text-white shadow-xs">
              Site Operations Hub
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {assignedProperties.length} Sites Monitored &bull; {openTickets.length} Open Work Orders
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 font-sans">
            Maintenance Management Hub
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Oversee repairs, assign contractors, enforce institutional 48h SLAs, and log auditable maintenance costs.
          </p>
        </div>

        <MaintenanceActionTriggers
          activeLeases={activeLeaseOptions}
          contractors={contractorOptions}
        />
      </header>

      {/* SLA AND OPERATIONAL METRIC BENTO CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Total Tickets
          </span>
          <p className="text-3xl font-bold text-slate-900 tabular-nums">{ticketList.length}</p>
          <span className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 block">All recorded tickets</span>
        </div>

        <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block mb-1">
            Active Work Orders
          </span>
          <p className="text-3xl font-bold text-amber-800 tabular-nums">{openTickets.length}</p>
          <span className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 block">Pending & in progress</span>
        </div>

        <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-1">
            <span
              className={`text-xs font-bold uppercase tracking-wider block ${
                slaBreachedTickets.length > 0 ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              48h SLA Breaches
            </span>
            {slaBreachedTickets.length > 0 && (
              <span className="h-2 w-2 rounded-full bg-rose-600 animate-ping" />
            )}
          </div>
          <p
            className={`text-3xl font-bold tabular-nums ${
              slaBreachedTickets.length > 0 ? 'text-rose-700' : 'text-emerald-700'
            }`}
          >
            {slaBreachedTickets.length}
          </p>
          <span className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 block">
            {slaBreachedTickets.length > 0
              ? 'Exceeded 48h resolution limit'
              : '100% on-time SLA adherence'}
          </span>
        </div>

        <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
            Contractor Network
          </span>
          <p className="text-3xl font-bold text-slate-900 tabular-nums">{contractors?.length || 0}</p>
          <span className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 block">Verified trades & specs</span>
        </div>
      </div>

      {/* Main Grid: Ticket Roster (left) & Contractors (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Columns: Elevated Ticket Cards List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center mb-1">
            <h2 className="text-base font-bold text-slate-900">Work Orders & Action Items</h2>
            <span className="text-xs text-slate-500 font-medium">
              {ticketList.length} total across {assignedProperties.length} sites
            </span>
          </div>

          {ticketList.length === 0 ? (
            <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-12 text-center text-slate-500">
              <svg className="w-10 h-10 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="font-semibold text-slate-700 text-sm">No Tickets Found</p>
              <p className="text-xs text-slate-400 mt-1">No maintenance work orders logged for your assigned properties.</p>
            </div>
          ) : (
            ticketList.map((ticket: any) => {
              const isResolved = ticket.status === 'Resolved'
              const isInProgress = ticket.status === 'In Progress'
              const isPending = !isResolved && !isInProgress

              const ageHours = (now - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60)
              const isSlaBreached = !isResolved && ageHours >= 48
              const duration = calculateDuration(ticket.created_at, ticket.resolved_at)
              const tenantInfo = ticket.tenants || (ticket as any)['tenants!maintenance_tickets_tenant_id_fkey']

              return (
                <div
                  key={ticket.id}
                  className={`bg-white shadow-sm border rounded-xl p-6 transition-all duration-150 ${
                    isSlaBreached
                      ? 'border-slate-200 border-l-4 border-l-rose-500'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Top Bar: Title & Status Badges */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-bold text-slate-500 font-mono">
                          #{ticket.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span className="text-slate-300">&bull;</span>
                        <span className="text-xs font-semibold text-slate-800">
                          {ticket.units?.properties?.name} &bull; Unit #{ticket.units?.unit_number}
                        </span>
                      </div>
                      <h3 className="font-bold text-base text-slate-900 leading-snug">
                        {ticket.issue_description}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-start">
                      {/* Status Badges with color psychology */}
                      {isPending && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Pending Review
                        </span>
                      )}
                      {isInProgress && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                          In Progress
                        </span>
                      )}
                      {isResolved && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Resolved ({duration})
                        </span>
                      )}

                      {/* 48h SLA Breach Badge */}
                      {isSlaBreached && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <span>⚠️ SLA Breach ({Math.floor(ageHours)}h)</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Photo Evidence (if uploaded) */}
                  {ticket.image_url && (
                    <div className="my-3">
                      <a
                        href={ticket.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-semibold bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
                      >
                        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>View Attached Photo Evidence</span>
                      </a>
                    </div>
                  )}

                  {/* Tenant Details & Metadata Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs py-3 border-t border-b border-slate-100 my-3">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Tenant</span>
                      <span className="font-semibold text-slate-900 mt-0.5 block">
                        {tenantInfo?.first_name ? `${tenantInfo.first_name} ${tenantInfo.last_name}` : 'Tenant'}
                      </span>
                      {tenantInfo?.phone_number && (
                        <span className="text-[11px] text-slate-500 block">{tenantInfo.phone_number}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Logged On</span>
                      <span className="font-medium text-slate-700 mt-0.5 block">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Assigned Contractor</span>
                      <span className="font-semibold text-slate-900 mt-0.5 block">
                        {ticket.contractors?.name || 'Unassigned'}
                      </span>
                      {ticket.contractors?.specialty && (
                        <span className="text-[11px] text-slate-500 block">{ticket.contractors.specialty}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Repair Cost (KES)</span>
                      <span className="font-bold text-slate-900 text-sm tabular-nums mt-0.5 block">
                        KES {Number(ticket.cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* 
                    ===================================================================
                    COORDINATOR ACTION AREA (GRAY TINTED SUB-SECTION bg-slate-50 p-4)
                    ===================================================================
                  */}
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 mt-4">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center justify-between">
                      <span>Coordinator Dispatch & Resolution</span>
                      <span className="text-[10px] font-normal text-slate-400 normal-case">Actionable SLA controls</span>
                    </div>

                    <form
                      action={updateTicketDetails}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <input type="hidden" name="ticket_id" value={ticket.id} />

                      <div className="flex flex-wrap items-center gap-3 flex-1">
                        {/* Status Selector */}
                        <div>
                          <label className="block text-[10px] uppercase font-semibold text-slate-600 mb-1">
                            Status
                          </label>
                          <select
                            name="status"
                            defaultValue={ticket.status || 'Pending'}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 bg-white font-semibold focus:bg-white text-xs text-slate-800"
                          >
                            <option value="Pending">Pending</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Resolved">Resolved</option>
                          </select>
                        </div>

                        {/* Contractor Selector */}
                        <div className="min-w-[180px]">
                          <label className="block text-[10px] uppercase font-semibold text-slate-600 mb-1">
                            Assign Contractor
                          </label>
                          <select
                            name="contractor_id"
                            defaultValue={ticket.assigned_to || ''}
                            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 bg-white focus:bg-white text-xs text-slate-800"
                          >
                            <option value="">-- Select Contractor --</option>
                            {contractorOptions.map((c: any) => (
                              <option key={c.id} value={c.id}>
                                {c.name} ({c.specialty})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Cost Input */}
                        <div className="w-32">
                          <label className="block text-[10px] uppercase font-semibold text-slate-600 mb-1">
                            Repair Cost (KES)
                          </label>
                          <input
                            type="number"
                            name="cost"
                            step="0.01"
                            defaultValue={ticket.cost || ''}
                            placeholder="0.00"
                            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 bg-white focus:bg-white text-xs text-slate-800 text-right tabular-nums"
                          />
                        </div>
                      </div>

                      {/* Save Changes CTA Button */}
                      <button
                        type="submit"
                        className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded-lg cursor-pointer transition-all duration-200 ease-in-out self-end sm:self-center shadow-xs"
                      >
                        Update Ticket
                      </button>
                    </form>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Right Column: Contractor Roster Mini-Ledger */}
        <div className="space-y-6">
          <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Contractor Network</h2>
                <p className="text-xs text-slate-500">Verified trade partners for dispatch.</p>
              </div>
              <AddContractorButton />
            </div>

            {contractors?.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No contractors registered yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-xs">
                {contractors?.map((contractor: any) => (
                  <li key={contractor.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{contractor.name}</p>
                      <span className="text-[11px] text-slate-500">{contractor.specialty}</span>
                    </div>
                    {contractor.phone_number && (
                      <span className="text-slate-600 font-mono text-[11px] bg-slate-50 px-2 py-1 rounded border border-slate-200">
                        {contractor.phone_number}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
