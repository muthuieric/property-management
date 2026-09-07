// app/dashboard/properties/page.tsx
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'
import { createProperty, updateProperty } from './actions'
import Link from 'next/link'

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; message?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const editId = resolvedSearchParams.edit
  const message = resolvedSearchParams.message

  const supabase = await createClient()
  const { agencyId, role } = await getUserAgencyContext()
  const isOwner = role === 'agency_owner'

  // 1. Fetch all users with role 'property_manager' for this agency
  const { data: propertyManagers } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role')
    .eq('agency_id', agencyId)
    .eq('role', 'property_manager')
    .order('first_name', { ascending: true })

  // 2. Fetch all properties for this agency
  const { data: properties } = await supabase
    .from('properties')
    .select('*')
    .eq('agency_id', agencyId)
    .order('name', { ascending: true })

  // Build a quick lookup map for property managers by ID
  const managerMap = new Map<string, string>()
  propertyManagers?.forEach((pm) => {
    const fullName = `${pm.first_name || ''} ${pm.last_name || ''}`.trim()
    managerMap.set(pm.id, fullName || 'Unnamed Manager')
  })

  // 3. Check if we are currently editing a specific property
  const propertyToEdit = editId
    ? properties?.find((p) => p.id === editId) || null
    : null
  const isEditing = Boolean(propertyToEdit)

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full max-w-7xl mx-auto">
      <header className="mb-8 pb-4 border-b flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Properties</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your properties and assign property managers.
          </p>
        </div>
        {isEditing && (
          <Link
            href="/dashboard/properties"
            className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1.5 rounded-md transition"
          >
            + Add New Property
          </Link>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Property List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Managed Properties</h2>
              <span className="text-xs text-gray-500">
                {properties?.length || 0} Total
              </span>
            </div>

            {!properties || properties.length === 0 ? (
              <div className="p-8 text-center text-gray-500 italic">
                No properties registered yet. Fill out the form to add your first property.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b text-sm text-gray-500 bg-white">
                      <th className="p-4 font-semibold">Property Name</th>
                      <th className="p-4 font-semibold">Location</th>
                      <th className="p-4 font-semibold">Assigned Manager</th>
                      <th className="p-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {properties.map((prop) => {
                      const managerName = prop.manager_id
                        ? managerMap.get(prop.manager_id) || 'Assigned Manager'
                        : null

                      const isCurrentEditing = prop.id === editId

                      return (
                        <tr
                          key={prop.id}
                          className={`border-b hover:bg-gray-50 transition ${
                            isCurrentEditing ? 'bg-blue-50/60' : ''
                          }`}
                        >
                          <td className="p-4 font-medium text-slate-900">
                            <Link
                              href={`/dashboard/property/${prop.id}`}
                              className="text-blue-600 hover:underline"
                            >
                              {prop.name}
                            </Link>
                          </td>
                          <td className="p-4 text-sm text-gray-600">
                            {prop.location}
                          </td>
                          <td className="p-4 text-sm">
                            {managerName ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                {managerName}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                Unassigned
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right text-sm space-x-2">
                            <Link
                              href={`/dashboard/properties?edit=${prop.id}`}
                              className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                            >
                              Edit
                            </Link>
                            <span className="text-gray-300">|</span>
                            <Link
                              href={`/dashboard/property/${prop.id}`}
                              className="text-gray-600 hover:text-gray-900 hover:underline"
                            >
                              Units &rarr;
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: 'Add/Edit Property' Form */}
        <div>
          <div className="bg-white rounded-lg shadow-sm border p-6 sticky top-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                {isEditing ? 'Edit Property' : 'Add Property'}
              </h2>
              {isEditing && (
                <Link
                  href="/dashboard/properties"
                  className="text-xs text-gray-500 hover:text-gray-800 underline"
                >
                  Cancel Edit
                </Link>
              )}
            </div>

            <form
              action={isEditing ? updateProperty : createProperty}
              className="flex flex-col gap-4"
            >
              {isEditing && (
                <input type="hidden" name="id" value={propertyToEdit.id} />
              )}

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="name">
                  Property Name
                </label>
                <input
                  id="name"
                  name="name"
                  defaultValue={propertyToEdit?.name || ''}
                  placeholder="e.g. Sunrise Apartments"
                  required
                  className="w-full rounded-md px-3 py-2 border bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="location">
                  Location
                </label>
                <input
                  id="location"
                  name="location"
                  defaultValue={propertyToEdit?.location || ''}
                  placeholder="e.g. Westlands, Nairobi"
                  required
                  className="w-full rounded-md px-3 py-2 border bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Property Manager Dropdown */}
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="manager_id">
                  Assigned Property Manager
                </label>
                {isOwner ? (
                  <>
                    <select
                      id="manager_id"
                      name="manager_id"
                      defaultValue={propertyToEdit?.manager_id || ''}
                      className="w-full rounded-md px-3 py-2 border bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <p className="font-medium">
                      {propertyToEdit?.manager_id
                        ? managerMap.get(propertyToEdit.manager_id) || 'Assigned'
                        : 'Unassigned'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Only the Agency Owner can assign or change property managers.
                    </p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="mt-2 bg-slate-900 text-white rounded-md px-4 py-2.5 hover:bg-slate-800 transition font-medium text-sm shadow-sm"
              >
                {isEditing ? 'Update Property' : 'Save Property'}
              </button>

              {message && (
                <p className="mt-2 text-sm text-center text-slate-700 font-medium p-2 bg-slate-100 rounded border">
                  {message}
                </p>
              )}
            </form>
          </div>
        </div>

      </div>
    </div>
  )
}

