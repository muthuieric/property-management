import { getInviteDetails } from '@/app/dashboard/tenants/actions'
import Link from 'next/link'
import OnboardingClientForm from './OnboardingClientForm'

interface OnboardingPageProps {
  params: Promise<{
    token: string
  }>
}

export default async function OnboardingPage({ params }: OnboardingPageProps) {
  const { token } = await params
  const { valid, invite, error } = await getInviteDetails(token)

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Top Brand Bar */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <div className="inline-flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-md">
            L
          </div>
          <span className="text-base font-bold tracking-tight text-slate-900">
            Luffi Tech
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Tenant Onboarding
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-500">
          Electronic Resident Verification &amp; Unit Access Setup
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-lg px-4 sm:px-0">
        {!valid || !invite ? (
          /* Error State Card */
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center space-y-4 animate-in fade-in duration-300">
            <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto shadow-inner">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">Invitation Unavailable</h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                {error ||
                  'This invitation link is invalid, expired, or has already been completed.'}
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 text-left space-y-1">
              <span className="font-semibold text-slate-700 block">Next Steps:</span>
              <p>
                Please contact your property coordinator or agency manager to request a new
                onboarding invitation link.
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/login"
                className="inline-block w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
              >
                Go to Portal Login
              </Link>
            </div>
          </div>
        ) : (
          /* Active Onboarding Form */
          <OnboardingClientForm
            token={invite.token}
            phone={invite.phone}
            unitNumber={invite.unitNumber}
            propertyName={invite.propertyName}
            propertyLocation={invite.propertyLocation}
          />
        )}
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mt-8 text-xs text-slate-400">
        &copy; {new Date().getFullYear()} Luffi Tech. Enterprise Property Management.
      </div>
    </div>
  )
}

