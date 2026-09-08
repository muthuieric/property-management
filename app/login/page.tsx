// app/login/page.tsx
import Link from 'next/link'
import { login } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>
}) {
  // Await searchParams in Next.js 16
  const resolvedSearchParams = await searchParams
  const message = resolvedSearchParams.message
  const error = resolvedSearchParams.error

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative selection:bg-emerald-500 selection:text-slate-950 font-sans">
      
      {/* Subtle Ambient Background Mesh Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[300px] bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[250px] bg-slate-300/40 blur-[80px] rounded-full pointer-events-none" />

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10 mb-8">
        <Link href="/" className="inline-flex items-center gap-3 group mb-3">
          <div className="h-10 w-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-white shadow-md shadow-slate-900/15 group-hover:border-emerald-500/50 transition duration-300">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-slate-900 font-sans">
                LUFFI <span className="text-emerald-600 font-semibold">TECH</span>
              </span>
              <span className="text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Property OS
              </span>
            </div>
            <span className="text-[10px] text-slate-500 tracking-wider uppercase font-medium block">
              Enterprise Asset Infrastructure
            </span>
          </div>
        </Link>
      </div>

      {/* CENTERED PREMIUM GLASSMORPHISM CARD */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white/90 backdrop-blur-xl py-8 px-6 sm:px-10 rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/60">
          
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Sign In to Your Workspace
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-relaxed">
              Access your executive portfolio overview, site action center, or tenant escrow portal.
            </p>
          </div>

          {/* HIGH-VISIBILITY ROSE-COLORED ACCOUNT SUSPENDED BANNER */}
          {error === 'account_suspended' && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-3 shadow-xs">
              <div className="p-1 bg-rose-100 rounded-lg text-rose-700 shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="leading-relaxed">
                <p className="font-bold text-sm text-rose-800">
                  Access Revoked: Your account has been suspended.
                </p>
                <p className="mt-1 text-rose-700">
                  Your administrative permissions or tenancy access have been deactivated by the agency administrator. Please contact your agency owner for account reinstatement.
                </p>
              </div>
            </div>
          )}

          {/* GENERIC ERROR BANNER */}
          {message && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs text-center font-semibold">
              {message}
            </div>
          )}

          {/* LOGIN FORM */}
          <form action={login} className="space-y-4">
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
                placeholder="coordinator@property.co.ke"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-slate-50/70 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition shadow-xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700"
                >
                  Password
                </label>
                <Link
                  href="/update-password"
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm bg-slate-50/70 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition shadow-xs"
              />
            </div>

            {/* Submit Button (Deep Slate Blue) */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-4 text-sm shadow-md shadow-slate-900/15 hover:shadow-slate-900/25 transition duration-200 gap-2"
              >
                <span>Sign In to System</span>
                <span className="font-sans">&rarr;</span>
              </button>
            </div>
          </form>

          {/* Card Footer */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col items-center gap-3 text-xs text-slate-500">
            <p>
              Don&apos;t have an agency account?{' '}
              <Link
                href="/signup"
                className="font-bold text-emerald-600 hover:text-emerald-700 transition"
              >
                Start Free 14-Day Trial &rarr;
              </Link>
            </p>
            <Link
              href="/"
              className="text-slate-400 hover:text-slate-600 transition"
            >
              &larr; Return to Luffi Tech Overview
            </Link>
          </div>

        </div>

        {/* Security Trust Note */}
        <p className="mt-6 text-center text-[11px] text-slate-400">
          Protected by PostgreSQL Row-Level Security &bull; Bank-Grade Tenancy Isolation
        </p>
      </div>

    </div>
  )
}