// app/portal/layout.tsx
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { signOut } from '@/app/auth/actions'

export default async function TenantPortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // 1. Verify user authentication at the layout level
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    redirect('/login')
  }

  // 2. Fetch tenant profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  const displayName = profile?.first_name
    ? `${profile.first_name} ${profile.last_name || ''}`.trim()
    : user.email

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      
      {/* 
        TENANT SIDEBAR / MOBILE NAV
        - Mobile: Top bar scrolling horizontally
        - Desktop: Fixed vertical sidebar
      */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex flex-col md:min-h-screen shrink-0 shadow-lg z-10">
        <div className="p-4 md:p-6 border-b border-slate-800 flex justify-between items-center md:block">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
              <h2 className="text-xl font-bold tracking-tight">Tenant Portal</h2>
            </div>
            <span className="text-xs text-slate-400 block mt-1 md:mt-2 truncate">
              {displayName}
            </span>
          </div>
        </div>

        <nav className="flex md:flex-col overflow-x-auto md:overflow-x-visible p-2 md:p-4 gap-2 flex-1">
          <Link
            href="/portal"
            className="whitespace-nowrap px-4 py-3 rounded-md text-sm font-medium hover:bg-slate-800 transition flex items-center gap-2 text-slate-200 hover:text-white"
          >
            <svg
              className="w-4 h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            My Lease
          </Link>

          <Link
            href="/portal/maintenance"
            className="whitespace-nowrap px-4 py-3 rounded-md text-sm font-medium hover:bg-slate-800 transition flex items-center gap-2 text-slate-200 hover:text-white"
          >
            <svg
              className="w-4 h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Maintenance
          </Link>

          <Link
            href="/portal/clearance"
            className="whitespace-nowrap px-4 py-3 rounded-md text-sm font-medium hover:bg-slate-800 transition flex items-center gap-2 text-slate-200 hover:text-white"
          >
            <svg
              className="w-4 h-4 text-emerald-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            Exit Clearance
          </Link>
        </nav>

        {/* Sign Out Button */}
        <div className="p-4 border-t border-slate-800">
          <form action={signOut}>
            <button
              type="submit"
              className="w-full text-left px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-md transition flex items-center justify-between"
            >
              <span>Sign Out</span>
              <span>&rarr;</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-6xl mx-auto overflow-y-auto">
        {children}
      </main>

    </div>
  )
}

