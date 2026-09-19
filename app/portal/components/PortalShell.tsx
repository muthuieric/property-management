'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import PortalSidebarNav from './PortalSidebarNav'
import { signOut } from '@/app/auth/actions'

interface PortalShellProps {
  children: React.ReactNode
  userEmail: string
  userName?: string
}

export default function PortalShell({
  children,
  userEmail,
  userName,
}: PortalShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [mobileMenuOpen])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* 
        =======================================================================
        1. FIXED DESKTOP SIDEBAR (DEEP SLATE BLUE bg-slate-900)
        =======================================================================
      */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 fixed inset-y-0 left-0 z-40 select-none">
        {/* Geometric Typographic Logo Header */}
        <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <Link href="/portal" className="flex items-center gap-3 group">
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
                Tenant Portal
              </span>
            </div>
          </Link>
        </div>

        {/* Primary Navigation Links */}
        <div className="flex-1 overflow-y-auto py-2">
          <PortalSidebarNav />
        </div>

        {/* Bottom User Identity & Sign Out */}
        <div className="p-4 border-t border-slate-800 shrink-0 bg-slate-900/60">
          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 mb-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                Protected Escrow
              </span>
            </div>
            <p className="text-xs font-semibold text-white truncate">
              {userName || 'Resident'}
            </p>
            <p className="text-[11px] text-slate-400 truncate">
              {userEmail}
            </p>
          </div>

          <form action={signOut}>
            <button
              type="submit"
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/80 cursor-pointer transition-all duration-200 ease-in-out"
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Sign Out</span>
              </div>
              <span className="text-[10px] text-slate-500">&rarr;</span>
            </button>
          </form>
        </div>
      </aside>

      {/* 
        =======================================================================
        2. MOBILE TOP NAVIGATION BAR (md:hidden)
        =======================================================================
      */}
      <header className="md:hidden bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <Link href="/portal" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white">
            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" />
            </svg>
          </div>
          <span className="text-sm font-bold text-white font-sans tracking-tight">
            LUFFI <span className="text-emerald-400">PORTAL</span>
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-all duration-200"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </header>

      {/* Mobile Drawer Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col">
          <div className="bg-slate-900 w-full max-w-xs h-full flex flex-col border-r border-slate-800 p-4 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <span className="text-sm font-bold text-white">LUFFI TECH</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 py-4">
              <PortalSidebarNav onLinkClick={() => setMobileMenuOpen(false)} />
            </div>

            <div className="pt-4 border-t border-slate-800">
              <form action={signOut}>
                <button
                  type="submit"
                  className="w-full px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl cursor-pointer transition"
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
        3. MAIN CONTENT AREA (bg-slate-50)
        =======================================================================
      */}
      <main className="flex-1 md:pl-64 bg-slate-50 min-h-screen">
        {children}
      </main>
    </div>
  )
}
