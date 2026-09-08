// app/dashboard/team/page.tsx
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { inviteManager, assignPropertiesFormAction, toggleUserStatusFormAction } from './actions'
import PortfolioAssignmentDrawer, { PropertyItem } from './PortfolioAssignmentDrawer'

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const message = resolvedSearchParams.message

  const supabase = await createClient()
  const { agencyId, role } = await getUserAgencyContext()

  // Strict Access Control: Agency Owner is the ONLY role permitted on this page
  if (role !== 'agency_owner') {
    redirect('/dashboard?message=Access restricted: Team management is reserved for the Agency Owner.')
  }

  // 1. Fetch all profiles where agency_id matches the owner and role is 'property_manager'
  const { data: managers } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role, created_at, is_active')
    .eq('agency_id', agencyId)
    .eq('role', 'property_manager')
    .order('created_at', { ascending: true })

  // Also fetch all agency owners for full team transparency
  const { data: owners } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role, created_at')
    .eq('agency_id', agencyId)
    .eq('role', 'agency_owner')
    .order('created_at', { ascending: true })

  // 2. Fetch all agency properties to populate assignment selectors
  const { data: allProperties } = await supabase
    .from('properties')
    .select('id, name, location, manager_id')
    .eq('agency_id', agencyId)
    .order('name', { ascending: true })

  const agencyProperties = allProperties || []
  const managerList = managers || []
  const ownerList = owners || []
  const propertyIds = agencyProperties.map((p) => p.id)

  // 3. Fetch units and maintenance tickets to calculate property metrics
  let units: any[] = []
  if (propertyIds.length > 0) {
    const { data: allUnits } = await supabase
      .from('units')
      .select('id, property_id, is_occupied')
      .in('property_id', propertyIds)
    units = allUnits || []
  }

  const { data: openTicketsData } = await supabase
    .from('maintenance_tickets')
    .select('id, unit_id, status')
    .eq('agency_id', agencyId)
    .neq('status', 'Resolved')

  const openTickets = openTicketsData || []

  // Precompute metrics per property for the assignment drawer
  const propertyItems: PropertyItem[] = agencyProperties.map((p) => {
    const propUnits = units.filter((u) => u.property_id === p.id)
    const propUnitIds = new Set(propUnits.map((u) => u.id))
    const openTicketsCount = openTickets.filter((t) => propUnitIds.has(t.unit_id)).length
    const occupiedUnits = propUnits.filter((u) => u.is_occupied).length

    return {
      id: p.id,
      name: p.name,
      location: p.location,
      manager_id: p.manager_id,
      openTicketsCount,
      occupiedUnits,
    }
  })

  // Create lookup maps for profiles
  const profileNameMap = new Map<string, string>()
  const managerNameMapRecord: Record<string, string> = {}

  managerList.forEach((m) => {
    const name = `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'Coordinator'
    profileNameMap.set(m.id, name)
    managerNameMapRecord[m.id] = name
  })

  ownerList.forEach((o) => {
    const name = `${o.first_name || ''} ${o.last_name || ''}`.trim() || 'Agency Owner'
    profileNameMap.set(o.id, name)
  })

  const propertyNameMap = new Map<string, string>()
  agencyProperties.forEach((p) => propertyNameMap.set(p.id, p.name))

  // 4. Fetch recent assignment logs for the Audit Trail
  let assignmentLogs: any[] = []
  try {
    const { data: logs } = await supabase
      .from('assignment_logs')
      .select('id, property_id, changed_by, old_manager_id, new_manager_id, created_at')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
      .limit(10)
    assignmentLogs = logs || []
  } catch (err) {
    console.warn('Could not query assignment_logs (table may not exist yet):', err)
  }

  const isSuccess = message && message.toLowerCase().includes('success')

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-900 text-white shadow-xs">
              Agency Owner Access Only
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {agencyProperties.length} Portfolio Sites &bull; {managerList.length} Active Coordinators
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 font-sans">
            Team Management & Portfolio Delegation
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Invite coordinators, assign properties to managers, and securely delegate operational ownership.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard"
            className="border border-slate-200 bg-white text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-all duration-200 ease-in-out font-semibold text-xs shadow-xs"
          >
            &larr; Executive Overview
          </Link>
        </div>
      </header>

      {/* Message Feedback Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl text-xs border flex items-center justify-between transition-all duration-200 ${
            isSuccess
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-900 border-amber-200'
          }`}
        >
          <span className="font-medium">{message}</span>
        </div>
      )}

      {/* Main Grid: Team Management & Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left 2 Columns: Coordinators Roster & Audit Trail */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Section: Property Coordinators Bento Roster */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Property Coordinators Roster</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Portfolio delegation cards with active site counts, managed units, and work order volume.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 tabular-nums">
                {managerList.length} {managerList.length === 1 ? 'Coordinator' : 'Coordinators'}
              </span>
            </div>

            {managerList.length === 0 ? (
              <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-12 text-center text-slate-500">
                <svg className="w-10 h-10 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
                <p className="font-semibold text-slate-700 text-sm">No Property Coordinators Registered</p>
                <p className="text-xs text-slate-400 mt-1">Use the invitation form to onboard your first site manager.</p>
              </div>
            ) : (
              /* Bento Grid of Coordinators */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {managerList.map((manager) => {
                  const managerName = `${manager.first_name || ''} ${manager.last_name || ''}`.trim() || 'Property Manager'
                  const assignedProps = agencyProperties.filter((p) => p.manager_id === manager.id)
                  const assignedPropIds = new Set(assignedProps.map((p) => p.id))
                  const isActive = manager.is_active !== false

                  // Metrics for this coordinator
                  const managedUnitsCount = units.filter((u) => assignedPropIds.has(u.property_id)).length
                  const managerOpenTicketsCount = openTickets.filter((t) => {
                    const ticketProp = units.find((u) => u.id === t.unit_id)?.property_id
                    return ticketProp && assignedPropIds.has(ticketProp)
                  }).length

                  return (
                    <div
                      key={manager.id}
                      className={`bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between transition-all duration-200 ${
                        !isActive ? 'opacity-50 grayscale' : 'hover:border-slate-300'
                      }`}
                    >
                      <div>
                        {/* Top: Coordinator Header */}
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                isActive
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-slate-200 text-slate-500'
                              }`}
                            >
                              {manager.first_name?.[0] || 'C'}
                              {manager.last_name?.[0] || ''}
                            </div>
                            <div>
                              <h3 className="font-bold text-sm text-slate-900 leading-tight">
                                {managerName}
                              </h3>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Joined {new Date(manager.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </p>
                            </div>
                          </div>

                          {isActive ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 uppercase tracking-wider">
                              Suspended
                            </span>
                          )}
                        </div>

                        {/* Middle: Micro Bento Metrics */}
                        <div className="grid grid-cols-3 gap-2 py-3 px-3.5 bg-slate-50 rounded-xl border border-slate-100 mb-4 text-center">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sites</span>
                            <span className="text-base font-bold text-slate-900 tabular-nums">
                              {assignedProps.length}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Units</span>
                            <span className="text-base font-bold text-slate-900 tabular-nums">
                              {managedUnitsCount}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tickets</span>
                            <span
                              className={`text-base font-bold tabular-nums ${
                                managerOpenTicketsCount > 0 ? 'text-rose-600' : 'text-slate-900'
                              }`}
                            >
                              {managerOpenTicketsCount}
                            </span>
                          </div>
                        </div>

                        {/* Assigned Sites Chips */}
                        <div className="space-y-1.5 mb-5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                            Assigned Portfolio
                          </span>
                          {assignedProps.length === 0 ? (
                            <span className="text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 inline-block">
                              ⚠️ No sites assigned. Delegation required.
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                              {assignedProps.map((p) => (
                                <span
                                  key={p.id}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg bg-white text-slate-700 border border-slate-200 shadow-2xs"
                                >
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  {p.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Footer: Drawer Trigger & Suspension Toggle */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        {isActive ? (
                          <PortfolioAssignmentDrawer
                            managerId={manager.id}
                            managerName={managerName}
                            properties={propertyItems}
                            managerNameMap={managerNameMapRecord}
                            formAction={assignPropertiesFormAction}
                          />
                        ) : (
                          <span className="text-[11px] text-rose-700 font-medium">
                            Delegation disabled
                          </span>
                        )}

                        <form action={toggleUserStatusFormAction}>
                          <input type="hidden" name="user_id" value={manager.id} />
                          <input type="hidden" name="current_status" value={String(isActive)} />
                          <input type="hidden" name="redirect_path" value="/dashboard/team" />
                          <button
                            type="submit"
                            className={`px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 ease-in-out border shadow-xs ${
                              isActive
                                ? 'bg-white hover:bg-rose-50 text-rose-700 border-rose-200 hover:border-rose-300'
                                : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-md text-white border-transparent'
                            }`}
                          >
                            {isActive ? 'Suspend User' : 'Reactivate'}
                          </button>
                        </form>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* DELEGATION AUDIT TRAIL & ACCOUNTABILITY LOG */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Delegation Audit Trail & Accountability Log
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Immutable log of portfolio reassignments to verify SLA accountability and operational transfers.
                </p>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 font-semibold tabular-nums">
                {assignmentLogs.length} Events
              </span>
            </div>

            {assignmentLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 italic">
                No delegation changes recorded yet. Real-time audit events will appear here when sites are assigned or unassigned.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-50/80 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <th className="p-3 pl-5">Timestamp</th>
                      <th className="p-3">Property Site</th>
                      <th className="p-3">Delegated By</th>
                      <th className="p-3 pr-5">Assignment Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {assignmentLogs.map((log) => {
                      const propName = propertyNameMap.get(log.property_id) || 'Property'
                      const changedByName = profileNameMap.get(log.changed_by) || 'Agency Owner'
                      const oldManagerName = log.old_manager_id ? profileNameMap.get(log.old_manager_id) : 'None (Unassigned)'
                      const newManagerName = log.new_manager_id ? profileNameMap.get(log.new_manager_id) : 'Unassigned'

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/60 transition-all duration-150">
                          <td className="p-3 pl-5 text-slate-500 font-mono text-[11px]">
                            {new Date(log.created_at).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="p-3 font-bold text-slate-900">
                            {propName}
                          </td>
                          <td className="p-3 text-slate-700">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-medium text-[11px]">
                              {changedByName}
                            </span>
                          </td>
                          <td className="p-3 pr-5">
                            <span className="text-slate-400">{oldManagerName}</span>
                            <span className="mx-2 text-slate-400 font-bold">&rarr;</span>
                            <span className={`font-semibold ${log.new_manager_id ? 'text-emerald-700' : 'text-rose-600 italic'}`}>
                              {newManagerName}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Invite New Coordinator & Owners Overview */}
        <div className="space-y-6">
          
          {/* Invite Form Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-8 space-y-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Staff Onboarding
              </span>
              <h2 className="text-lg font-bold text-slate-900">Invite Property Coordinator</h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Send an email invite to onboard a new Property Coordinator. They will receive access to manage only the portfolio sites you delegate to them.
              </p>
            </div>

            <form action={inviteManager} className="flex flex-col gap-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700">First Name</label>
                <input
                  name="first_name"
                  required
                  placeholder="e.g. Samuel"
                  className="w-full rounded-xl px-3.5 py-2.5 border border-slate-200 bg-slate-50/50 focus:bg-white text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition"
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700">Last Name</label>
                <input
                  name="last_name"
                  required
                  placeholder="e.g. Mwangi"
                  className="w-full rounded-xl px-3.5 py-2.5 border border-slate-200 bg-slate-50/50 focus:bg-white text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700">Email Address</label>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="manager@agency.co.ke"
                  className="w-full rounded-xl px-3.5 py-2.5 border border-slate-200 bg-slate-50/50 focus:bg-white text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition"
                />
              </div>

              <button
                type="submit"
                className="mt-2 bg-slate-900 hover:bg-slate-800 hover:shadow-md text-white rounded-xl px-4 py-2.5 cursor-pointer transition-all duration-200 ease-in-out font-semibold text-xs shadow-xs flex items-center justify-center gap-1.5"
              >
                <span>Send Coordinator Invitation</span>
                <span>&rarr;</span>
              </button>
            </form>

            {/* Agency Owners Section */}
            <div className="pt-5 border-t border-slate-200">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                Executive Ownership Oversight
              </h3>
              <div className="divide-y divide-slate-100">
                {ownerList.map((owner) => (
                  <div key={owner.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-900">
                        {owner.first_name} {owner.last_name}
                      </span>
                      <span className="text-slate-400 block text-[11px]">Primary Agency Owner</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full font-semibold bg-slate-900 text-white text-[10px] shadow-2xs">
                      Owner
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
