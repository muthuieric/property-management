// app/dashboard/maintenance/contractors/add/page.tsx
import { addContractor } from './actions'
import Link from 'next/link'

export default async function AddContractorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const message = resolvedSearchParams.message

  return (
    <div className="p-4 md:p-8 flex items-center justify-center w-full">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-sm border">
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Add Contractor</h1>
          <Link href="/dashboard/maintenance" className="text-sm text-blue-600 hover:underline">
            Cancel
          </Link>
        </div>

        <form action={addContractor} className="flex flex-col gap-4 text-slate-800">
          
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="name">
              Company or Name
            </label>
            <input
              className="w-full rounded-md px-4 py-2 border bg-gray-50 focus:bg-white"
              name="name"
              placeholder="e.g. Rapid Plumbing Ltd"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="specialty">
              Specialty
            </label>
            <select
              className="w-full rounded-md px-4 py-2 border bg-gray-50 focus:bg-white"
              name="specialty"
              required
            >
              <option value="">-- Select Category --</option>
              <option value="Plumbing">Plumbing</option>
              <option value="Electrical">Electrical</option>
              <option value="General Handyman">General Handyman</option>
              <option value="HVAC">HVAC / AC Repair</option>
              <option value="Painting">Painting</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="phone_number">
              Phone Number
            </label>
            <input
              type="tel"
              className="w-full rounded-md px-4 py-2 border bg-gray-50 focus:bg-white"
              name="phone_number"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="email">
              Email (Optional)
            </label>
            <input
              type="email"
              className="w-full rounded-md px-4 py-2 border bg-gray-50 focus:bg-white"
              name="email"
            />
          </div>

          <button
            type="submit"
            className="mt-4 bg-slate-900 text-white rounded-md px-4 py-2 hover:bg-slate-800 transition"
          >
            Save Contractor
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