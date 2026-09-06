// app/dashboard/tenants/add/page.tsx
import { addTenant } from './actions'
import Link from 'next/link'

export default async function AddTenantPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const message = resolvedSearchParams.message

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-slate-900 flex items-center justify-center">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-sm border">
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Register Tenant</h1>
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
            Cancel
          </Link>
        </div>

        <form action={addTenant} className="flex flex-col gap-4">
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="first_name">
                First Name
              </label>
              <input
                className="w-full rounded-md px-4 py-2 border bg-gray-50 focus:bg-white"
                name="first_name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" htmlFor="last_name">
                Last Name
              </label>
              <input
                className="w-full rounded-md px-4 py-2 border bg-gray-50 focus:bg-white"
                name="last_name"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="email">
              Email Address
            </label>
            <input
              type="email"
              className="w-full rounded-md px-4 py-2 border bg-gray-50 focus:bg-white"
              name="email"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="phone_number">
              Phone Number
            </label>
            <input
              type="tel"
              className="w-full rounded-md px-4 py-2 border bg-gray-50 focus:bg-white"
              name="phone_number"
              placeholder="+254..."
              required
            />
          </div>

          <button
            type="submit"
            className="mt-4 bg-green-700 text-white rounded-md px-4 py-2 hover:bg-green-800 transition"
          >
            Save Tenant Profile
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