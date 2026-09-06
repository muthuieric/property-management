// app/dashboard/deposits/page.tsx
import { createClient } from '@/utils/supabase/server'
import { endLease } from './actions'

export default async function DepositsLedgerPage() {
  const supabase = await createClient()

  // Notice we added `id` inside the `units` block so we can pass it to the action
  const { data: activeLeases } = await supabase
    .from('leases')
    .select(`
      id,
      start_date,
      deposit_amount,
      tenants ( first_name, last_name, email ),
      units (
        id,
        unit_number,
        properties ( name )
      )
    `)
    .eq('is_active', true)
    .order('start_date', { ascending: false })

  const totalEscrow = activeLeases?.reduce(
    (sum, lease) => sum + Number(lease.deposit_amount),
    0
  ) || 0

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full">
      <header className="mb-8 pb-4 border-b">
        <h1 className="text-3xl font-bold">Deposit Escrow Ledger</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track and verify all locked security deposits across your portfolio.
        </p>
      </header>

      <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-lg shadow-sm">
          <h3 className="text-emerald-800 text-sm font-semibold uppercase tracking-wider mb-2">
            Total Funds in Escrow
          </h3>
          <p className="text-4xl font-bold text-emerald-900">
            KES {totalEscrow.toLocaleString()}
          </p>
        </div>
      </div>

      <section className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="p-4 md:p-6 border-b bg-gray-50 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Active Deposits</h2>
        </div>
        
        {!activeLeases || activeLeases.length === 0 ? (
          <div className="p-8 text-center text-gray-500 italic">
            No active deposits found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-white border-b text-sm text-gray-500">
                  <th className="p-4 font-semibold">Tenant</th>
                  <th className="p-4 font-semibold">Property & Unit</th>
                  <th className="p-4 font-semibold">Lease Started</th>
                  <th className="p-4 font-semibold text-right">Deposit Amount</th>
                  <th className="p-4 font-semibold text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeLeases.map((lease: any) => (
                  <tr key={lease.id} className="border-b hover:bg-gray-50 transition">
                    <td className="p-4">
                      <p className="font-medium">
                        {lease.tenants.first_name} {lease.tenants.last_name}
                      </p>
                      <p className="text-xs text-gray-500">{lease.tenants.email}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-gray-800">{lease.units.properties.name}</p>
                      <p className="text-xs text-gray-500">Unit {lease.units.unit_number}</p>
                    </td>
                    <td className="p-4 text-gray-600 text-sm">
                      {new Date(lease.start_date).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right font-bold text-slate-700">
                      KES {Number(lease.deposit_amount).toLocaleString()}
                    </td>
                    <td className="p-4 text-center bg-gray-50/50">
                      {/* The Form that triggers the Move-Out / Refund process */}
                      <form action={endLease}>
                        <input type="hidden" name="lease_id" value={lease.id} />
                        <input type="hidden" name="unit_id" value={lease.units.id} />
                        <button 
                          type="submit" 
                          className="text-sm bg-white border border-red-200 text-red-600 px-3 py-1 rounded-md hover:bg-red-50 hover:border-red-300 transition shadow-sm"
                        >
                          Refund & End Lease
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}