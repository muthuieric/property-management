// app/portal/maintenance/page.tsx
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { createTenantTicket } from './actions'

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function calculateDuration(startStr: string, endStr?: string | null) {
  const start = new Date(startStr).getTime()
  const end = endStr ? new Date(endStr).getTime() : Date.now()
  const diffMs = Math.max(0, end - start)
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 60) return `${diffMinutes}m`
  if (diffHours < 24) return `${diffHours}h ${diffMinutes % 60}m`
  if (diffDays === 1) return `1 day ${diffHours % 24}h`
  return `${diffDays} days`
}

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
    .eq('user_id', user.id)
    .single()

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
      .eq('tenant_id', tenant.id)
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

  const isSuccess = message && message.toLowerCase().includes('success')

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full">
      <header className="mb-8 pb-4 border-b">
        <h1 className="text-3xl font-bold">Maintenance Requests</h1>
        <p className="text-sm text-gray-500 mt-1">
          Report maintenance issues and track repair status for your unit.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Past Tickets List */}
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Your Past Requests</h2>
            <span className="text-xs text-gray-500">
              {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}
            </span>
          </div>

          {!tenant || tickets.length === 0 ? (
            <div className="bg-white border rounded-lg p-8 shadow-sm text-center">
              <div className="h-10 w-10 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium text-sm">No maintenance requests logged yet.</p>
              <p className="text-gray-400 text-xs mt-1">
                If anything needs repair in your unit, submit a request using the form.
              </p>
            </div>
          ) : (
              <div className="flex flex-col gap-4">
                {tickets.map((ticket) => {
                  const isResolved = ticket.status === 'Resolved'
                  const isInProgress = ticket.status === 'In Progress'
                  const isPending = !isResolved && !isInProgress

                  const duration = calculateDuration(ticket.created_at, ticket.resolved_at)

                  return (
                    <div
                      key={ticket.id}
                      className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900 text-base leading-snug">
                            {ticket.issue_description}
                          </h3>
                          <p className="text-xs text-slate-500 mt-1">
                            Unit #{ticket.units?.unit_number} &bull; {ticket.units?.properties?.name}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 self-start shrink-0">
                          {ticket.cost != null && Number(ticket.cost) > 0 && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              KES {Number(ticket.cost).toLocaleString()}
                            </span>
                          )}

                          {isResolved && (
                            <span className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Resolved
                            </span>
                          )}

                          {isInProgress && (
                            <span className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              <span className="h-2 w-2 rounded-full bg-blue-600 animate-ping mr-0.5" />
                              In Progress
                            </span>
                          )}

                          {isPending && (
                            <span className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Pending Review
                            </span>
                          )}
                        </div>
                      </div>

                      {ticket.image_url && (
                        <div className="my-3">
                          <a
                            href={ticket.image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block"
                          >
                            <img
                              src={ticket.image_url}
                              alt="Issue photo"
                              className="max-h-48 rounded-lg border border-gray-200 object-cover hover:opacity-90 transition"
                            />
                          </a>
                        </div>
                      )}

                      {/* Timestamps & Coordinator Accountability */}
                      <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-gray-500">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="flex items-center gap-1 text-slate-600">
                            <span className="text-gray-400">Submitted:</span>
                            <span className="font-medium text-slate-800">{formatDateTime(ticket.created_at)}</span>
                          </span>

                          {ticket.resolved_at && (
                            <>
                              <span>&bull;</span>
                              <span className="flex items-center gap-1 text-emerald-700">
                                <span className="text-gray-400">Resolved:</span>
                                <span className="font-medium">{formatDateTime(ticket.resolved_at)}</span>
                              </span>
                            </>
                          )}
                        </div>

                        <div>
                          {isResolved ? (
                            <span className="inline-flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                              <span>⚡ Resolved in {duration}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                              <span>⏳ Open for {duration}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
          )}
        </div>

        {/* Right Side: Submit Request Form */}
        <div>
          <div className="bg-white rounded-lg shadow-sm border p-6 sticky top-8">
            <h2 className="text-lg font-semibold mb-1">Submit a Request</h2>
            <p className="text-xs text-gray-500 mb-4">
              Requests are sent directly to your property manager.
            </p>

            {message && (
              <div
                className={`mb-4 p-3 rounded-md text-sm border ${
                  isSuccess
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}
              >
                {message}
              </div>
            )}

            {!activeLease ? (
              <div className="p-4 bg-amber-50 text-amber-900 rounded-md border border-amber-200 text-sm">
                <p className="font-semibold mb-1">Active Lease Required</p>
                <p className="text-xs text-amber-800">
                  You do not currently have an active lease on file. Maintenance requests are automatically attached to your leased unit. Please contact management if this is an error.
                </p>
              </div>
            ) : (
              <form action={createTenantTicket} className="flex flex-col gap-4">
                {/* Tied to active lease */}
                <div className="p-3 bg-blue-50/80 rounded-md border border-blue-100 text-xs text-blue-900">
                  <span className="font-semibold block uppercase tracking-wider text-[10px] text-blue-700 mb-0.5">
                    Location (Tied to Your Active Lease)
                  </span>
                  <p className="font-medium text-sm">
                    {activeLease.units?.properties?.name}, Unit #{activeLease.units?.unit_number}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="issue_description"
                    className="block text-sm font-medium mb-1 text-slate-800"
                  >
                    Describe the Issue <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="issue_description"
                    name="issue_description"
                    rows={4}
                    required
                    placeholder="Provide details about the repair needed (e.g. Master bathroom sink is leaking underneath the cabinet...)"
                    className="w-full rounded-md px-3 py-2 border bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="image"
                    className="block text-sm font-medium mb-1 text-slate-800"
                  >
                    Attach Photo (Optional)
                  </label>
                  <input
                    id="image"
                    name="image"
                    type="file"
                    accept="image/*"
                    className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Photos help contractors diagnose and prepare before arriving.
                  </p>
                </div>

                <button
                  type="submit"
                  className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-md transition text-sm shadow-sm"
                >
                  Submit Request
                </button>
              </form>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

