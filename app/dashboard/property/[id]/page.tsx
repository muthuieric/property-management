// app/dashboard/property/[id]/page.tsx
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function PropertyPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const supabase = await createClient()
  
  // Next.js 15+ requires awaiting params
  const resolvedParams = await params
  const propertyId = resolvedParams.id

  // 1. Fetch the specific property
  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .single()

  if (!property) notFound()

  // 2. Fetch assigned property manager details if manager_id exists
  let managerName: string | null = null
  if (property.manager_id) {
    const { data: managerProfile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', property.manager_id)
      .single()
    if (managerProfile) {
      managerName = `${managerProfile.first_name || ''} ${managerProfile.last_name || ''}`.trim()
    }
  }

  // 3. Fetch all units linked to this property
  const { data: units } = await supabase
    .from('units')
    .select('*')
    .eq('property_id', propertyId)
    .order('unit_number', { ascending: true })

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-slate-900">
      <div className="max-w-6xl mx-auto">
        
        <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8 pb-4 border-b">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
                &larr; Dashboard
              </Link>
              <span className="text-gray-300">/</span>
              <Link href="/dashboard/properties" className="text-sm text-blue-600 hover:underline">
                Properties
              </Link>
            </div>
            <h1 className="text-3xl font-bold">{property.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1.5">
              <p className="text-sm text-gray-500">{property.location}</p>
              <span className="text-gray-300">&bull;</span>
              <div className="text-xs">
                {managerName ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-800">
                    Manager: {managerName}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                    No Manager Assigned
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              href={`/dashboard/properties?edit=${propertyId}`}
              className="border border-gray-300 bg-white text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition font-medium text-sm shadow-sm"
            >
              Edit Property
            </Link>
            <Link 
              href={`/dashboard/property/${propertyId}/add-unit`} 
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition font-medium text-sm shadow-sm"
            >
              + Add Unit
            </Link>
          </div>
        </header>

        <section className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold mb-4">Property Units</h2>
          
          {!units || units.length === 0 ? (
            <p className="text-gray-500 italic">No units added yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {units.map((unit) => (
                <div key={unit.id} className="p-4 border rounded-md shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-lg">Unit {unit.unit_number}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${unit.is_occupied ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {unit.is_occupied ? 'Occupied' : 'Vacant'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">Rent: KES {unit.base_rent}</p>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}