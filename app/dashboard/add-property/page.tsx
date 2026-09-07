// app/dashboard/add-property/page.tsx
import { addProperty } from './actions'
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'
import Link from 'next/link'

export default async function AddPropertyPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const message = resolvedSearchParams.message

  const supabase = await createClient()
  const { agencyId, role } = await getUserAgencyContext()
  const isOwner = role === 'agency_owner'

  // Fetch all property managers for this agency
  const { data: propertyManagers } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role')
    .eq('agency_id', agencyId)
    .eq('role', 'property_manager')
    .order('first_name', { ascending: true })

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-slate-900 flex items-center justify-center">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-sm border">
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Add New Property</h1>
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
            Cancel
          </Link>
        </div>

        <form action={addProperty} className="flex flex-col gap-4">
          
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="name">
              Property Name
            </label>
            <input
              id="name"
              className="w-full rounded-md px-4 py-2 border bg-gray-50 focus:bg-white"
              name="name"
              placeholder="e.g. Sunrise Apartments"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="location">
              Location
            </label>
            <input
              id="location"
              className="w-full rounded-md px-4 py-2 border bg-gray-50 focus:bg-white"
              name="location"
              placeholder="e.g. Westlands, Nairobi"
              required
            />
          </div>

          {/* Property Manager Dropdown */}
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="manager_id">
              Assign Property Manager
            </label>
            {isOwner ? (
              <>
                <select
                  id="manager_id"
                  name="manager_id"
                  className="w-full rounded-md px-4 py-2 border bg-gray-50 focus:bg-white"
                  defaultValue=""
                >
                  <option value="">-- Select Property Manager (Optional) --</option>
                  {propertyManagers && propertyManagers.length > 0 ? (
                    propertyManagers.map((manager) => {
                      const displayName =
                        `${manager.first_name || ''} ${manager.last_name || ''}`.trim() ||
                        `Manager (${manager.id.slice(0, 6)})`
                      return (
                        <option key={manager.id} value={manager.id}>
                          {displayName}
                        </option>
                      )
                    })
                  ) : (
                    <option value="" disabled>
                      No property managers registered
                    </option>
                  )}
                </select>
                {(!propertyManagers || propertyManagers.length === 0) && (
                  <p className="text-xs text-amber-600 mt-1">
                    No property managers found. You can invite managers under{' '}
                    <Link href="/dashboard/team" className="underline font-medium">
                      Team Management
                    </Link>
                    .
                  </p>
                )}
              </>
            ) : (
              <div className="rounded-md border bg-gray-100 px-3 py-2 text-sm text-gray-700">
                <p className="font-medium">Unassigned</p>
                <p className="text-xs text-gray-500 mt-1">
                  Only the Agency Owner can assign or change property managers.
                </p>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="mt-4 bg-green-700 text-white rounded-md px-4 py-2 hover:bg-green-800 transition font-medium"
          >
            Save Property
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