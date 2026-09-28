// app/dashboard/settings/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'
import { getAgencySettings } from './actions'
import SettingsClient from './components/SettingsClient'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { agencyId, role } = await getUserAgencyContext()

  // Strict Access Control: Global Settings are reserved for Agency Owner
  if (role !== 'agency_owner') {
    redirect('/dashboard?message=Access restricted: Global Operational Settings are reserved for Agency Owners.')
  }

  // 1. Fetch agency profile name
  let agencyName = 'Agency'
  try {
    const { data: agency } = await supabase
      .from('agencies')
      .select('name')
      .eq('id', agencyId)
      .single()

    if (agency?.name) {
      agencyName = agency.name
    }
  } catch (err) {
    console.warn('Could not fetch agency name for settings:', err)
  }

  // 2. Fetch current global operational settings
  const settings = await getAgencySettings()

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-900 text-white shadow-xs">
              System Administration
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Governance Protocols &bull; {agencyName}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 font-sans">
            Settings & Operational Approvals
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Toggle global expense guardrails, invoice cancellation policies, and automated billing protocols.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard"
            className="border border-slate-200 bg-white text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-all duration-200 ease-in-out font-semibold text-xs shadow-xs"
          >
            &larr; Executive Overview
          </Link>
          <Link
            href="/dashboard/financials"
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ease-in-out font-semibold text-xs shadow-xs flex items-center gap-1.5"
          >
            <span>Financials & Ledgers</span>
            <span>&rarr;</span>
          </Link>
        </div>
      </header>

      {/* Main Settings Panel */}
      <SettingsClient initialSettings={settings} agencyName={agencyName} />
    </div>
  )
}

