'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import crypto from 'crypto'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { syncSingleTenantToKaribu } from '@/utils/karibu/sync'

export interface SignatureData {
  fullName: string
  signatureType?: 'typed' | 'drawn'
  signatureImage?: string
  agreedToTerms?: boolean
}

export type SignatureInput = string | SignatureData

export interface SignLeaseResult {
  success: boolean
  error?: string
  hash?: string
  signatureHash?: string
  signedAt?: string
  leaseId?: string
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return null
  return createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Digitally signs a lease agreement for an authenticated tenant.
 * Creates an immutable SHA-256 cryptographic seal incorporating lease ID, tenant ID, typed legal name, and timestamp.
 * Captures tenant's IP address and activates the tenancy agreement.
 */
export async function signLeaseAgreement(
  leaseId: string,
  tenantNameTyped: SignatureInput
): Promise<SignLeaseResult> {
  try {
    const supabase = await createClient()

    // 1. Verify tenant authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        error: 'Authentication session expired. Please sign in to digitally sign this lease.',
      }
    }

    if (!leaseId) {
      return { success: false, error: 'Missing lease identifier.' }
    }

    // Resolve legal name from either string or SignatureData object
    const cleanLegalName =
      typeof tenantNameTyped === 'string'
        ? tenantNameTyped.trim()
        : tenantNameTyped?.fullName?.trim()

    if (!cleanLegalName) {
      return {
        success: false,
        error: 'Your full legal name is required to execute this agreement.',
      }
    }

    // If SignatureData object is supplied, verify agreement checkbox if provided
    if (
      typeof tenantNameTyped === 'object' &&
      tenantNameTyped.agreedToTerms === false
    ) {
      return {
        success: false,
        error: 'You must review and agree to the legally binding terms before signing.',
      }
    }

    // 2. Identify tenant profile linked to this authenticated user
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, user_id, first_name, last_name, email, phone_number, agency_id')
      .or(`user_id.eq.${user.id},id.eq.${user.id}`)
      .maybeSingle()

    // 3. Fetch lease agreement record
    const { data: lease, error: leaseErr } = await supabase
      .from('leases')
      .select(`
        id,
        tenant_id,
        unit_id,
        agency_id,
        lease_status,
        is_active,
        signature_hash,
        signed_at,
        units (
          id,
          unit_number,
          property_id
        )
      `)
      .eq('id', leaseId)
      .maybeSingle()

    if (leaseErr || !lease) {
      return {
        success: false,
        error: 'Lease agreement record not found or inaccessible.',
      }
    }

    // Verify lease belongs to this tenant
    const matchesTenant =
      (tenant && lease.tenant_id === tenant.id) ||
      lease.tenant_id === user.id

    if (!matchesTenant) {
      return {
        success: false,
        error: 'Unauthorized: This lease agreement does not belong to your account.',
      }
    }

    // Check if lease is already signed and active
    if (lease.signature_hash && lease.lease_status === 'active') {
      return {
        success: true,
        hash: lease.signature_hash,
        signatureHash: lease.signature_hash,
        signedAt: lease.signed_at || new Date().toISOString(),
        leaseId: lease.id,
      }
    }

    // 4. Capture Client IP & Audit Timestamp
    const headerStore = await headers()
    const rawIp =
      headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headerStore.get('x-real-ip') ||
      '127.0.0.1'

    const signedAt = new Date().toISOString()
    const tenantIdentifier = tenant?.id || user.id
    const signatureType =
      typeof tenantNameTyped === 'object'
        ? tenantNameTyped.signatureType || 'typed'
        : 'typed'

    // 5. Generate Cryptographically Secure Unique Signature Hash (SHA-256)
    // Incorporates leaseId, tenantId, tenantNameTyped, timestamp, and entropy
    const entropy = crypto.randomBytes(16).toString('hex')
    const signatureDigestInput = [
      `LEASE:${leaseId}`,
      `TENANT:${tenantIdentifier}`,
      `NAME:${cleanLegalName}`,
      `TIMESTAMP:${signedAt}`,
      `IP:${rawIp}`,
      `TYPE:${signatureType}`,
      `SALT:${entropy}`,
    ].join('|')

    const signatureHash = crypto
      .createHash('sha256')
      .update(signatureDigestInput)
      .digest('hex')

    // 6. Persist Digital Signature & Transition Lease Status to 'active'
    const updatePayload = {
      signature_hash: signatureHash,
      signed_by_ip: rawIp,
      signed_at: signedAt,
      lease_status: 'active',
      is_active: true,
    }

    const adminClient = getSupabaseAdmin()
    const db = adminClient || supabase

    const { error: updateError } = await db
      .from('leases')
      .update(updatePayload)
      .eq('id', leaseId)

    if (updateError) {
      console.error('Failed to update lease with digital signature:', updateError)
      return {
        success: false,
        error: `Database update failed: ${updateError.message}`,
      }
    }

    // 7. Mark Unit as occupied if linked
    if (lease.unit_id) {
      await db
        .from('units')
        .update({ is_occupied: true })
        .eq('id', lease.unit_id)
    }

    // 8. Trigger Karibu VMS Access Pass Sync (Non-blocking)
    if (tenant?.id) {
      syncSingleTenantToKaribu(tenant.id).catch((syncErr) => {
        console.warn('Karibu VMS sync warning following lease execution:', syncErr)
      })
    }

    // 9. Invalidate Next.js Caches
    revalidatePath('/portal/lease')
    revalidatePath('/portal/leases')
    revalidatePath('/portal')
    revalidatePath('/dashboard/leases')
    revalidatePath('/dashboard/tenants')
    revalidatePath('/dashboard')

    return {
      success: true,
      hash: signatureHash,
      signatureHash,
      signedAt,
      leaseId: lease.id,
    }
  } catch (err: unknown) {
    console.error('Unhandled error executing digital lease signature:', err)
    const errorMsg =
      err instanceof Error
        ? err.message
        : 'An unexpected error occurred while executing the signature.'
    return {
      success: false,
      error: errorMsg,
    }
  }
}
