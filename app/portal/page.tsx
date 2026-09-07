// app/portal/page.tsx
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function TenantDashboardPage() {
  const supabase = await createClient()

  // 1. Get logged-in user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  // 2. Fetch the tenant record linked to this user_id
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // 3. Fetch active lease(s) for this tenant
  let activeLease: any = null

  if (tenant) {
    const { data: leases } = await supabase
      .from('leases')
      .select(`
        id,
        start_date,
        end_date,
        deposit_amount,
        is_active,
        units (
          id,
          unit_number,
          base_rent,
          properties (
            name,
            location
          )
        )
      `)
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('start_date', { ascending: false })

    if (leases && leases.length > 0) {
      activeLease = leases[0]
    }
  }

  const tenantName = tenant
    ? `${tenant.first_name} ${tenant.last_name}`
    : user.email

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full">
      {/* Header */}
      <header className="mb-8 pb-4 border-b">
        <h1 className="text-3xl font-bold">My Lease Overview</h1>
        <p className="text-sm text-gray-500 mt-1">
          Welcome back, {tenantName}. Review your active tenancy and unit details.
        </p>
      </header>

      {!activeLease ? (
        <div className="bg-white border rounded-lg p-8 shadow-sm text-center max-w-2xl mx-auto my-8">
          <div className="h-12 w-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">No Active Lease Found</h2>
          <p className="text-gray-600 text-sm max-w-md mx-auto mb-6">
            We couldn&apos;t find an active lease associated with your tenant account. If you have recently moved in or believe this is an error, please reach out to your property management office.
          </p>
          <div className="text-xs text-gray-500">
            Account email: <span className="font-mono text-slate-700">{user.email}</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Lease Card */}
          <div className="lg:col-span-2">
            <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
              <div className="p-6 border-b bg-gradient-to-r from-slate-900 to-slate-800 text-white">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-800/60">
                      Active Lease
                    </span>
                    <h2 className="text-2xl font-bold mt-2">
                      {activeLease.units?.properties?.name || 'Property'}
                    </h2>
                    <p className="text-slate-300 text-sm mt-0.5">
                      {activeLease.units?.properties?.location || 'Address not listed'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs uppercase tracking-wider text-slate-400 block">Unit</span>
                    <span className="text-2xl font-extrabold text-white">
                      #{activeLease.units?.unit_number}
                    </span>
                  </div>
                </div>
              </div>

              {/* Lease Details Grid */}
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6 bg-white">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                    Monthly Rent
                  </span>
                  <p className="text-2xl font-bold text-slate-900">
                    KES {Number(activeLease.units?.base_rent || 0).toLocaleString()}
                  </p>
                  <span className="text-xs text-gray-500 mt-0.5 block">Due on the 1st of each month</span>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                    Security Deposit
                  </span>
                  <p className="text-2xl font-bold text-slate-900">
                    KES {Number(activeLease.deposit_amount || 0).toLocaleString()}
                  </p>
                  <span className="text-xs text-gray-500 mt-0.5 block">Held in escrow ledger</span>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                    Lease Start Date
                  </span>
                  <p className="text-lg font-semibold text-slate-800">
                    {new Date(activeLease.start_date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                    Lease End Date
                  </span>
                  <p className="text-lg font-semibold text-slate-800">
                    {activeLease.end_date
                      ? new Date(activeLease.end_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                      : 'Ongoing / Periodic'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions & Contact Sidebar */}
          <div className="flex flex-col gap-6">
            <div className="bg-white border rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Need a Repair?</h3>
              <p className="text-sm text-gray-600 mb-4">
                Experiencing maintenance issues in Unit #{activeLease.units?.unit_number}? Report plumbing, electrical, or structural issues directly to property management.
              </p>
              <Link
                href="/portal/maintenance"
                className="inline-flex items-center justify-center w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-md transition shadow-sm text-sm gap-2"
              >
                <span>Submit Maintenance Request</span>
                <span>&rarr;</span>
              </Link>
            </div>

            <div className="bg-slate-50 border rounded-lg p-6">
              <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-3">
                Tenant Information
              </h3>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-xs text-gray-500">Name</dt>
                  <dd className="font-medium text-slate-900">{tenantName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Email</dt>
                  <dd className="font-medium text-slate-900">{tenant?.email || user.email}</dd>
                </div>
                {tenant?.phone && (
                  <div>
                    <dt className="text-xs text-gray-500">Phone</dt>
                    <dd className="font-medium text-slate-900">{tenant.phone}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

