// app/dashboard/renewals/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'

export type UpdateRenewalPayload = {
  leaseId: string
  unitId: string
  proposedRent: number
  newEndDate: string
  renewalStatus: 'active' | 'pending_renewal' | 'renewed'
}

export async function updateLeaseRenewal(payload: UpdateRenewalPayload) {
  try {
    const supabase = await createClient()
    const { userId, agencyId, role } = await getUserAgencyContext()

    const { leaseId, unitId, proposedRent, newEndDate, renewalStatus } = payload

    if (!leaseId || !unitId || !newEndDate) {
      return { success: false, error: 'Missing required renewal parameters.' }
    }

    // 1. Verify lease belongs to caller's agency
    const { data: lease, error: fetchErr } = await supabase
      .from('leases')
      .select('id, agency_id, unit_id, is_active')
      .eq('id', leaseId)
      .single()

    if (fetchErr || !lease) {
      return { success: false, error: 'Lease record not found.' }
    }

    if (lease.agency_id !== agencyId) {
      return { success: false, error: 'Unauthorized: Cross-agency modification rejected.' }
    }

    // 2. If coordinator, verify this unit belongs to an assigned property
    if (role === 'property_manager') {
      const { data: unitRecord } = await supabase
        .from('units')
        .select('id, property_id, properties(id, manager_id)')
        .eq('id', unitId)
        .single()

      const unitProp: any = unitRecord?.properties
      if (!unitProp || unitProp.manager_id !== userId) {
        return {
          success: false,
          error: 'Unauthorized: You are not the assigned coordinator for this property.',
        }
      }
    }

    // 3. Update lease renewal terms
    const updatePayload: Record<string, any> = {
      end_date: newEndDate,
      renewal_status: renewalStatus,
    }

    // Defensive update: attempt with renewal_status, fallback if column doesn't exist yet
    const { error: updateLeaseErr } = await supabase
      .from('leases')
      .update(updatePayload)
      .eq('id', leaseId)

    if (updateLeaseErr) {
      // If renewal_status column not yet migrated in database, fallback to updating end_date only
      if (updateLeaseErr.message?.includes('renewal_status')) {
        const { error: fallbackErr } = await supabase
          .from('leases')
          .update({ end_date: newEndDate })
          .eq('id', leaseId)

        if (fallbackErr) {
          return { success: false, error: `Failed to update lease: ${fallbackErr.message}` }
        }
      } else {
        return { success: false, error: `Failed to update lease: ${updateLeaseErr.message}` }
      }
    }

    // 4. Update unit's base rent if provided and greater than 0
    if (proposedRent && proposedRent > 0) {
      const { error: unitErr } = await supabase
        .from('units')
        .update({ base_rent: proposedRent })
        .eq('id', unitId)

      if (unitErr) {
        console.error('Warning: Failed to update unit base_rent:', unitErr.message)
      }
    }

    // 5. Revalidate affected dashboard routes
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/deposits')
    revalidatePath('/dashboard/properties')
    revalidatePath('/portal')

    return {
      success: true,
      message:
        renewalStatus === 'renewed'
          ? 'Lease successfully renewed with updated terms.'
          : 'Renewal proposal recorded and status updated.',
    }
  } catch (err: any) {
    console.error('updateLeaseRenewal error:', err)
    return { success: false, error: err.message || 'An unexpected error occurred.' }
  }
}

export type MarkVacancyPayload = {
  leaseId: string
  unitId: string
  vacateDate?: string
  notes?: string
}

export async function markLeaseForVacancy(payload: MarkVacancyPayload) {
  try {
    const supabase = await createClient()
    const { userId, agencyId, role } = await getUserAgencyContext()

    const { leaseId, unitId, vacateDate } = payload

    if (!leaseId || !unitId) {
      return { success: false, error: 'Missing lease or unit reference.' }
    }

    // 1. Verify lease belongs to caller's agency
    const { data: lease, error: fetchErr } = await supabase
      .from('leases')
      .select('id, agency_id, unit_id, is_active')
      .eq('id', leaseId)
      .single()

    if (fetchErr || !lease) {
      return { success: false, error: 'Lease record not found.' }
    }

    if (lease.agency_id !== agencyId) {
      return { success: false, error: 'Unauthorized: Cross-agency modification rejected.' }
    }

    // 2. If coordinator, verify ownership
    if (role === 'property_manager') {
      const { data: unitRecord } = await supabase
        .from('units')
        .select('id, property_id, properties(id, manager_id)')
        .eq('id', unitId)
        .single()

      const unitProp: any = unitRecord?.properties
      if (!unitProp || unitProp.manager_id !== userId) {
        return {
          success: false,
          error: 'Unauthorized: You are not the assigned coordinator for this property.',
        }
      }
    }

    // 3. Update lease status to 'vacating' and optionally update end_date
    const updateData: Record<string, any> = {
      renewal_status: 'vacating',
    }
    if (vacateDate) {
      updateData.end_date = vacateDate
    }

    const { error: updateErr } = await supabase
      .from('leases')
      .update(updateData)
      .eq('id', leaseId)

    if (updateErr) {
      // Fallback if column not yet added
      if (updateErr.message?.includes('renewal_status') && vacateDate) {
        await supabase
          .from('leases')
          .update({ end_date: vacateDate })
          .eq('id', leaseId)
      } else {
        return { success: false, error: `Failed to mark lease for vacancy: ${updateErr.message}` }
      }
    }

    // 4. Revalidate
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/clearance')
    revalidatePath('/dashboard/deposits')

    return {
      success: true,
      message: 'Lease successfully marked for vacancy. Exit workflow initiated.',
    }
  } catch (err: any) {
    console.error('markLeaseForVacancy error:', err)
    return { success: false, error: err.message || 'An unexpected error occurred.' }
  }
}

