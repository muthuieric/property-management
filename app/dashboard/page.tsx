// app/dashboard/page.tsx
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  // 1. Fetch user for the personalized greeting
  const { data: { user } } = await supabase.auth.getUser()

  // 2. Fetch Summary Stats (using 'head: true' means it only gets the number, not the data!)
  const { count: propertyCount } = await supabase
    .from('properties')
    .select('*', { count: 'exact', head: true })

  const { count: unitCount } = await supabase
    .from('units')
    .select('*', { count: 'exact', head: true })

  const { count: leaseCount } = await supabase
    .from('leases')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  // 3. Fetch the actual properties for the grid display below the stats
  const { data: properties } = await supabase
    .from('properties')
    .select('*')
    .order('name', { ascending: true })

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full">
      <header className="flex justify-between items-end mb-8 pb-4 border-b">
        <div>
          <h1 className="text-3xl font-bold">Portfolio Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Welcome back, {user?.email}</p>
        </div>
        <Link 
          href="/dashboard/add-property" 
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition font-medium text-sm shadow-sm"
        >
          + Add Property
        </Link>
      </header>

      {/* SUMMARY STATS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Total Properties</h3>
          <p className="text-4xl font-bold text-slate-800">{propertyCount || 0}</p>
        </div>
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Total Units</h3>
          <p className="text-4xl font-bold text-slate-800">{unitCount || 0}</p>
        </div>
        <div className="bg-white border rounded-lg p-6 shadow-sm border-b-4 border-b-blue-600">
          <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-2">Active Leases</h3>
          <p className="text-4xl font-bold text-slate-900">{leaseCount || 0}</p>
        </div>
      </div>

      {/* PROPERTIES GRID */}
      <section className="bg-white p-6 rounded-lg shadow-sm border">
        <h2 className="text-xl font-semibold mb-4">Managed Properties</h2>
        
        {!properties || properties.length === 0 ? (
          <p className="text-gray-500 italic">No properties found. Add your first property to begin.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {properties.map((property) => (
              <Link 
                href={`/dashboard/property/${property.id}`} 
                key={property.id} 
                className="block p-5 border rounded-md shadow-sm hover:shadow-md hover:border-blue-300 transition bg-gray-50/50"
              >
                <h3 className="font-bold text-lg text-slate-900">{property.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{property.location}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}