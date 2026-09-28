// app/dashboard/maintenance/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { uploadFileToR2 } from '@/utils/storage/r2'
import { getUserAgencyContext } from '@/utils/supabase/get-context'

export async function resolveTicket(formData: FormData) {
  const ticket_id = formData.get('ticket_id') as string
  const supabase = await createClient()

  const { error } = await supabase
    .from('maintenance_tickets')
    .update({ 
      status: 'Resolved',
      resolved_at: new Date().toISOString()
    })
    .eq('id', ticket_id)

  if (error) {
    console.error('Error resolving ticket:', error)
  }

  // Refresh the pages to show updated status instantly
  revalidatePath('/dashboard/maintenance')
  revalidatePath('/dashboard')
  revalidatePath('/portal/maintenance')
  revalidatePath('/portal/clearance')
}

export async function updateTicketDetails(formData: FormData) {
  const supabase = await createClient()

  const ticket_id = formData.get('ticket_id') as string
  const status = formData.get('status') as string
  const contractor_id = formData.get('contractor_id') as string
  const rawCost = formData.get('cost') as string

  if (!ticket_id) return

  const cost = rawCost && !isNaN(parseFloat(rawCost)) ? parseFloat(rawCost) : 0

  const updatePayload: Record<string, any> = {
    status: status || 'Pending',
    assigned_to: contractor_id && contractor_id.trim() ? contractor_id.trim() : null,
    cost: cost,
  }

  if (status === 'Resolved') {
    updatePayload.resolved_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('maintenance_tickets')
    .update(updatePayload)
    .eq('id', ticket_id)

  if (error) {
    console.error('Error updating ticket details:', error)
  }

  revalidatePath('/dashboard/maintenance')
  revalidatePath('/dashboard')
  revalidatePath('/portal/maintenance')
  revalidatePath('/portal/clearance')
}

export async function createTicket(formData: FormData) {
  try {
    const supabase = await createClient()
    const { agencyId } = await getUserAgencyContext()

    const locationData = formData.get('location_data') as string
    const contractor_id = formData.get('contractor_id') as string
    const issue_description = formData.get('issue_description') as string
    const imageFile = formData.get('image') as File | null

    if (!locationData) {
      return { success: false, error: 'Please select a reporting property and tenant.' }
    }

    if (!issue_description || !issue_description.trim()) {
      return { success: false, error: 'Please enter an issue description.' }
    }

    const [unit_id, reported_by] = locationData.split('|')
    let image_url = null

    if (imageFile && imageFile.size > 0) {
      try {
        image_url = await uploadFileToR2(imageFile, 'maintenance-issues')
      } catch (error) {
        console.error('Upload failed:', error)
        return { success: false, error: 'Image upload failed. Please try again.' }
      }
    }

    const { error } = await supabase
      .from('maintenance_tickets')
      .insert([
        { 
          unit_id, 
          reported_by, 
          assigned_to: contractor_id && contractor_id.trim() ? contractor_id.trim() : null,
          issue_description,
          image_url, 
          status: 'Pending',
          agency_id: agencyId
        }
      ])

    if (error) {
      console.error('Error creating ticket:', error)
      return { success: false, error: error.message || 'Error logging maintenance ticket.' }
    }

    revalidatePath('/dashboard/maintenance')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (err: any) {
    console.error('createTicket error:', err)
    return { success: false, error: err.message || 'Unexpected server error' }
  }
}

export async function addContractor(formData: FormData) {
  try {
    const supabase = await createClient()
    const { agencyId } = await getUserAgencyContext()

    const name = formData.get('name') as string
    const specialty = formData.get('specialty') as string
    const phone_number = formData.get('phone_number') as string
    const email = formData.get('email') as string

    if (!name || !specialty) {
      return { success: false, error: 'Name and Specialty are required.' }
    }

    const { error } = await supabase
      .from('contractors')
      .insert([
        { 
          name, 
          specialty, 
          phone_number: phone_number || null, 
          email: email || null,
          agency_id: agencyId
        }
      ])

    if (error) {
      console.error('Error adding contractor:', error)
      return { success: false, error: error.message || 'Error saving contractor record.' }
    }

    revalidatePath('/dashboard/maintenance')
    return { success: true }
  } catch (err: any) {
    console.error('addContractor error:', err)
    return { success: false, error: err.message || 'Unexpected server error' }
  }
}

export interface ApproveQuoteResult {
  success: boolean
  error?: string
  limitExceeded?: boolean
  limit?: number
  quoteAmount?: number
}

/**
 * Approves a contractor repair quote for a maintenance ticket.
 * Enforces financial expense limits: If quote exceeds agency auto_approve_limit,
 * coordinators (property_manager) are blocked, requiring Agency Owner authorization.
 * Returns Promise<void> for direct React 19 formAction / action compatibility.
 */
export async function approveQuote(formData: FormData): Promise<void> {
  let redirectUrl = '/dashboard/maintenance'

  try {
    const supabase = await createClient()
    const { agencyId, role } = await getUserAgencyContext()

    const ticket_id = (formData.get('ticket_id') as string)?.trim()
    const rawQuoteAmount = formData.get('quote_amount') as string

    if (!ticket_id) {
      redirectUrl = '/dashboard/maintenance?message=' + encodeURIComponent('Ticket identifier is required.')
    } else {
      // 1. Fetch ticket to verify existence and determine quote amount
      const { data: ticket, error: ticketError } = await supabase
        .from('maintenance_tickets')
        .select('id, quote_amount, cost, agency_id, status, quote_status')
        .eq('id', ticket_id)
        .eq('agency_id', agencyId)
        .single()

      if (ticketError || !ticket) {
        redirectUrl = '/dashboard/maintenance?message=' + encodeURIComponent('Ticket not found or inaccessible.')
      } else {
        const effectiveQuoteAmount =
          rawQuoteAmount !== null && rawQuoteAmount !== undefined && rawQuoteAmount !== ''
            ? parseFloat(rawQuoteAmount)
            : Number(ticket.quote_amount ?? ticket.cost ?? 0)

        // 2. Fetch agency's maintenance_auto_approve_limit (default 5000.00 KES)
        let autoApproveLimit = 5000.0
        const { data: agencyData } = await supabase
          .from('agencies')
          .select('maintenance_auto_approve_limit')
          .eq('id', agencyId)
          .maybeSingle()

        if (
          agencyData?.maintenance_auto_approve_limit !== null &&
          agencyData?.maintenance_auto_approve_limit !== undefined
        ) {
          autoApproveLimit = Number(agencyData.maintenance_auto_approve_limit)
        }

        // 3. Enforce Financial Controls:
        // If quote_amount > agency's maintenance_auto_approve_limit AND role === 'property_manager', REJECT!
        if (role === 'property_manager' && effectiveQuoteAmount > autoApproveLimit) {
          redirectUrl =
            '/dashboard/maintenance?message=' +
            encodeURIComponent('Approval limit exceeded. Agency Owner sign-off required.')
        } else {
          // 4. Update ticket with approval record
          const updatePayload: Record<string, any> = {
            quote_status: 'approved',
            quote_amount: effectiveQuoteAmount,
            cost: effectiveQuoteAmount,
            status: ticket.status === 'Pending' ? 'In Progress' : ticket.status,
          }

          let { error: updateError } = await supabase
            .from('maintenance_tickets')
            .update(updatePayload)
            .eq('id', ticket_id)
            .eq('agency_id', agencyId)

          // Fallback if quote_status or quote_amount columns are not yet migrated
          if (
            updateError &&
            (updateError.message?.includes('quote_status') ||
              updateError.message?.includes('quote_amount'))
          ) {
            delete updatePayload.quote_status
            delete updatePayload.quote_amount
            const retryResult = await supabase
              .from('maintenance_tickets')
              .update(updatePayload)
              .eq('id', ticket_id)
              .eq('agency_id', agencyId)
            updateError = retryResult.error
          }

          if (updateError) {
            console.error('Error approving quote:', updateError)
            redirectUrl =
              '/dashboard/maintenance?message=' +
              encodeURIComponent(updateError.message || 'Failed to approve quote.')
          } else {
            revalidatePath('/dashboard/maintenance')
            revalidatePath('/dashboard')
            revalidatePath('/portal/maintenance')
            redirectUrl =
              '/dashboard/maintenance?message=' +
              encodeURIComponent('Repair quote approved successfully.')
          }
        }
      }
    }
  } catch (err: unknown) {
    console.error('approveQuote error:', err)
    redirectUrl = '/dashboard/maintenance?message=' + encodeURIComponent('Unexpected server error')
  }

  redirect(redirectUrl)
}
