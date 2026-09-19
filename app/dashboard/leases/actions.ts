'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'
import { syncSingleTenantToKaribu } from '@/utils/karibu/sync'

export interface CreateLeaseResult {
  success: boolean
  error?: string
  leaseId?: string
}

export async function createLease(formData: FormData): Promise<CreateLeaseResult> {
  try {
    const supabase = await createClient()
    const { agencyId } = await getUserAgencyContext()

    const unit_id = formData.get('unit_id') as string
    const tenant_id = formData.get('tenant_id') as string
    const start_date = formData.get('start_date') as string
    const end_date = (formData.get('end_date') as string) || null
    const base_rent_raw = formData.get('base_rent') as string
    const deposit_amount_raw = formData.get('deposit_amount') as string

    if (!unit_id || !tenant_id || !start_date) {
      return { success: false, error: 'Unit identifier, tenant selection, and lease start date are required.' }
    }

    const base_rent = base_rent_raw ? parseFloat(base_rent_raw) : null
    const deposit_amount = deposit_amount_raw ? parseFloat(deposit_amount_raw) : 0
    const deposit_months_raw = formData.get('deposit_months') as string
    const deposit_months = deposit_months_raw ? parseInt(deposit_months_raw, 10) : 1

    // 1. Verify unit exists and belongs to this agency's properties
    const { data: unitRecord, error: unitCheckErr } = await supabase
      .from('units')
      .select('id, unit_number, is_occupied, base_rent, property_id, properties(id, agency_id)')
      .eq('id', unit_id)
      .single()

    if (unitCheckErr || !unitRecord) {
      return { success: false, error: 'The specified unit could not be found.' }
    }

    const unitAgencyId = (unitRecord.properties as any)?.agency_id
    if (unitAgencyId && unitAgencyId !== agencyId) {
      return { success: false, error: 'Unauthorized: Cross-agency unit allocation is not permitted.' }
    }

    // 2. Insert lease record
    const leaseData: Record<string, any> = {
      unit_id,
      tenant_id,
      start_date,
      deposit_amount: isNaN(deposit_amount) ? 0 : deposit_amount,
      is_active: true,
      agency_id: agencyId,
    }

    if (deposit_months > 0) {
      leaseData.deposit_months = deposit_months
    }

    if (end_date) {
      leaseData.end_date = end_date
    }

    let { data: newLease, error: leaseError } = await supabase
      .from('leases')
      .insert([leaseData])
      .select('id')
      .single()

    if (leaseError) {
      console.error('Error creating lease record:', leaseError)

      // Fallback: If deposit_months column not yet migrated, remove and retry
      if (leaseError.message?.includes('deposit_months')) {
        delete leaseData.deposit_months
        const retryResult = await supabase
          .from('leases')
          .insert([leaseData])
          .select('id')
          .single()
        newLease = retryResult.data
        leaseError = retryResult.error
      }

      // Fallback: If end_date column is not present in schema, retry without it
      if (leaseError && leaseError.message?.includes('end_date') && end_date) {
        delete leaseData.end_date
        const { data: retryLease, error: retryErr } = await supabase
          .from('leases')
          .insert([leaseData])
          .select('id')
          .single()

        if (retryErr) {
          return { success: false, error: retryErr.message || 'Failed to activate lease agreement.' }
        }
      } else if (leaseError) {
        return { success: false, error: leaseError.message || 'Failed to activate lease agreement.' }
      }
    }

    // 3. Mark the unit as occupied and optionally update its base_rent
    const unitUpdate: Record<string, any> = { is_occupied: true }
    if (base_rent !== null && !isNaN(base_rent) && base_rent > 0) {
      unitUpdate.base_rent = base_rent
    }

    const { error: unitUpdateErr } = await supabase
      .from('units')
      .update(unitUpdate)
      .eq('id', unit_id)

    if (unitUpdateErr) {
      console.error('Warning: Failed to update unit occupancy status:', unitUpdateErr)
    }

    // 3b. Sync tenant with updated unit and property into Karibu VMS
    try {
      await syncSingleTenantToKaribu(tenant_id, {
        propertyId: unitRecord.property_id,
        unitNumber: unitRecord.unit_number,
      })
    } catch (vmsErr) {
      console.warn('[Karibu VMS] Non-blocking lease sync warning:', vmsErr)
    }

    // 4. Revalidate all dependent dashboard views
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/properties')
    revalidatePath('/dashboard/property/[id]', 'page')
    revalidatePath('/dashboard/tenants')
    revalidatePath('/dashboard/deposits')
    revalidatePath('/dashboard/financials')
    revalidatePath('/portal')

    return { success: true, leaseId: newLease?.id }
  } catch (err: any) {
    console.error('createLease action error:', err)
    return { success: false, error: err.message || 'An unexpected error occurred while processing the lease.' }
  }
}
