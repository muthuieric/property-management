// app/dashboard/clearance/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'
import { removeTenantFromKaribu } from '@/utils/karibu/sync'

export async function postWaterBill(formData: FormData) {
  const supabase = await createClient()
  const { agencyId, userId } = await getUserAgencyContext()

  const tenant_id = formData.get('tenant_id') as string
  const unit_id = formData.get('unit_id') as string
  const property_id = formData.get('property_id') as string
  const rawAmount = formData.get('amount') as string
  const customDescription = formData.get('description') as string
  const prevReadingRaw = formData.get('previous_reading') as string
  const currReadingRaw = formData.get('current_reading') as string
  const rateRaw = formData.get('rate_per_unit') as string

  let amount = parseFloat(rawAmount)
  const prevReading = prevReadingRaw ? parseFloat(prevReadingRaw) : null
  const currReading = currReadingRaw ? parseFloat(currReadingRaw) : null
  const rate = rateRaw ? parseFloat(rateRaw) : 150

  let consumption: number | null = null
  if (prevReading !== null && currReading !== null && !isNaN(prevReading) && !isNaN(currReading)) {
    consumption = Math.max(0, currReading - prevReading)
    if (isNaN(amount) || amount <= 0) {
      amount = consumption * rate
    }
  }

  const queryParams = property_id ? `&property_id=${property_id}` : ''

  if (!tenant_id || isNaN(amount) || amount <= 0) {
    redirect(`/dashboard/clearance?message=Please enter a valid water bill amount or meter readings${queryParams}`)
  }

  const today = new Date().toISOString().split('T')[0]
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const description =
    customDescription?.trim() ||
    (consumption !== null
      ? `Monthly Water Bill (${consumption.toFixed(1)} m³ @ KES ${rate}) [Meter: ${prevReading} -> ${currReading}] - ${currentMonth}`
      : `Monthly Water Utility Bill - ${currentMonth}`)

  const { data: txData, error } = await supabase
    .from('transactions')
    .insert([
      {
        agency_id: agencyId,
        property_id: property_id || null,
        unit_id: unit_id || null,
        tenant_id,
        transaction_type: 'expense',
        amount,
        transaction_date: today,
        description,
      },
    ])
    .select('id')
    .single()

  if (error) {
    console.error('Error posting water bill:', error)
    redirect(`/dashboard/clearance?message=Failed to post water bill${queryParams}`)
  }

  // Record into water_meter_readings if readings were provided
  if (prevReading !== null && currReading !== null && unit_id) {
    try {
      const billingMonthDate = `${today.slice(0, 7)}-01`
      await supabase.from('water_meter_readings').upsert(
        [
          {
            agency_id: agencyId,
            property_id: property_id || null,
            unit_id,
            tenant_id: tenant_id || null,
            billing_month: billingMonthDate,
            previous_reading: prevReading,
            current_reading: currReading,
            rate_per_unit: rate,
            total_amount: amount,
            recorded_by: userId,
            billed_transaction_id: txData?.id || null,
          },
        ],
        { onConflict: 'unit_id,billing_month' }
      )
    } catch (meterErr) {
      console.warn('water_meter_readings table not available or insert error:', meterErr)
    }
  }

  revalidatePath('/dashboard/clearance')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/financials')
  revalidatePath('/portal')
  revalidatePath('/portal/clearance')
  redirect(`/dashboard/clearance?message=Water bill of KES ${amount.toLocaleString()} posted successfully${queryParams}`)
}

export async function initiateMoveOut(formData: FormData) {
  const supabase = await createClient()
  const { agencyId } = await getUserAgencyContext()

  const lease_id = formData.get('lease_id') as string
  const unit_id = formData.get('unit_id') as string
  const tenant_id = formData.get('tenant_id') as string
  const property_id = formData.get('property_id') as string
  const rawRepairCost = formData.get('repair_cost') as string
  const repair_description = formData.get('repair_description') as string
  const rawInvoiceRef = formData.get('invoice_ref') as string
  const ticket_id = formData.get('ticket_id') as string

  if (!lease_id || !unit_id) {
    redirect('/dashboard/clearance?message=Lease and unit information required')
  }

  const repairCost = rawRepairCost && !isNaN(parseFloat(rawRepairCost)) ? parseFloat(rawRepairCost) : 0
  const today = new Date().toISOString().split('T')[0]
  const invoiceRef = rawInvoiceRef?.trim() || `REF-DEDUCT-${Date.now().toString().slice(-6)}`

  // 1. If there are contractor repair deductions, post to transactions and link with documented invoice/ticket
  if (repairCost > 0) {
    const userDesc = repair_description?.trim() || 'Unit Turnover Repairs'
    const fullDescription = `[Invoice: ${invoiceRef}] Move-Out Contractor Deduction - ${userDesc}`

    // Insert repair deduction into transactions
    const { error: txError } = await supabase
      .from('transactions')
      .insert([
        {
          agency_id: agencyId,
          property_id: property_id || null,
          unit_id: unit_id || null,
          tenant_id: tenant_id || null,
          transaction_type: 'repair_cost',
          amount: repairCost,
          transaction_date: today,
          description: fullDescription,
        }
      ])

    if (txError) {
      console.error('Error recording repair deduction in transactions:', txError)
    }

    // Link or insert maintenance ticket for documentary evidence
    if (ticket_id) {
      const { error: ticketUpdateError } = await supabase
        .from('maintenance_tickets')
        .update({
          status: 'Resolved',
          cost: repairCost,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', ticket_id)
        .eq('agency_id', agencyId)

      if (ticketUpdateError) {
        console.error('Error linking deduction to existing maintenance ticket:', ticketUpdateError)
      }
    } else {
      const { error: ticketError } = await supabase
        .from('maintenance_tickets')
        .insert([
          {
            agency_id: agencyId,
            unit_id,
            tenant_id: tenant_id || null,
            reported_by: tenant_id || null,
            issue_description: `Move-Out Inspection Repair [Invoice: ${invoiceRef}]: ${userDesc}`,
            status: 'Resolved',
            cost: repairCost,
            created_at: new Date().toISOString(),
            resolved_at: new Date().toISOString(),
          }
        ])

      if (ticketError) {
        console.error('Error logging move-out repair ticket:', ticketError)
      }
    }
  }

  // 2. Mark the lease as inactive with end_date set to today
  const { error: leaseError } = await supabase
    .from('leases')
    .update({
      is_active: false,
      end_date: today,
    })
    .eq('id', lease_id)

  if (leaseError) {
    console.error('Error deactivating lease:', leaseError)
    redirect('/dashboard/clearance?message=Error ending lease')
  }

  // 3. Mark the unit as vacant again
  const { error: unitError } = await supabase
    .from('units')
    .update({ is_occupied: false })
    .eq('id', unit_id)

  if (unitError) {
    console.error('Error updating unit status to vacant:', unitError)
  }

  // 3b. Remove tenant record from Karibu VMS access directory
  if (tenant_id) {
    try {
      await removeTenantFromKaribu(tenant_id)
    } catch (vmsErr) {
      console.warn('[Karibu VMS] Non-blocking move-out deprovision warning:', vmsErr)
    }
  }

  // 4. Refresh all relevant routes across dashboard and tenant portal
  revalidatePath('/dashboard/clearance')
  revalidatePath('/dashboard/deposits')
  revalidatePath('/dashboard/tenants')
  revalidatePath('/dashboard')
  revalidatePath('/portal')
  revalidatePath('/portal/clearance')
  redirect('/dashboard/clearance?message=Move-out initiated successfully! Unit is now vacant and clearance statement is updated.')
}

