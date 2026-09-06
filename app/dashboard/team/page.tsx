// app/dashboard/team/page.tsx
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'
import { inviteManager } from './actions'

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const message = resolvedSearchParams.message

  const supabase = await createClient()
  
  // We grab the context to ensure we only load this agency's team
  const { agencyId, role } = await getUserAgencyContext()

  // Fetch the current team members for this agency
  const { data: teamMembers } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role, created_at')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: true })

  const isOwner = role === 'agency_owner'

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full max-w-6xl mx-auto">
      <header className="mb-8 pb-4 border-b">
        <h1 className="text-3xl font-bold">Team Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your property managers and staff access.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Team Roster */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="text-lg font-semibold">Current Staff</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b text-sm text-gray-500 bg-white">
                    <th className="p-4 font-semibold">Name</th>
                    <th className="p-4 font-semibold">Role</th>
                    <th className="p-4 font-semibold">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMembers?.map((member) => (
                    <tr key={member.id} className="border-b hover:bg-gray-50">
                      <td className="p-4 font-medium text-slate-800">
                        {member.first_name} {member.last_name}
                      </td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${
                          member.role === 'agency_owner' 
                            ? 'bg-purple-100 text-purple-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {member.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        {new Date(member.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: Invite Form */}
        <div>
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold mb-4">Invite Property Manager</h2>
            
            {!isOwner ? (
              <div className="p-4 bg-yellow-50 text-yellow-800 text-sm rounded-md border border-yellow-200">
                Only the Agency Owner can invite new staff members.
              </div>
            ) : (
              <form action={inviteManager} className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">First Name</label>
                  <input
                    name="first_name"
                    required
                    className="w-full rounded-md px-3 py-2 border bg-gray-50 focus:bg-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Last Name</label>
                  <input
                    name="last_name"
                    required
                    className="w-full rounded-md px-3 py-2 border bg-gray-50 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Email Address</label>
                  <input
                    name="email"
                    type="email"
                    required
                    className="w-full rounded-md px-3 py-2 border bg-gray-50 focus:bg-white"
                  />
                </div>

                <button
                  type="submit"
                  className="mt-2 bg-slate-900 text-white rounded-md px-4 py-2 hover:bg-slate-800 transition font-medium"
                >
                  Send Invitation
                </button>

                {message && (
                  <p className="mt-2 text-sm text-center text-slate-700 font-medium p-2 bg-slate-100 rounded">
                    {message}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}