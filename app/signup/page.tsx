// app/signup/page.tsx
import Link from 'next/link'
import { registerAgency } from './actions'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  // Await searchParams in Next.js 16
  const resolvedSearchParams = await searchParams
  const message = resolvedSearchParams.message

  return (
    <div className="min-h-screen bg-white text-slate-900 grid grid-cols-1 lg:grid-cols-12 font-sans selection:bg-emerald-500 selection:text-slate-950">
      
      {/* LEFT SIDE: CRISP ONBOARDING FORM (7 COLUMNS ON LARGE SCREENS) */}
      <div className="lg:col-span-7 flex flex-col justify-between p-6 sm:p-12 lg:p-16 bg-white">
        
        {/* Top Brand Header */}
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-white shadow-md shadow-slate-900/15 group-hover:border-emerald-500/50 transition duration-300">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-slate-900 font-sans">
                  LUFFI <span className="text-emerald-600 font-semibold">TECH</span>
                </span>
                <span className="text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Onboarding
                </span>
              </div>
              <span className="text-[10px] text-slate-500 tracking-wider uppercase font-medium">
                Enterprise Property OS
              </span>
            </div>
          </Link>

          <Link
            href="/login"
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
          >
            Sign In &rarr;
          </Link>
        </div>

        {/* Form Container */}
        <div className="my-10 max-w-lg w-full mx-auto lg:mx-0">
          <div className="mb-8">
            <span className="text-[11px] uppercase font-bold tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full inline-block mb-3">
              14-Day Institutional Trial
            </span>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
              Create Your Agency Account
            </h1>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              Establish your isolated multi-tenant agency workspace, invite property coordinators, and secure tenant deposit escrow.
            </p>
          </div>

          {/* Error Banner */}
          {message && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <span>⚠️</span>
              <span>{message}</span>
            </div>
          )}

          {/* Onboarding Form */}
          <form action={registerAgency} className="space-y-5">
            
            {/* Agency / Company Name */}
            <div>
              <label
                htmlFor="agency_name"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Company / Agency Name
              </label>
              <input
                id="agency_name"
                name="agency_name"
                type="text"
                required
                placeholder="e.g. Westlands Capital Asset Management"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-slate-50/70 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition shadow-xs"
              />
            </div>

            {/* First Name & Last Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="first_name"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                >
                  First Name
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  required
                  placeholder="Jane"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-slate-50/70 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition shadow-xs"
                />
              </div>

              <div>
                <label
                  htmlFor="last_name"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                >
                  Last Name
                </label>
                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  required
                  placeholder="Doe"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-slate-50/70 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition shadow-xs"
                />
              </div>
            </div>

            {/* Official Work Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Official Work Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="owner@westlandscapital.co.ke"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-slate-50/70 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition shadow-xs"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Master Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-slate-50/70 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition shadow-xs"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Minimum 6 characters. Stored with cryptographic encryption.
              </span>
            </div>

            {/* Submit Button (Deep Slate Blue) */}
            <div className="pt-3">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-6 text-sm shadow-lg shadow-slate-900/15 hover:shadow-slate-900/25 transition duration-200 gap-2"
              >
                <span>Complete Agency Registration</span>
                <span className="font-sans">&rarr;</span>
              </button>
            </div>

            <div className="text-center pt-2">
              <p className="text-xs text-slate-500">
                Already have an agency account?{' '}
                <Link
                  href="/login"
                  className="font-bold text-emerald-600 hover:text-emerald-700 transition"
                >
                  Log in to your workspace &rarr;
                </Link>
              </p>
            </div>

          </form>
        </div>

        {/* Left Side Footer */}
        <div className="text-[11px] text-slate-400 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; {new Date().getFullYear()} Luffi Tech Ltd. Nairobi, Kenya.</span>
          <span className="text-slate-400">Bank-Grade Multi-Tenant Isolation</span>
        </div>

      </div>

      {/* RIGHT SIDE: SOLID DEEP SLATE BLUE VALUE PROPS PANEL (5 COLUMNS ON LARGE SCREENS) */}
      <div className="lg:col-span-5 hidden lg:flex flex-col justify-between bg-slate-900 text-white p-12 lg:p-16 border-l border-slate-800 relative overflow-hidden">
        
        {/* Subtle Ambient Emerald Glow */}
        <div className="absolute -top-10 -right-10 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top: Minimalist Trust Badge */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-950/80 text-emerald-400 border border-emerald-500/30 mb-8 shadow-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Trusted by High-End Portfolios in Nairobi</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-snug">
            The Institutional Operating System for Property Portfolios.
          </h2>
          <p className="mt-3 text-slate-400 text-sm leading-relaxed">
            Eliminate operational delays and protect your agency reputation with purpose-built automation.
          </p>
        </div>

        {/* Middle: Key Value Propositions echoing Bento Grid */}
        <div className="my-10 space-y-5 relative z-10">
          
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex items-start gap-3.5">
            <div className="p-2 rounded-xl bg-emerald-950 border border-emerald-500/30 text-emerald-400 shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">100% Transparent Exit Clearances</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Zero arbitrary withholdings. Deductions are tied directly to contractor invoices with photographic evidence.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex items-start gap-3.5">
            <div className="p-2 rounded-xl bg-amber-950 border border-amber-500/30 text-amber-400 shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">48-Hour Maintenance SLA Tracking</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Live countdown timers and automated escalation keep site coordinators and contractors strictly accountable.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex items-start gap-3.5">
            <div className="p-2 rounded-xl bg-blue-950 border border-blue-500/30 text-blue-400 shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Atomic Portfolio Delegation</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Assign property portfolios in single PostgreSQL transactions with complete audit history and zero orphan-risk.
              </p>
            </div>
          </div>

        </div>

        {/* Bottom Social Proof & Metrics Strip */}
        <div className="pt-6 border-t border-slate-800 relative z-10 text-xs">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="font-black text-white block text-sm tabular-nums">KES 2.8B+</span>
              <span className="text-[10px] text-slate-500">Escrow Secured</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="font-black text-emerald-400 block text-sm tabular-nums">48 Hours</span>
              <span className="text-[10px] text-slate-500">Repair Cap</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="font-black text-white block text-sm tabular-nums">100%</span>
              <span className="text-[10px] text-slate-500">RLS Isolated</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  )
}
