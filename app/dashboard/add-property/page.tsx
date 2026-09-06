// app/dashboard/add-property/page.tsx
import { addProperty } from './actions'
import Link from 'next/link'

export default async function AddPropertyPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  // Await the searchParams promise here
  const resolvedSearchParams = await searchParams
  const message = resolvedSearchParams.message

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
              className="w-full rounded-md px-4 py-2 border bg-gray-50 focus:bg-white"
              name="location"
              placeholder="e.g. Westlands, Nairobi"
              required
            />
          </div>

          <button
            type="submit"
            className="mt-4 bg-green-700 text-white rounded-md px-4 py-2 hover:bg-green-800 transition"
          >
            Save Property
          </button>

          {/* Update this line to just use the message variable */}
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