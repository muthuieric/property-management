'use client'

import { useState } from 'react'
import SyncKaribuDrawer from './SyncKaribuDrawer'

interface SyncKaribuTriggerProps {
  propertiesCount: number
  tenantsCount: number
}

export default function SyncKaribuTrigger({
  propertiesCount,
  tenantsCount,
}: SyncKaribuTriggerProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-300 cursor-pointer transition-all duration-200 ease-in-out shadow-2xs flex items-center gap-2 bg-white"
        title="Synchronize Tenant Directory with Karibu VMS"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
        <span>Sync Karibu VMS</span>
      </button>

      <SyncKaribuDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        propertiesCount={propertiesCount}
        tenantsCount={tenantsCount}
      />
    </>
  )
}

