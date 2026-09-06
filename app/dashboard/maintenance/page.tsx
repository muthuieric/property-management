// app/dashboard/maintenance/page.tsx
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { resolveTicket } from './actions'

export default async function MaintenancePage() {
  const supabase = await createClient()

  // 1. FETCH CONTRACTORS (This fixes the ReferenceError!)
  const { data: contractors } = await supabase
    .from('contractors')
    .select('*')
    .order('name', { ascending: true })

  // 2. FETCH TICKETS (With the image_url included)
  const { data: tickets } = await supabase
    .from('maintenance_tickets')
    .select(`
      id,
      issue_description,
      status,
      created_at,
      image_url,
      units ( unit_number, properties ( name ) ),
      tenants ( first_name, last_name ),
      contractors ( name )
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full">
      <header className="flex justify-between items-end mb-8 pb-4 border-b">
        <div>
          <h1 className="text-3xl font-bold">Maintenance Hub</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track repairs, manage contractors, and monitor issue resolution.
          </p>
        </div>
        <div className="flex gap-3">
          <Link 
            href="/dashboard/maintenance/contractors/add" 
            className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-md hover:bg-slate-50 transition text-sm font-medium"
          >
            + Add Contractor
          </Link>
          <Link 
            href="/dashboard/maintenance/tickets/new" 
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition text-sm font-medium"
          >
            + New Ticket
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Active Tickets */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Active Tickets</h2>
          <div className="bg-white rounded-lg shadow-sm border p-6">
            {!tickets || tickets.length === 0 ? (
              <p className="text-gray-500 italic text-center py-8">
                No maintenance tickets open. Everything is running smoothly!
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {tickets.map((ticket: any) => (
                  <div key={ticket.id} className="border border-gray-100 p-4 rounded-md shadow-sm hover:shadow-md transition bg-gray-50/50">
                    
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg">{ticket.issue_description}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        ticket.status === 'Resolved' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {ticket.status}
                      </span>
                    </div>

                    {/* RENDER THE IMAGE */}
                    {ticket.image_url && (
                      <div className="my-3">
                        <img 
                          src={ticket.image_url} 
                          alt="Maintenance issue" 
                          className="w-full max-h-56 object-cover rounded-md border border-gray-200"
                        />
                      </div>
                    )}

                    <div className="text-sm text-gray-600 grid grid-cols-2 gap-2 mt-3 mb-4">
                      <p><strong>Location:</strong> {ticket.units?.properties?.name}, Unit {ticket.units?.unit_number}</p>
                      <p><strong>Tenant:</strong> {ticket.tenants?.first_name} {ticket.tenants?.last_name}</p>
                      <p><strong>Contractor:</strong> {ticket.contractors?.name || 'Unassigned'}</p>
                      <p><strong>Reported:</strong> {new Date(ticket.created_at).toLocaleDateString()}</p>
                    </div>

                    {ticket.status !== 'Resolved' && (
                      <form action={resolveTicket} className="border-t pt-3 flex justify-end">
                        <input type="hidden" name="ticket_id" value={ticket.id} />
                        <button 
                          type="submit"
                          className="text-sm bg-white border border-green-600 text-green-700 px-3 py-1 rounded-md hover:bg-green-50 transition shadow-sm"
                        >
                          ✓ Mark as Resolved
                        </button>
                      </form>
                    )}

                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Contractor Directory */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Contractor Directory</h2>
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            {!contractors || contractors.length === 0 ? (
              <p className="text-gray-500 italic p-6 text-center text-sm">
                No contractors added yet.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {contractors.map((contractor) => (
                  <li key={contractor.id} className="p-4 hover:bg-gray-50 transition">
                    <p className="font-bold">{contractor.name}</p>
                    <p className="text-xs text-blue-600 font-medium mb-1">{contractor.specialty}</p>
                    <p className="text-sm text-gray-600">{contractor.phone_number}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}