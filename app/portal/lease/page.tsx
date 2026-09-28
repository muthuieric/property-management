// app/portal/lease/page.tsx
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LeaseReviewClient, { LeaseAgreementDetails } from './components/LeaseReviewClient'

export default async function TenantLeaseAgreementPage() {
  const supabase = await createClient()

  // 1. Authenticate user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login?message=Please sign in to view your lease agreement')
  }

  // 2. Fetch tenant record
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle()

  // 3. Fetch lease(s) for this tenant
  let leaseRecord: LeaseAgreementDetails | null = null
  let agencyName = 'Luffi Tech Real Estate'

  if (tenant) {
    const { data: leases } = await supabase
      .from('leases')
      .select(`
        id,
        lease_status,
        signature_hash,
        signed_by_ip,
        signed_at,
        start_date,
        end_date,
        deposit_amount,
        deposit_months,
        is_active,
        agency_id,
        units (
          id,
          unit_number,
          base_rent,
          properties (
            id,
            name,
            location,
            agency_id
          )
        )
      `)
      .or(`tenant_id.eq.${tenant.id},tenant_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (leases && leases.length > 0) {
      // Prioritize pending_signature, then active
      const typedLeases = leases as unknown as LeaseAgreementDetails[]
      const pendingLease = typedLeases.find((l) => l.lease_status === 'pending_signature')
      leaseRecord = pendingLease || typedLeases[0]
    }

    // Try resolving agency name
    const propAgencyId = leaseRecord?.units?.properties
      ? (leaseRecord.units.properties as { agency_id?: string }).agency_id
      : undefined

    const resolvedAgencyId =
      leaseRecord?.agency_id ||
      propAgencyId ||
      tenant.agency_id

    if (resolvedAgencyId) {
      const { data: agency } = await supabase
        .from('agencies')
        .select('name')
        .eq('id', resolvedAgencyId)
        .maybeSingle()

      if (agency?.name) {
        agencyName = agency.name
      }
    }
  }

  const tenantName = tenant
    ? `${tenant.first_name || ''} ${tenant.last_name || ''}`.trim() || 'Resident'
    : 'Resident'

  return (
    <div className="p-4 md:p-8 text-slate-900 w-full max-w-5xl mx-auto space-y-6">
      {/* NAVIGATION BREADCRUMB & HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/portal"
              className="text-xs text-slate-500 hover:text-slate-800 transition-colors inline-flex items-center gap-1 font-medium"
            >
              <span>&larr;</span>
              <span>Resident Portal</span>
            </Link>
            <span className="text-slate-300">&bull;</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              Legal Tenancy Agreement
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Tenancy Agreement &amp; Digital Signatures
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Review your legal lease agreement, escrow custody provisions, and digital signature records.
          </p>
        </div>

        {leaseRecord && (
          <div className="flex items-center gap-2 self-start sm:self-center">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border ${
                leaseRecord.lease_status === 'active' || leaseRecord.signature_hash
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-amber-50 text-amber-900 border-amber-300'
              }`}
            >
              {leaseRecord.lease_status === 'active' || leaseRecord.signature_hash
                ? 'Status: Active & Signed'
                : 'Status: Pending Signature'}
            </span>
          </div>
        )}
      </div>

      {/* CONTENT */}
      {!leaseRecord ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 shadow-xs text-center max-w-lg mx-auto my-12">
          <div className="h-12 w-12 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1.5">No Tenancy Agreement On File</h2>
          <p className="text-slate-500 text-xs leading-relaxed mb-6">
            We could not find an executed or pending lease agreement linked to your resident account ({user.email}). Once your property manager generates a lease agreement for your unit, it will appear here for review and digital signature.
          </p>
          <Link
            href="/portal"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
          >
            <span>Return to Dashboard</span>
            <span>&rarr;</span>
          </Link>
        </div>
      ) : (
        <LeaseReviewClient
          lease={leaseRecord}
          tenant={{
            id: tenant?.id || user.id,
            fullName: tenantName,
            email: tenant?.email || user.email || '',
            phoneNumber: tenant?.phone_number || 'On file',
          }}
          agencyName={agencyName}
        />
      )}
    </div>
  )
}
