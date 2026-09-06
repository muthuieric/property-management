// app/dashboard/layout.tsx
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  
  // Verify user once at the layout level
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      
      {/* 
        SIDEBAR / MOBILE NAV 
        - On mobile (default): A top bar that scrolls horizontally.
        - On desktop (md:): A fixed vertical sidebar on the left.
      */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex flex-col md:min-h-screen shrink-0 shadow-lg z-10">
        <div className="p-4 md:p-6 border-b border-slate-800 flex justify-between items-center md:block">
          <h2 className="text-xl font-bold tracking-tight">Property System</h2>
          <span className="text-xs text-slate-400 block mt-1 md:mt-2 truncate">
            {user.email}
          </span>
        </div>

        <nav className="flex md:flex-col overflow-x-auto md:overflow-x-visible p-2 md:p-4 gap-2 flex-1">
          <Link 
            href="/dashboard" 
            className="whitespace-nowrap px-4 py-3 rounded-md text-sm font-medium hover:bg-slate-800 transition"
          >
            Overview
          </Link>
          <Link 
            href="/dashboard/tenants" 
            className="whitespace-nowrap px-4 py-3 rounded-md text-sm font-medium hover:bg-slate-800 transition"
          >
            Tenants
          </Link>
          <Link 
            href="/dashboard/maintenance" 
            className="whitespace-nowrap px-4 py-3 rounded-md text-sm font-medium hover:bg-slate-800 transition"
          >
            Maintenance
          </Link>
          <Link 
            href="/dashboard/deposits" 
            className="whitespace-nowrap px-4 py-3 rounded-md text-sm font-medium text-emerald-400 hover:bg-slate-800 transition"
          >
            Deposit Ledger
          </Link>
          {/* NEW: Team Management Link */}
          <Link 
            href="/dashboard/team" 
            className="whitespace-nowrap px-4 py-3 rounded-md text-sm font-medium text-blue-400 hover:bg-slate-800 transition"
          >
            Team Management
          </Link>
        </nav>

        {/* Logout Button (Hidden on very small mobile screens for layout simplicity, visible on tablet+) */}
        <div className="hidden md:block p-4 border-t border-slate-800">
          <form action="/auth/signout" method="post">
            <button className="w-full text-left px-4 py-2 text-sm text-slate-400 hover:text-white transition">
              Sign Out &rarr;
            </button>
          </form>
        </div>
      </aside>

      {/* 
        MAIN CONTENT AREA 
        The 'children' prop automatically injects whatever page you are currently viewing.
      */}
      <main className="flex-1 w-full max-w-7xl mx-auto overflow-y-auto">
        {children}
      </main>

    </div>
  )
}