'use client'

import { useState } from 'react'
import LogTicketDrawer, { ActiveLeaseOption, ContractorOption } from './LogTicketDrawer'
import AddContractorDrawer from './AddContractorDrawer'

interface MaintenanceActionTriggersProps {
  activeLeases: ActiveLeaseOption[]
  contractors: ContractorOption[]
}

export default function MaintenanceActionTriggers({
  activeLeases,
  contractors,
}: MaintenanceActionTriggersProps) {
  const [logTicketOpen, setLogTicketOpen] = useState(false)
  const [addContractorOpen, setAddContractorOpen] = useState(false)

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => setAddContractorOpen(true)}
          className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-all duration-200 ease-in-out text-xs font-semibold shadow-xs"
        >
          + Add Contractor
        </button>
        <button
          type="button"
          onClick={() => setLogTicketOpen(true)}
          className="bg-slate-900 hover:bg-slate-800 hover:shadow-md text-white px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ease-in-out text-xs font-semibold shadow-xs flex items-center gap-1.5"
        >
          <span>+ Log New Ticket</span>
        </button>
      </div>

      <LogTicketDrawer
        isOpen={logTicketOpen}
        onClose={() => setLogTicketOpen(false)}
        activeLeases={activeLeases}
        contractors={contractors}
      />

      <AddContractorDrawer
        isOpen={addContractorOpen}
        onClose={() => setAddContractorOpen(false)}
      />
    </>
  )
}
