// app/dashboard/maintenance/tickets/new/page.tsx
import { createClient } from '@/utils/supabase/server'
import { createTicket } from './actions'
import Link from 'next/link'

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const message = resolvedSearchParams.message

  const supabase = await createClient()

  // 1. Fetch active leases so we know exactly who is living in which unit
  const { data: activeLeases } = await supabase
    .from('leases')
    .select(`
      unit_id,
      tenant_id,
      tenants ( first_name, last_name ),
      units ( unit_number, properties ( name ) )
    `)
    .eq('is_active', true)

  // 2. Fetch the contractor directory
  const { data: contractors } = await supabase
    .from('contractors')
    .select('id, name, specialty')
    .order('name', { ascending: true })

  return (
    <div className="p-4 md:p-8 flex items-center justify-center w-full">
      <div className="max-w-xl w-full bg-white p-8 rounded-lg shadow-sm border">
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Log Maintenance Issue</h1>
          <Link href="/dashboard/maintenance" className="text-sm text-blue-600 hover:underline">
            Cancel
          </Link>
        </div>

        <form action={createTicket} className="flex flex-col gap-5 text-slate-800" >
          
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="location_data">
              Tenant & Location
            </label>
            <select
              className="w-full rounded-md px-4 py-2 border bg-gray-50 focus:bg-white"
              name="location_data"
              required
            >
              <option value="">-- Select Reporting Tenant --</option>
              {activeLeases?.map((lease: any) => (
                // We combine both IDs as the value so the server action receives both instantly
                <option key={`${lease.unit_id}-${lease.tenant_id}`} value={`${lease.unit_id}|${lease.tenant_id}`}>
                  {lease.units.properties.name}, Unit {lease.units.unit_number} (Reported by: {lease.tenants.first_name} {lease.tenants.last_name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="issue_description">
              Issue Description
            </label>
            <textarea
              className="w-full rounded-md px-4 py-2 border bg-gray-50 focus:bg-white min-h-[100px]"
              name="issue_description"
              placeholder="e.g. Master bathroom sink is leaking underneath the cabinet..."
              required
            />
          </div>
          {/* New Image Upload Field */}
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="image">
              Attach Photo (Optional)
            </label>
            <input
              type="file"
              accept="image/*"
              className="w-full rounded-md px-4 py-2 border bg-gray-50 focus:bg-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              name="image"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="contractor_id">
              Assign Contractor (Optional)
            </label>
            <select
              className="w-full rounded-md px-4 py-2 border bg-gray-50 focus:bg-white"
              name="contractor_id"
            >
              <option value="">-- Unassigned (Log for later) --</option>
              {contractors?.map((contractor: any) => (
                <option key={contractor.id} value={contractor.id}>
                  {contractor.name} ({contractor.specialty})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              You can log the ticket now and assign a contractor later.
            </p>
          </div>

          <button
            type="submit"
            className="mt-4 bg-blue-600 text-white rounded-md px-4 py-3 font-medium hover:bg-blue-700 transition"
          >
            Create Ticket
          </button>

          {message && (
            <p className="mt-2 text-sm text-red-600 text-center">
              {message}
            </p>
          )}
        </form>
      </div>
    </div>
  )
}