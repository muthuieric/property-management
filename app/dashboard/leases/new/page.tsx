// app/dashboard/leases/new/page.tsx
import { createClient } from '@/utils/supabase/server'
import { createLease } from './actions'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function NewLeasePage({
  searchParams,
}: {
  searchParams: Promise<{ tenant_id?: string; message?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const tenantId = resolvedSearchParams.tenant_id
  const message = resolvedSearchParams.message

  if (!tenantId) {
    notFound() // Safety check: if no tenant_id is in the URL, throw a 404
  }

  const supabase = await createClient()

  // 1. Get the Tenant details
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single()

  if (!tenant) notFound()

  // 2. Get all vacant units, bringing in the Property name via foreign key
  const { data: vacantUnits } = await supabase
    .from('units')
    .select(`
      id, 
      unit_number, 
      base_rent, 
      properties(name)
    `)
    .eq('is_occupied', false)

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-slate-900 flex items-center justify-center">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-sm border">
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Generate Lease</h1>
          <Link href="/dashboard/tenants" className="text-sm text-blue-600 hover:underline">
            Cancel
          </Link>
        </div>

        <div className="mb-6 p-4 bg-blue-50 text-blue-800 rounded-md">
          <p className="text-sm font-semibold">Leasing to:</p>
          <p className="text-lg">{tenant.first_name} {tenant.last_name}</p>
          <p className="text-sm opacity-75">{tenant.email}</p>
        </div>

        <form action={createLease} className="flex flex-col gap-4">
          <input type="hidden" name="tenant_id" value={tenant.id} />
          
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="unit_id">
              Select Vacant Unit
            </label>
            <select
              className="w-full rounded-md px-4 py-2 border bg-gray-50 focus:bg-white"
              name="unit_id"
              required
            >
              <option value="">-- Choose a unit --</option>
              {vacantUnits?.map((unit: any) => (
                <option key={unit.id} value={unit.id}>
                  {unit.properties.name} - Unit {unit.unit_number} (Rent: {unit.base_rent})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="start_date">
              Lease Start Date
            </label>
            <input
              type="date"
              className="w-full rounded-md px-4 py-2 border bg-gray-50 focus:bg-white"
              name="start_date"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="deposit_amount">
              Security Deposit Received (KES)
            </label>
            <input
              type="number"
              className="w-full rounded-md px-4 py-2 border bg-gray-50 focus:bg-white"
              name="deposit_amount"
              placeholder="e.g. 90000"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              * This amount will be locked in the deposit escrow ledger.
            </p>
          </div>

          <button
            type="submit"
            className="mt-4 bg-green-700 text-white rounded-md px-4 py-2 hover:bg-green-800 transition"
          >
            Activate Lease
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