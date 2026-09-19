'use client'

import { useState, useTransition } from 'react'
import { syncSingleTenantAction } from '../actions'

interface TenantVmsSyncButtonProps {
  tenantId: string
  tenantName: string
}

export default function TenantVmsSyncButton({
  tenantId,
  tenantName,
}: TenantVmsSyncButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const handleSync = (e: React.MouseEvent) => {
    e.stopPropagation()
    startTransition(async () => {
      try {
        const res = await syncSingleTenantAction(tenantId)
        if (res.success) {
          setStatus('success')
          setTimeout(() => setStatus('idle'), 3000)
        } else {
          setStatus('error')
          setTimeout(() => setStatus('idle'), 3500)
        }
      } catch {
        setStatus('error')
        setTimeout(() => setStatus('idle'), 3500)
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={isPending}
      title={
        status === 'success'
          ? `Synced ${tenantName} to Karibu VMS`
          : status === 'error'
          ? 'Failed to sync to Karibu VMS'
          : `Sync ${tenantName} to Karibu VMS`
      }
      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200 ease-in-out inline-flex items-center gap-1.5 ${
        status === 'success'
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : status === 'error'
          ? 'bg-rose-50 text-rose-700 border border-rose-200'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
      }`}
    >
      {isPending ? (
        <svg className="animate-spin h-3 w-3 text-slate-600" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : status === 'success' ? (
        <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      )}
      <span>
        {isPending
          ? 'Syncing...'
          : status === 'success'
          ? 'Synced'
          : status === 'error'
          ? 'Failed'
          : 'Sync VMS'}
      </span>
    </button>
  )
}

