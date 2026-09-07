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

  // 4. Fetch profiles to resolve assigned manager names
  const { data: managers } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('role', 'property_manager')

  const managerMap = new Map<string, string>()
  managers?.forEach((m) => {
    managerMap.set(m.id, `${m.first_name || ''} ${m.last_name || ''}`.trim())
  })

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full">
      <header className="flex justify-between items-end mb-8 pb-4 border-b">
        <div>
          <h1 className="text-3xl font-bold">Portfolio Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Welcome back, {user?.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link 
            href="/dashboard/properties" 
            className="border border-gray-300 bg-white text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition font-medium text-sm shadow-sm"
          >
            Manage Properties
          </Link>
          <Link 
            href="/dashboard/add-property" 
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition font-medium text-sm shadow-sm"
          >
            + Add Property
          </Link>
        </div>
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
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Managed Properties</h2>
          <Link 
            href="/dashboard/properties" 
            className="text-sm text-blue-600 hover:underline font-medium"
          >
            View All &rarr;
          </Link>
        </div>
        
        {!properties || properties.length === 0 ? (
          <p className="text-gray-500 italic">No properties found. Add your first property to begin.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {properties.map((property) => {
              const assignedManager = property.manager_id ? managerMap.get(property.manager_id) : null
              return (
                <Link 
                  href={`/dashboard/property/${property.id}`} 
                  key={property.id} 
                  className="block p-5 border rounded-md shadow-sm hover:shadow-md hover:border-blue-300 transition bg-gray-50/50"
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-lg text-slate-900">{property.name}</h3>
                    {assignedManager && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-800">
                        {assignedManager}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{property.location}</p>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}