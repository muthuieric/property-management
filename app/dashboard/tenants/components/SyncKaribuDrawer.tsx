'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import SlideOverDrawer from '@/app/dashboard/components/SlideOverDrawer'
import { syncAllTenantsToKaribuAction, testKaribuConnectionAction } from '../actions'

interface SyncKaribuDrawerProps {
  isOpen: boolean
  onClose: () => void
  propertiesCount: number
  tenantsCount: number
}

export default function SyncKaribuDrawer({
  isOpen,
  onClose,
  propertiesCount,
  tenantsCount,
}: SyncKaribuDrawerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [syncResult, setSyncResult] = useState<{
    success: boolean
    message: string
    groupsCount?: number
    usersCount?: number
    error?: string
  } | null>(null)

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)
    try {
      const res = await testKaribuConnectionAction()
      setTestResult(res)
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: err?.message || 'Connection test failed.',
      })
    } finally {
      setIsTesting(false)
    }
  }

  const handleRunFullSync = () => {
    setSyncResult(null)
    startTransition(async () => {
      try {
        const res = await syncAllTenantsToKaribuAction()
        setSyncResult(res)
        if (res.success) {
          router.refresh()
        }
      } catch (err: any) {
        setSyncResult({
          success: false,
          message: err?.message || 'Synchronization encountered an unexpected error.',
          error: err?.message,
        })
      }
    })
  }

  return (
    <SlideOverDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Karibu VMS Directory Sync"
      subtitle="Synchronize properties, units, and active tenants with Karibu Visitor Management System for automated gate check-in & host notifications."
      maxWidth="max-w-xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || isPending}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer transition-all duration-200 ease-in-out border border-slate-200 disabled:opacity-50 flex items-center gap-1.5"
          >
            {isTesting ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-slate-700" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Testing Connection...</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Test Connection</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer transition-all duration-200 ease-in-out"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleRunFullSync}
              disabled={isPending}
              className="bg-slate-900 hover:bg-slate-800 hover:shadow-md text-white font-semibold text-xs py-2.5 px-5 rounded-lg cursor-pointer transition-all duration-200 ease-in-out shadow-xs disabled:opacity-50 flex items-center gap-2"
            >
              {isPending ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Syncing Directory...</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Run Full Directory Sync</span>
                </>
              )}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Test Result Alert */}
        {testResult && (
          <div
            className={`p-3.5 rounded-xl text-xs border flex items-start gap-2.5 ${
              testResult.ok
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
          >
            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${testResult.ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <div className="flex-1">
              <span className="font-bold block mb-0.5">
                {testResult.ok ? 'Connection Verified' : 'Connection Error'}
              </span>
              <p className="leading-relaxed">{testResult.message}</p>
            </div>
          </div>
        )}

        {/* Sync Result Alert */}
        {syncResult && (
          <div
            className={`p-3.5 rounded-xl text-xs border flex items-start gap-2.5 ${
              syncResult.success
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-amber-50 text-amber-900 border-amber-200'
            }`}
          >
            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${syncResult.success ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <div className="flex-1">
              <span className="font-bold block mb-0.5">
                {syncResult.success ? 'Sync Complete' : 'Sync Issue'}
              </span>
              <p className="leading-relaxed">{syncResult.message}</p>
            </div>
          </div>
        )}

        {/* API Credentials & Status Card */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Integration API Active
              </span>
            </div>
            <span className="text-[10px] font-mono bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded-md font-semibold">
              Bearer Token Auth
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div className="bg-white p-2.5 rounded-lg border border-slate-200/60">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                VMS Endpoint
              </span>
              <span className="font-mono text-slate-700 text-[11px] truncate block">
                karibuvms.com
              </span>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200/60">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                Auth Prefix
              </span>
              <span className="font-mono text-slate-700 text-[11px] truncate block">
                kvms_live_••••••••
              </span>
            </div>
          </div>
        </div>

        {/* Directory Scope Overview */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">
            Synchronization Scope
          </h3>
          <div className="grid grid-cols-2 gap-3.5">
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Groups (Buildings)
                </span>
                <p className="text-xl font-bold text-slate-900 tabular-nums">
                  {propertiesCount}
                </p>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Syncs to <code className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">POST /api/v1/sync/groups</code>
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Users (Tenants / Hosts)
                </span>
                <p className="text-xl font-bold text-slate-900 tabular-nums">
                  {tenantsCount}
                </p>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Syncs to <code className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded">POST /api/v1/sync/users</code>
              </p>
            </div>
          </div>
        </div>

        {/* How it works info box */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-2.5">
          <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            How Directory Sync Operates
          </h4>
          <ul className="space-y-1.5 text-slate-600 text-[11px] list-disc list-inside leading-relaxed">
            <li>
              <strong>Automatic Onboarding:</strong> New tenants registered through the dashboard are instantly synchronized with Karibu VMS.
            </li>
            <li>
              <strong>Lease Updates:</strong> When a tenant signs an active lease, their designated Unit and Building are immediately updated in Karibu VMS.
            </li>
            <li>
              <strong>Move-Out Clearance:</strong> When a tenant completes their move-out clearance, their gate host profile is safely deprovisioned.
            </li>
            <li>
              <strong>Idempotent Upsert:</strong> Running a full sync at any time will cleanly update existing records without creating duplicates.
            </li>
          </ul>
        </div>
      </div>
    </SlideOverDrawer>
  )
}

