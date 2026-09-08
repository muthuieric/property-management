// app/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

export default function HomePage() {
  const router = useRouter()
  const [isProcessingToken, setIsProcessingToken] = useState(false)
  const [activeTab, setActiveTab] = useState<'tenant' | 'coordinator'>('tenant')
  const [demoModalOpen, setDemoModalOpen] = useState(false)

  useEffect(() => {
    // 1. Preserve Auth Routing: Check if URL contains invite or recovery tokens
    if (
      typeof window !== 'undefined' &&
      (window.location.hash.includes('access_token') ||
        window.location.hash.includes('type=invite') ||
        window.location.hash.includes('type=recovery'))
    ) {
      setIsProcessingToken(true)

      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const routeUser = async () => {
        if (
          window.location.hash.includes('type=invite') ||
          window.location.hash.includes('type=recovery')
        ) {
          router.push('/update-password')
          return
        }

        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

          if (profile?.role === 'tenant') {
            router.push('/portal')
            return
          }
        }

        router.push('/dashboard')
      }

      // Check session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          routeUser()
        }
      })

      // Listen for auth state change
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
          routeUser()
        }
      })

      return () => subscription.unsubscribe()
    }
  }, [router])

  // If token is being processed in background, show verification screen
  if (isProcessingToken) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="flex flex-col items-center animate-pulse">
          <div className="h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-slate-300 font-medium tracking-wide text-sm">
            Verifying institutional credentials & security tokens...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950">
      
      {/* 1. TOP INSTITUTIONAL HEADER & NAVIGATION */}
      <header className="sticky top-0 z-50 bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3.5 group">
            <div className="h-10 w-10 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center shadow-inner group-hover:border-emerald-500/50 transition duration-300">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-white font-sans">
                  LUFFI <span className="text-emerald-400 font-semibold">TECH</span>
                </span>
                <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-emerald-950/90 text-emerald-400 border border-emerald-500/30">
                  Property OS
                </span>
              </div>
              <span className="text-[10px] text-slate-400 tracking-wider uppercase font-medium">
                Enterprise Asset Infrastructure
              </span>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#bento-features" className="hover:text-emerald-400 transition">
              Core Capabilities
            </a>
            <a href="#dual-focus" className="hover:text-emerald-400 transition">
              Dual-Focus Platform
            </a>
            <a href="#security" className="hover:text-emerald-400 transition">
              Institutional Trust
            </a>
            <a href="#social-proof" className="hover:text-emerald-400 transition">
              Portfolio Roster
            </a>
          </nav>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/login"
              className="text-sm font-semibold text-slate-300 hover:text-white px-3 py-2 transition"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold px-5 py-2.5 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all duration-200"
            >
              <span>Start Free Trial</span>
              <span className="ml-1.5 font-sans">&rarr;</span>
            </Link>
          </div>
        </div>
      </header>

      {/* 2. PREMIUM HERO SECTION */}
      <section className="relative pt-16 pb-24 md:pt-28 md:pb-36 overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        
        {/* Subtle Ambient Glassmorphic Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[380px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[450px] h-[300px] bg-blue-600/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          
          {/* Trust Pill */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-slate-900/90 text-slate-200 border border-slate-700/80 mb-8 shadow-sm backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300">The Institutional Property OS for Agency Owners</span>
          </div>

          {/* Bold Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-5xl mx-auto leading-[1.1]">
            End the Deposit Disputes.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-200">
              Automate the Operations.
            </span>
          </h1>

          {/* Subheadline targeting Agency Owners */}
          <p className="mt-6 text-base sm:text-lg md:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed font-normal">
            Built specifically for high-end residential portfolios in Nairobi. Guarantee dispute-free tenant exits with verifiable escrow ledgers, enforce strict 48-hour contractor maintenance SLAs, and delegate site portfolios with atomic precision.
          </p>

          {/* Two CTAs */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-base px-8 py-4 shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all duration-200 hover:-translate-y-0.5"
            >
              <span>Start Free Trial</span>
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>

            <button
              type="button"
              onClick={() => setDemoModalOpen(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white font-semibold text-base px-8 py-4 border border-slate-700/90 backdrop-blur-md transition-all duration-200 hover:border-slate-600"
            >
              <svg className="w-5 h-5 mr-2 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>View Interactive Demo</span>
            </button>
          </div>

          {/* HIGH-FIDELITY GLASSMORPHISM HERO HUD SHOWCASE */}
          <div className="mt-16 sm:mt-20 relative max-w-5xl mx-auto">
            
            {/* Glass Container */}
            <div className="rounded-3xl p-4 sm:p-6 md:p-8 bg-slate-900/80 backdrop-blur-2xl border border-slate-700/70 shadow-2xl shadow-black/80 text-left relative overflow-hidden">
              
              {/* Header Bar */}
              <div className="flex items-center justify-between pb-5 border-b border-slate-800 text-xs text-slate-400 mb-6">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-rose-500/80" />
                  <span className="h-3 w-3 rounded-full bg-amber-500/80" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 font-mono text-slate-400">luffi-executive-operating-system.corp</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/30 text-emerald-400 font-semibold text-[11px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Live Agency Ledger
                  </span>
                </div>
              </div>

              {/* Three Institutional Macro Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                
                {/* 1. Protected Escrow Status */}
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-inner">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Total Deposits in Trust
                    </span>
                    <span className="text-emerald-400 text-xs font-semibold bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      100% Escrow
                    </span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums tracking-tight">
                    KES 24,850,000
                  </p>
                  <span className="text-[11px] text-emerald-400 mt-1 block font-medium">
                    ✓ Verified zero arbitrary deduction balance
                  </span>
                </div>

                {/* 2. 48-Hour SLA Compliance */}
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-inner">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Maintenance SLA Velocity
                    </span>
                    <span className="text-amber-400 text-xs font-semibold bg-amber-950/80 px-2 py-0.5 rounded-md border border-amber-500/20">
                      48h Cap
                    </span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums tracking-tight">
                    99.4%
                  </p>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Avg contractor turnaround: <strong className="text-slate-200">18.2 hours</strong>
                  </span>
                </div>

                {/* 3. Portfolio Health */}
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-inner">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Portfolio Occupancy
                    </span>
                    <span className="text-blue-400 text-xs font-semibold bg-blue-950/80 px-2 py-0.5 rounded-md border border-blue-500/20">
                      Active Sites
                    </span>
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums tracking-tight">
                    97.8%
                  </p>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Zero orphaned properties &bull; Delegated
                  </span>
                </div>

              </div>

              {/* Sample Operational Activity Feed Row */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-bold text-white block">Exit Clearance Statement Certified &bull; Unit 4B, Riverside Prime</span>
                    <span className="text-slate-400 text-[11px]">KES 120,000 Deposit refunded electronically upon key handover inspection.</span>
                  </div>
                </div>
                <span className="font-mono text-[11px] text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-md border border-emerald-500/30">
                  REF: #CLR-99420-PAID
                </span>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* 3. TRUST & SOCIAL PROOF BAR */}
      <section id="social-proof" className="py-12 border-y border-slate-800/80 bg-slate-950 text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-slate-500 mb-8">
            Trusted by High-End Portfolios in Nairobi
          </p>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 items-center justify-items-center text-center">
            <div className="p-4 rounded-xl border border-slate-800/60 bg-slate-900/40 w-full max-w-[200px]">
              <span className="font-bold text-slate-200 text-sm tracking-tight block">WESTLANDS PRIME</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Commercial & Residential</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-800/60 bg-slate-900/40 w-full max-w-[200px]">
              <span className="font-bold text-slate-200 text-sm tracking-tight block">KAREN RIDGE TRUST</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Luxury Villa Portfolios</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-800/60 bg-slate-900/40 w-full max-w-[200px]">
              <span className="font-bold text-slate-200 text-sm tracking-tight block">KILIMANI URBAN OS</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Multi-Unit Apartments</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-800/60 bg-slate-900/40 w-full max-w-[200px]">
              <span className="font-bold text-slate-200 text-sm tracking-tight block">RIVERSIDE TOWERS</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Executive Residences</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-800/60 bg-slate-900/40 w-full max-w-[200px] col-span-2 md:col-span-1">
              <span className="font-bold text-slate-200 text-sm tracking-tight block">LAVINGTON CAPITAL</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Asset Management</span>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-900 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <span className="text-2xl sm:text-3xl font-black text-white tabular-nums">KES 2.8B+</span>
              <span className="text-xs text-slate-500 block mt-0.5">Deposits Secured in Escrow</span>
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-black text-emerald-400 tabular-nums">48 Hours</span>
              <span className="text-xs text-slate-500 block mt-0.5">Strict Repair SLA Guarantee</span>
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-black text-white tabular-nums">100%</span>
              <span className="text-xs text-slate-500 block mt-0.5">Transparent Exit Audits</span>
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-black text-emerald-400 tabular-nums">0</span>
              <span className="text-xs text-slate-500 block mt-0.5">Arbitrary Deposit Deductions</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. THE 'BENTO BOX' FEATURE GRID */}
      <section id="bento-features" className="py-24 bg-slate-900 text-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/30 inline-block mb-3">
              Institutional Architecture
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">
              Engineered to Eliminate Property Failure Points.
            </h2>
            <p className="mt-4 text-slate-400 text-base md:text-lg">
              Standard property software is built for basic spreadsheets. Luffi Tech is engineered around institutional security boundaries, financial audit trails, and strict operational SLAs.
            </p>
          </div>

          {/* BENTO GRID (12-Column Responsive Layout) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* BENTO CARD 1: 100% Transparent Exit Clearances (8 Columns) */}
            <div className="md:col-span-12 lg:col-span-8 bg-slate-950/90 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-xl relative overflow-hidden group hover:border-emerald-500/40 transition duration-300">
              <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="p-2 rounded-xl bg-emerald-950 border border-emerald-500/30 text-emerald-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </span>
                  <span className="text-xs uppercase font-bold tracking-wider text-emerald-400">
                    Core Differentiator 01
                  </span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  100% Transparent Exit Clearances
                </h3>
                <p className="text-slate-400 text-sm sm:text-base mt-2 max-w-xl leading-relaxed">
                  End the bitter end-of-lease security deposit conflicts. Every tenant deduction requires a verified contractor work order reference number and photographic inspection proof before deductions can be posted.
                </p>
              </div>

              {/* Visual Interactive Mockup of Exit Statement */}
              <div className="mt-8 bg-slate-900/90 rounded-2xl border border-slate-800 p-5 font-sans text-xs">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">Itemized Exit Statement</span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">Verified Electronic Clearance</span>
                  </div>
                  <span className="text-slate-400">Unit 12A &bull; Westlands</span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-300">Initial Escrow Security Deposit Paid</span>
                    <span className="font-bold text-emerald-400 tabular-nums">+ KES 140,000.00</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <span>Paint touchup (Work Order #WO-8924)</span>
                    </span>
                    <span className="font-semibold text-rose-400 tabular-nums">- KES 4,500.00</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-t border-slate-800 font-bold">
                    <span className="text-white">Net Electronic Refund Payable:</span>
                    <span className="text-emerald-400 text-sm tabular-nums">KES 135,500.00</span>
                  </div>
                </div>
              </div>
            </div>

            {/* BENTO CARD 2: 48-Hour Maintenance SLA Tracking (4 Columns) */}
            <div className="md:col-span-12 lg:col-span-4 bg-slate-950/90 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-xl relative overflow-hidden group hover:border-amber-500/40 transition duration-300">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="p-2 rounded-xl bg-amber-950 border border-amber-500/30 text-amber-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                  <span className="text-xs uppercase font-bold tracking-wider text-amber-400">
                    Core Differentiator 02
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-white tracking-tight">
                  48-Hour Maintenance SLA Tracking
                </h3>
                <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                  Never lose track of an emergency plumbing, electrical, or structural repair. Coordinators operate under live countdown timers.
                </p>
              </div>

              {/* Visual SLA Countdown Pill Mock */}
              <div className="mt-6 p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">Emergency Plumbing Leak</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-500/30 animate-pulse">
                    ⏱️ 14h Remaining
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div className="bg-amber-400 h-2 rounded-full w-3/4" />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Dispatched to Certified Plumber</span>
                  <span>Escalates to Owner if Unresolved</span>
                </div>
              </div>
            </div>

            {/* BENTO CARD 3: Atomic Portfolio Delegation (4 Columns) */}
            <div className="md:col-span-12 lg:col-span-4 bg-slate-950/90 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-xl relative overflow-hidden group hover:border-blue-500/40 transition duration-300">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="p-2 rounded-xl bg-blue-950 border border-blue-500/30 text-blue-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </span>
                  <span className="text-xs uppercase font-bold tracking-wider text-blue-400">
                    Core Differentiator 03
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-white tracking-tight">
                  Atomic Portfolio Delegation
                </h3>
                <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                  Assign entire site portfolios to designated Property Coordinators in single transactional operations with complete audit history in PostgreSQL.
                </p>
              </div>

              <div className="mt-6 p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-slate-300">Delegation Boundary</span>
                  <span className="text-emerald-400 font-bold text-[10px]">Zero Orphan Risk</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Detects unassigned buildings instantly and blocks coordinator removal if open tickets remain unmonitored.
                </p>
              </div>
            </div>

            {/* BENTO CARD 4: Dynamic Lease Renewal & Legal Agreement Generator (4 Columns) */}
            <div className="md:col-span-12 lg:col-span-4 bg-slate-950/90 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-xl relative overflow-hidden group hover:border-emerald-500/40 transition duration-300">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="p-2 rounded-xl bg-emerald-950 border border-emerald-500/30 text-emerald-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </span>
                  <span className="text-xs uppercase font-bold tracking-wider text-emerald-400">
                    Automated Document Pipeline
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-white tracking-tight">
                  Dynamic Renewal Letters
                </h3>
                <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                  Monitor 60-day lease expiration horizons. Generate legally compliant residential renewal addendums with 1-click extension presets ready for print or export.
                </p>
              </div>

              <div className="mt-6 p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Print-Ready Legal PDF</span>
                <span className="text-emerald-400 font-bold text-[10px]">1-Click Extension</span>
              </div>
            </div>

            {/* BENTO CARD 5: Multi-Tenant Row-Level Security Isolation (4 Columns) */}
            <div className="md:col-span-12 lg:col-span-4 bg-slate-950/90 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-xl relative overflow-hidden group hover:border-purple-500/40 transition duration-300">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="p-2 rounded-xl bg-purple-950 border border-purple-500/30 text-purple-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </span>
                  <span className="text-xs uppercase font-bold tracking-wider text-purple-400">
                    Defense-in-Depth
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-white tracking-tight">
                  Cryptographic RLS Isolation
                </h3>
                <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                  PostgreSQL Row-Level Security policies strictly enforce agency boundaries. Coordinators can never inspect unassigned sites or cross-agency tenant ledgers.
                </p>
              </div>

              <div className="mt-6 p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Strict Auth Isolation</span>
                <span className="text-purple-400 font-mono text-[10px]">auth.uid() Enforced</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 5. TENANT & MANAGER DUAL-FOCUS INTERACTIVE SECTION */}
      <section id="dual-focus" className="py-24 bg-slate-950 text-white border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-slate-900 text-emerald-400 border border-slate-800 inline-block mb-3">
              Tailored Personas
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">
              Two Tailored Experiences. One Unified Platform.
            </h2>
            <p className="mt-4 text-slate-400 text-base md:text-lg">
              Tenant trust is earned through verifiable transparency. Coordinator velocity is driven by actionable task prioritization.
            </p>

            {/* Persona Switcher Buttons for Mobile/Tablet */}
            <div className="mt-8 inline-flex p-1 rounded-2xl bg-slate-900 border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('tenant')}
                className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
                  activeTab === 'tenant'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                The Tenant Experience
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('coordinator')}
                className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition ${
                  activeTab === 'coordinator'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                The Coordinator Action Center
              </button>
            </div>
          </div>

          {/* Side-by-Side Dual Focus Display */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
            
            {/* LEFT: The Tenant Experience */}
            <div className={`rounded-3xl p-6 sm:p-8 border transition duration-300 flex flex-col justify-between ${
              activeTab === 'tenant'
                ? 'bg-slate-900 border-emerald-500/50 shadow-2xl shadow-emerald-500/5 ring-1 ring-emerald-500/30'
                : 'bg-slate-900/50 border-slate-800 opacity-75 hover:opacity-100'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs uppercase font-bold tracking-wider text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-500/30">
                    Tenant Portal &bull; Complete Peace of Mind
                  </span>
                  <span className="text-xs text-slate-500 font-mono">/portal</span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  High-Trust Tenant Financial Ledger
                </h3>
                <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                  Eliminates anxiety for high-end tenants. They see their protected deposit balance, live utility items (KPLC / Water), and can track repair requests in real time.
                </p>

                {/* Micro UI Mock: Tenant View */}
                <div className="mt-6 p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                      Security Deposit Status
                    </span>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black text-white tabular-nums">KES 150,000.00</span>
                      <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/20">
                        Protected in Escrow
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">
                      Fully refundable upon checkout clearance statement.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                      Current Unpaid Balance
                    </span>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black text-emerald-400 tabular-nums">KES 0.00</span>
                      <span className="text-[11px] font-bold text-slate-400">Account Settled</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      No pending rent, water meter charges, or electricity fees.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Direct Maintenance Submissions</span>
                <span className="text-emerald-400 font-semibold">Zero Phone Call Tag</span>
              </div>
            </div>

            {/* RIGHT: The Coordinator Action Center */}
            <div className={`rounded-3xl p-6 sm:p-8 border transition duration-300 flex flex-col justify-between ${
              activeTab === 'coordinator'
                ? 'bg-slate-900 border-emerald-500/50 shadow-2xl shadow-emerald-500/5 ring-1 ring-emerald-500/30'
                : 'bg-slate-900/50 border-slate-800 opacity-75 hover:opacity-100'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs uppercase font-bold tracking-wider text-blue-400 bg-blue-950/80 px-3 py-1 rounded-full border border-blue-500/30">
                    Coordinator HUD &bull; Daily Operational Velocity
                  </span>
                  <span className="text-xs text-slate-500 font-mono">/dashboard</span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Tactical Daily Action Center
                </h3>
                <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                  Coordinators don&apos;t waste time on macro-charts. They are presented with actionable 3-column priorities: Overdue Rent & Bills, Open Repairs, and Vacant Units.
                </p>

                {/* Micro UI Mock: Coordinator Action Center */}
                <div className="mt-6 p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl">
                      <span className="text-amber-400 text-lg font-black block">3</span>
                      <span className="text-[10px] text-amber-200">Overdue Rent</span>
                    </div>
                    <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl">
                      <span className="text-rose-400 text-lg font-black block">2</span>
                      <span className="text-[10px] text-rose-200">SLA Repairs</span>
                    </div>
                    <div className="p-3 bg-blue-950/40 border border-blue-500/30 rounded-xl">
                      <span className="text-blue-400 text-lg font-black block">1</span>
                      <span className="text-[10px] text-blue-200">Vacant Unit</span>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 text-xs">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-white">Water Meter Reading Due</span>
                      <span className="text-[10px] text-amber-400 font-semibold bg-amber-950 px-2 py-0.5 rounded border border-amber-500/20">Unit 10B</span>
                    </div>
                    <span className="text-[11px] text-slate-400">Coordinator batch bill upload ready for posting to tenant ledger.</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Strict 48-Hour SLA Accountability</span>
                <span className="text-blue-400 font-semibold">Automatic Escalation</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 6. INSTITUTIONAL SECURITY & COMPLIANCE ARCHITECTURE */}
      <section id="security" className="py-24 bg-slate-900 text-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-7">
              <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-slate-950 text-emerald-400 border border-slate-800 inline-block mb-3">
                Security & Tenancy Governance
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">
                Institutional Defense Built at the Database Layer.
              </h2>
              <p className="mt-4 text-slate-300 text-base md:text-lg leading-relaxed">
                We believe security cannot rely on frontend code. Every query, insert, and delegation is validated through PostgreSQL Row-Level Security, ensuring full tenancy isolation and preventing cross-agency exposure.
              </p>

              <div className="mt-8 space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-emerald-950 border border-emerald-500/30 text-emerald-400 shrink-0 mt-0.5">
                    ✓
                  </div>
                  <div>
                    <strong className="text-white font-semibold">Row-Level Security (RLS) Multi-Tenancy:</strong>
                    <span className="text-slate-400 block text-xs mt-0.5">
                      Coordinators only query sites where `manager_id = auth.uid()`. Agency owners retain global oversight.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-emerald-950 border border-emerald-500/30 text-emerald-400 shrink-0 mt-0.5">
                    ✓
                  </div>
                  <div>
                    <strong className="text-white font-semibold">Immutable Assignment Audit Logs (`assignment_logs`):</strong>
                    <span className="text-slate-400 block text-xs mt-0.5">
                      Every site delegation change is permanently logged with timestamps, delegating owner ID, and coordinator references.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-emerald-950 border border-emerald-500/30 text-emerald-400 shrink-0 mt-0.5">
                    ✓
                  </div>
                  <div>
                    <strong className="text-white font-semibold">Instant Account Suspension Guardrails:</strong>
                    <span className="text-slate-400 block text-xs mt-0.5">
                      One-click suspension revokes access immediately upon login, while disabling portfolio assignment and lease execution.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 bg-slate-950 p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl font-mono text-xs text-slate-300">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-[11px] text-slate-500 mb-4">
                <span>security_policy.sql</span>
                <span className="text-emerald-400 font-sans font-bold">PostgreSQL 16 &bull; RLS Active</span>
              </div>
              <pre className="overflow-x-auto text-[11px] leading-relaxed text-slate-300">
{`-- Double-Sided Tenancy Validation
CREATE POLICY "Coordinators access assigned sites"
ON public.properties FOR SELECT TO authenticated
USING (
  agency_id = public.get_auth_agency_id() 
  AND (manager_id = auth.uid() 
       OR public.get_auth_role() = 'agency_owner')
);

-- Escrow Ledger Immutability
ALTER TABLE public.leases 
ENABLE ROW LEVEL SECURITY;`}
              </pre>

              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] font-sans">
                <span className="text-slate-500">Security Standard</span>
                <span className="text-emerald-400 font-bold">Bank-Grade Data Isolation</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 7. CONVERTING CTA SECTION */}
      <section className="py-20 md:py-28 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/30 inline-block mb-4">
            Institutional Upgrade
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Ready to Institutionalize Your Property Operations?
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Eliminate deposit disputes, protect your agency reputation, and empower your property coordinators with a surgical daily action center.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-base px-9 py-4 shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/30 transition duration-200"
            >
              <span>Start Free Agency Trial</span>
              <span className="ml-2 font-sans">&rarr;</span>
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-base px-8 py-4 border border-slate-700 transition"
            >
              <span>Agency Login</span>
            </Link>
          </div>

          <p className="mt-6 text-xs text-slate-500">
            No credit card required for trial &bull; Instant onboarding &bull; Dedicated Nairobi onboarding support
          </p>
        </div>
      </section>

      {/* 8. CLEAN INSTITUTIONAL FOOTER */}
      <footer className="py-16 bg-slate-950 border-t border-slate-800/80 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-10 pb-12 border-b border-slate-800/60">
            
            {/* Column 1: Brand Info */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-white">LUFFI <span className="text-emerald-400">TECH</span></span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-slate-900 text-emerald-400 border border-slate-800">
                  Enterprise
                </span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
                Luffi Tech Property Operating System is engineered for institutional residential portfolios and premier asset managers in Nairobi, Kenya.
              </p>
              <div className="text-[11px] text-slate-500">
                Nairobi, Kenya &bull; <a href="mailto:contact@luffitech.com" className="hover:text-emerald-400 underline">contact@luffitech.com</a>
              </div>
            </div>

            {/* Column 2: Platform */}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Platform</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#bento-features" className="hover:text-emerald-400 transition">Exit Clearances</a></li>
                <li><a href="#bento-features" className="hover:text-emerald-400 transition">48h SLA Tracking</a></li>
                <li><a href="#bento-features" className="hover:text-emerald-400 transition">Portfolio Delegation</a></li>
                <li><a href="#bento-features" className="hover:text-emerald-400 transition">Lease Renewal Suite</a></li>
              </ul>
            </div>

            {/* Column 3: Personas */}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Solutions</h4>
              <ul className="space-y-2 text-slate-400">
                <li><Link href="/login" className="hover:text-emerald-400 transition">Agency Owner Overview</Link></li>
                <li><Link href="/login" className="hover:text-emerald-400 transition">Coordinator HUD</Link></li>
                <li><Link href="/login" className="hover:text-emerald-400 transition">Tenant Escrow Portal</Link></li>
                <li><Link href="/signup" className="hover:text-emerald-400 transition">Self-Serve Onboarding</Link></li>
              </ul>
            </div>

            {/* Column 4: Compliance & Legal */}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Governance</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#security" className="hover:text-emerald-400 transition">RLS Security Boundary</a></li>
                <li><a href="#security" className="hover:text-emerald-400 transition">Audit Logs (`assignment_logs`)</a></li>
                <li><span className="text-slate-500">Kenyan Tenancy Compliance</span></li>
                <li><span className="text-slate-500">Escrow Rollover Guarantee</span></li>
              </ul>
            </div>

          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
            <p>&copy; {new Date().getFullYear()} Luffi Tech Ltd. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <span className="hover:text-slate-400 transition cursor-pointer">Terms of Service</span>
              <span className="hover:text-slate-400 transition cursor-pointer">Privacy & Tenancy Data</span>
              <span className="hover:text-slate-400 transition cursor-pointer">Security Whitepaper</span>
            </div>
          </div>
        </div>
      </footer>

      {/* 9. INTERACTIVE DEMO WALKTHROUGH MODAL */}
      {demoModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative bg-slate-900 w-full max-w-3xl rounded-3xl border border-slate-700 shadow-2xl p-6 sm:p-8 text-white">
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/30">
                  Interactive Platform Tour
                </span>
                <h3 className="text-2xl font-bold text-white mt-1">
                  Luffi Tech Enterprise Walkthrough
                </h3>
              </div>
              <button
                onClick={() => setDemoModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 text-sm text-slate-300">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <h4 className="font-bold text-white text-base mb-1">1. Agency Owner Executive Overview</h4>
                <p className="text-xs text-slate-400">
                  Access macro metrics: Month-To-Date collections, Total Arrears across sites, and locked Deposits in Trust computed directly inside PostgreSQL RPC functions.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <h4 className="font-bold text-white text-base mb-1">2. Property Coordinator Action Center</h4>
                <p className="text-xs text-slate-400">
                  Coordinators take ownership of assigned sites with 48h SLA countdown badges, overdue bill follow-ups, and a 60-day lease expiration pipeline.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                <h4 className="font-bold text-white text-base mb-1">3. Dispute-Free Tenant Escrow Portal</h4>
                <p className="text-xs text-slate-400">
                  Tenants view protected security deposit escrow, submit maintenance tickets with live dispatch tracking, and receive certified exit statements.
                </p>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500">Ready to test the live environment?</span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDemoModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Close Tour
                </button>
                <Link
                  href="/signup"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition"
                >
                  Start Free Trial Now
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}