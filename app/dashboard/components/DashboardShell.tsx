'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import DashboardSidebarNav from './DashboardSidebarNav'
import DashboardTopHeader from './DashboardTopHeader'

interface DashboardShellProps {
  children: React.ReactNode
  userEmail: string
  userRole?: string
  userName?: string
}

export default function DashboardShell({
  children,
  userEmail,
  userRole = 'agency_owner',
  userName,
}: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Prevent background scroll when mobile nav is open
  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [mobileNavOpen])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* 
        =======================================================================
        1. FIXED DESKTOP SIDEBAR (DEEP SLATE BLUE bg-slate-900)
        =======================================================================
      */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800/80 fixed inset-y-0 left-0 z-40 select-none">
        {/* Luffi Tech Geometric Typographic Branding */}
        <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            {/* Clean Geometric Logo Mark */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-950/40 border border-emerald-400/20 group-hover:scale-105 transition-transform duration-150">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-white leading-tight font-sans">
                LUFFI TECH
              </span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400">
                Property Suite
              </span>
            </div>
          </Link>
        </div>

        {/* Sidebar Nav Links */}
        <div className="flex-1 overflow-y-auto py-2">
          <DashboardSidebarNav userRole={userRole} />
        </div>

        {/* Institutional Trust Badge & Quick Sign Out */}
        <div className="p-4 border-t border-slate-800 shrink-0 bg-slate-900/50">
          <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/50 mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[11px] font-semibold text-slate-200">
                Institutional Security
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 leading-snug">
              Deposit escrow trust accounts verified & compliant.
            </p>
          </div>

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-all duration-200 ease-in-out"
            >
              <span>Sign Out</span>
              <span>&rarr;</span>
            </button>
          </form>
        </div>
      </aside>

      {/* 
        =======================================================================
        2. MOBILE SLIDE-OVER DRAWER (FOR PHONES / TABLETS < md)
        =======================================================================
      */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setMobileNavOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative flex flex-col w-72 max-w-[80vw] bg-slate-900 text-white shadow-2xl z-10">
            {/* Header */}
            <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-sm text-white font-bold text-xs">
                  LT
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold tracking-tight text-white leading-tight">
                    LUFFI TECH
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400">
                    Property Suite
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer transition-all duration-200 ease-in-out"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Nav list */}
            <div className="flex-1 overflow-y-auto py-2">
              <DashboardSidebarNav
                onNavigate={() => setMobileNavOpen(false)}
                userRole={userRole}
              />
            </div>

            {/* Sign Out */}
            <div className="p-4 border-t border-slate-800">
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="w-full text-left px-3 py-2 text-xs font-medium text-rose-400 hover:bg-slate-800 rounded-lg cursor-pointer transition-all duration-200 ease-in-out"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 
        =======================================================================
        3. MAIN DESKTOP / CONTENT WRAPPER
        =======================================================================
      */}
      <div className="md:pl-64 flex flex-col flex-1 min-h-screen bg-slate-50">
        {/* Top Header */}
        <DashboardTopHeader
          userEmail={userEmail}
          userRole={userRole}
          userName={userName}
          onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)}
        />

        {/* Main Content Area */}
        <main className="flex-1 w-full bg-slate-50">
          {children}
        </main>
      </div>
    </div>
  )
}
