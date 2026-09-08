// app/dashboard/clearance/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'

export async function postWaterBill(formData: FormData) {
  const supabase = await createClient()
  const { agencyId } = await getUserAgencyContext()

  const tenant_id = formData.get('tenant_id') as string
  const unit_id = formData.get('unit_id') as string
  const property_id = formData.get('property_id') as string
  const rawAmount = formData.get('amount') as string
  const customDescription = formData.get('description') as string

  const amount = parseFloat(rawAmount)
  if (!tenant_id || isNaN(amount) || amount <= 0) {
    redirect('/dashboard/clearance?message=Please enter a valid water bill amount')
  }

  const today = new Date().toISOString().split('T')[0]
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const description = customDescription?.trim() || `Monthly Water Utility Bill - ${currentMonth}`

  const { error } = await supabase
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
      }
    ])

  if (error) {
    console.error('Error posting water bill:', error)
    redirect('/dashboard/clearance?message=Failed to post water bill')
  }

  revalidatePath('/dashboard/clearance')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/financials')
  revalidatePath('/portal')
  revalidatePath('/portal/clearance')
  redirect('/dashboard/clearance?message=Water bill posted successfully')
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

  // 4. Refresh all relevant routes across dashboard and tenant portal
  revalidatePath('/dashboard/clearance')
  revalidatePath('/dashboard/deposits')
  revalidatePath('/dashboard/tenants')
  revalidatePath('/dashboard')
  revalidatePath('/portal')
  revalidatePath('/portal/clearance')
  redirect('/dashboard/clearance?message=Move-out initiated successfully! Unit is now vacant and clearance statement is updated.')
}

