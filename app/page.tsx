// app/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

export default function HomePage() {
  const router = useRouter()
  const [isProcessingToken, setIsProcessingToken] = useState(false)

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center animate-pulse">
          <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-600 font-medium tracking-wide">
            Verifying your invitation & credentials...
          </p>
        </div>
      </div>
    )
  }

  // Public Modern SaaS Landing Page
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* NAVIGATION BAR */}
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              Estate<span className="text-blue-600">Flow</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-blue-600 transition">
              Features
            </a>
            <a href="#pricing" className="hover:text-blue-600 transition">
              Pricing
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-semibold text-slate-700 hover:text-blue-600 transition px-3 py-2"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="hidden sm:inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
            >
              Get Started &rarr;
            </Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-20 pb-24 md:pt-32 md:pb-36 overflow-hidden bg-gradient-to-b from-slate-50 via-white to-white">
        {/* Subtle background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-blue-400/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 mb-6 shadow-sm">
            <span>✨ The Modern Multi-Tenant Property Platform</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 max-w-4xl mx-auto leading-[1.15]">
            Modern Property Management,{' '}
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Simplified.
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Streamline agency operations, assign property managers with granular permissions, empower residents with self-service portals, and manage financials with audit-ready ledgers.
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md hover:shadow-lg transition-all"
            >
              Get Started Free &rarr;
            </Link>
            <a
              href="#pricing"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-sm hover:shadow transition"
            >
              See Pricing
            </a>
          </div>

          {/* Dashboard Preview Teaser */}
          <div className="mt-16 max-w-5xl mx-auto rounded-xl border border-slate-200/80 bg-white p-2 shadow-2xl shadow-slate-200/50">
            <div className="rounded-lg bg-slate-900 p-6 md:p-8 text-white text-left">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                <div>
                  <span className="text-xs uppercase tracking-wider text-blue-400 font-semibold">
                    Live Agency Overview
                  </span>
                  <h3 className="text-xl font-bold mt-1">Portfolio Snapshot</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800">
                    ● Real-Time Sync
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
                <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700">
                  <span className="text-xs text-slate-400">Total Managed Units</span>
                  <p className="text-2xl font-extrabold text-white mt-1">128 Units</p>
                  <span className="text-xs text-emerald-400 mt-1 block">98.4% Occupancy</span>
                </div>
                <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700">
                  <span className="text-xs text-slate-400">Monthly Rent Inflows</span>
                  <p className="text-2xl font-extrabold text-white mt-1">KES 2.45M</p>
                  <span className="text-xs text-blue-400 mt-1 block">Automatic reconciliation</span>
                </div>
                <div className="bg-slate-800/60 p-4 rounded-lg border border-slate-700">
                  <span className="text-xs text-slate-400">Maintenance Resolution</span>
                  <p className="text-2xl font-extrabold text-white mt-1">94.2%</p>
                  <span className="text-xs text-emerald-400 mt-1 block">Within 24 hours</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES GRID SECTION */}
      <section id="features" className="py-24 bg-slate-50 border-y border-slate-100 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">
              End-to-End Capabilities
            </h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Engineered for Modern Property Management
            </h3>
            <p className="mt-4 text-slate-600 text-base sm:text-lg">
              Everything property managers and real estate agencies need to run smooth, profitable operations in one unified workspace.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1: Multi-Tenant Architecture */}
            <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition duration-300 flex flex-col justify-between">
              <div>
                <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h4 className="text-xl font-bold text-slate-900 mb-2">
                  Multi-Tenant Architecture
                </h4>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Strict agency isolation backed by row-level security. Seamlessly assign dedicated property managers, register buildings, configure units, and invite staff members with granular role controls.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center text-xs font-semibold text-blue-600">
                <span>Agency-Level Privacy &bull; Role Delegation</span>
              </div>
            </div>

            {/* Feature 2: Automated Tenant Portals */}
            <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition duration-300 flex flex-col justify-between">
              <div>
                <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h4 className="text-xl font-bold text-slate-900 mb-2">
                  Automated Tenant Portals
                </h4>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Dedicated self-service resident experiences. Tenants log in to inspect active lease agreements, monitor deposit escrows, and lodge photo-backed maintenance tickets tied directly to their unit.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center text-xs font-semibold text-emerald-600">
                <span>Direct Maintenance &bull; Digital Leases</span>
              </div>
            </div>

            {/* Feature 3: Financial Ledgers */}
            <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition duration-300 flex flex-col justify-between">
              <div>
                <div className="h-12 w-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-6">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <h4 className="text-xl font-bold text-slate-900 mb-2">
                  Financial Ledgers
                </h4>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Clear accounting for property revenue and operating costs. Automatically calculate net profit across your entire portfolio or inspect property-specific expenses with real-time transaction ledgers.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center text-xs font-semibold text-purple-600">
                <span>Net Profit Calculation &bull; Audit Trail</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING SECTION */}
      <section id="pricing" className="py-24 bg-white scroll-mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">
              Flexible Plans
            </h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Transparent Pricing Built for Every Portfolio
            </h3>
            <p className="mt-4 text-slate-600 text-base sm:text-lg">
              Choose the plan that fits your portfolio scale. Upgrade or downgrade anytime.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            {/* Starter Plan */}
            <div className="rounded-2xl border border-slate-200 p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition">
              <div>
                <h4 className="text-xl font-bold text-slate-900">Starter</h4>
                <p className="text-sm text-slate-500 mt-1">
                  Perfect for individual landlords with boutique units.
                </p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-slate-900">KES 4,999</span>
                  <span className="text-sm text-slate-500 font-medium">/ month</span>
                </div>

                <ul className="mt-8 space-y-3.5 text-sm text-slate-600">
                  <li className="flex items-center gap-3">
                    <span className="text-emerald-500 font-bold">✓</span> Up to 15 residential units
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-emerald-500 font-bold">✓</span> 1 Property Manager seat
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-emerald-500 font-bold">✓</span> Automated Tenant Portal
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-emerald-500 font-bold">✓</span> Basic maintenance ticketing
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-emerald-500 font-bold">✓</span> Essential financial ledger
                  </li>
                </ul>
              </div>

              <Link
                href="/signup"
                className="mt-8 block text-center rounded-lg border border-slate-300 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Choose Starter
              </Link>
            </div>

            {/* Professional Plan (Highlighted) */}
            <div className="rounded-2xl border-2 border-blue-600 p-8 flex flex-col justify-between shadow-2xl relative ring-4 ring-blue-500/10 bg-white">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold uppercase tracking-wider py-1 px-4 rounded-full shadow-sm">
                Most Popular
              </div>

              <div>
                <h4 className="text-xl font-bold text-slate-900">Professional</h4>
                <p className="text-sm text-slate-500 mt-1">
                  Built for growing management agencies and commercial brokers.
                </p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-slate-900">KES 14,999</span>
                  <span className="text-sm text-slate-500 font-medium">/ month</span>
                </div>

                <ul className="mt-8 space-y-3.5 text-sm text-slate-600">
                  <li className="flex items-center gap-3">
                    <span className="text-blue-600 font-bold">✓</span> Up to 100 residential & commercial units
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-blue-600 font-bold">✓</span> Unlimited Property Managers & staff
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-blue-600 font-bold">✓</span> Automated Tenant Portals with R2 photos
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-blue-600 font-bold">✓</span> Priority contractor dispatch
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-blue-600 font-bold">✓</span> Advanced financial cash flow analytics
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-blue-600 font-bold">✓</span> Automated deposit escrow tracking
                  </li>
                </ul>
              </div>

              <Link
                href="/signup"
                className="mt-8 block text-center rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition shadow-md shadow-blue-500/25"
              >
                Start Free Trial &rarr;
              </Link>
            </div>

            {/* Enterprise Plan */}
            <div className="rounded-2xl border border-slate-200 p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition">
              <div>
                <h4 className="text-xl font-bold text-slate-900">Enterprise</h4>
                <p className="text-sm text-slate-500 mt-1">
                  For large-scale real estate firms and enterprise portfolios.
                </p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-slate-900">Custom</span>
                  <span className="text-sm text-slate-500 font-medium">/ tailored billing</span>
                </div>

                <ul className="mt-8 space-y-3.5 text-sm text-slate-600">
                  <li className="flex items-center gap-3">
                    <span className="text-emerald-500 font-bold">✓</span> Unlimited units, buildings & agencies
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-emerald-500 font-bold">✓</span> Multi-agency master management
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-emerald-500 font-bold">✓</span> Custom integrations & ERP exports
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-emerald-500 font-bold">✓</span> 99.9% uptime SLA & dedicated account lead
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="text-emerald-500 font-bold">✓</span> Custom domain branding
                  </li>
                </ul>
              </div>

              <Link
                href="/login"
                className="mt-8 block text-center rounded-lg border border-slate-300 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Contact Sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8 pb-8 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <span className="text-lg font-bold text-white tracking-tight">
                Estate<span className="text-blue-500">Flow</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400">
              <a href="#features" className="hover:text-white transition">
                Features
              </a>
              <a href="#pricing" className="hover:text-white transition">
                Pricing
              </a>
              <Link href="/login" className="hover:text-white transition">
                Portal Login
              </Link>
              <a href="#privacy" className="hover:text-white transition">
                Privacy Policy
              </a>
              <a href="#terms" className="hover:text-white transition">
                Terms of Service
              </a>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-4">
            <p>© {new Date().getFullYear()} EstateFlow Property Management SaaS. All rights reserved.</p>
            <p>Empowering agency owners, managers, and tenants across modern real estate portfolios.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}