// app/dashboard/property/[id]/add-unit/page.tsx
import { addUnit } from './actions'
import Link from 'next/link'

export default async function AddUnitPage({ 
  params,
  searchParams 
}: { 
  params: Promise<{ id: string }>,
  searchParams: Promise<{ message?: string }>
}) {
  const resolvedParams = await params
  const propertyId = resolvedParams.id
  
  const resolvedSearchParams = await searchParams
  const message = resolvedSearchParams.message

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-slate-900 flex items-center justify-center">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-sm border">
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Add New Unit</h1>
          <Link href={`/dashboard/property/${propertyId}`} className="text-sm text-blue-600 hover:underline">
            Cancel
          </Link>
        </div>

        <form action={addUnit} className="flex flex-col gap-4">
          {/* Hidden input to pass the property ID securely to the server action */}
          <input type="hidden" name="property_id" value={propertyId} />
          
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="unit_number">
              Unit Number / Label
            </label>
            <input
              className="w-full rounded-md px-4 py-2 border bg-gray-50 focus:bg-white"
              name="unit_number"
              placeholder="e.g. A1, 104, Ground Floor"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="base_rent">
              Base Rent Amount (KES)
            </label>
            <input
              type="number"
              className="w-full rounded-md px-4 py-2 border bg-gray-50 focus:bg-white"
              name="base_rent"
              placeholder="e.g. 45000"
              required
            />
          </div>

          <button
            type="submit"
            className="mt-4 bg-green-700 text-white rounded-md px-4 py-2 hover:bg-green-800 transition"
          >
            Save Unit
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