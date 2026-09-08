'use client'

import { useState } from 'react'
import AddContractorDrawer from './AddContractorDrawer'

export default function AddContractorButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className || 'text-xs text-slate-600 hover:text-slate-900 font-semibold cursor-pointer'}
      >
        + Add
      </button>
      <AddContractorDrawer isOpen={open} onClose={() => setOpen(false)} />
    </>
  )
}

