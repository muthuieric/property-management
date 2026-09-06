// app/dashboard/tenants/page.tsx
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'

export default async function TenantsPage() {
  const supabase = await createClient()

  // Fetch all tenants, ordered by newest first
  const { data: tenants } = await supabase
    .from('tenants')
    .select('*')
    .order('first_name', { ascending: true })

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-slate-900">
      <div className="max-w-6xl mx-auto">
        
        <header className="flex justify-between items-center mb-8 pb-4 border-b">
          <div>
            <Link href="/dashboard" className="text-sm text-blue-600 hover:underline mb-2 block">
              &larr; Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold">Tenant Directory</h1>
          </div>
          <Link 
            href="/dashboard/tenants/add" 
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
          >
            + Register Tenant
          </Link>
        </header>

        <section className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {!tenants || tenants.length === 0 ? (
            <div className="p-6 text-center text-gray-500 italic">
              No tenants registered yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    <th className="p-4 font-semibold">Name</th>
                    <th className="p-4 font-semibold">Email</th>
                    <th className="p-4 font-semibold">Phone</th>
                    <th className="p-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => (
                    <tr key={tenant.id} className="border-b hover:bg-gray-50 transition">
                      <td className="p-4 font-medium">{tenant.first_name} {tenant.last_name}</td>
                      <td className="p-4 text-gray-600">{tenant.email}</td>
                      <td className="p-4 text-gray-600">{tenant.phone_number}</td>
                      <td className="p-4 text-right">
                        <Link 
                          href={`/dashboard/leases/new?tenant_id=${tenant.id}`}
                          className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full hover:bg-green-200 transition"
                        >
                          Create Lease
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </div>
  )
}