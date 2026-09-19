// app/portal/maintenance/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { uploadFileToR2 } from '@/utils/storage/r2'

export async function createTenantTicket(formData: FormData) {
  const supabase = await createClient()

  // 1. Verify user authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login?message=Please sign in to submit a maintenance request')
  }

  // 2. Automatically pull the tenant record associated with auth.uid()
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, agency_id')
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle()

  if (tenantError || !tenant) {
    console.error('Tenant lookup error:', tenantError)
    redirect('/portal/maintenance?message=Tenant account profile not found')
  }

  // 3. Find tenant's active lease to determine the unit and agency
  const { data: lease, error: leaseError } = await supabase
    .from('leases')
    .select(`
      unit_id,
      agency_id,
      units (
        id,
        property_id,
        properties (
          id,
          agency_id
        )
      )
    `)
    .or(`tenant_id.eq.${tenant.id},tenant_id.eq.${user.id}`)
    .eq('is_active', true)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (leaseError || !lease) {
    console.error('Active lease lookup error:', leaseError)
    redirect('/portal/maintenance?message=You must have an active lease to submit a maintenance request')
  }

  // Robustly resolve agency_id from lease, unit property, tenant record, or profile
  let resolvedAgencyId = 
    lease.agency_id ||
    (lease.units as any)?.properties?.agency_id ||
    tenant.agency_id

  if (!resolvedAgencyId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('agency_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.agency_id) {
      resolvedAgencyId = profile.agency_id
    }
  }

  if (!resolvedAgencyId) {
    console.error('Failed to resolve agency_id for tenant ticket:', { tenant, lease })
    redirect('/portal/maintenance?message=Unable to determine agency for your property. Please contact management.')
  }

  const title = (formData.get('title') as string)?.trim()
  const category = (formData.get('category') as string)?.trim() || 'General'
  const urgency = (formData.get('urgency') as string)?.trim() || 'Standard'
  const description = (formData.get('description') as string)?.trim() || (formData.get('issue_description') as string)?.trim()
  const imageFile = formData.get('image') as File | null

  if (!description && !title) {
    redirect('/portal/maintenance?message=Please provide details about the issue')
  }

  const formattedDescription = title
    ? `[${category}] [Urgency: ${urgency}] ${title} - ${description || 'No additional details provided'}`
    : description

  // 4. Handle optional photo attachment
  let image_url: string | null = null
  if (imageFile && imageFile.size > 0) {
    try {
      image_url = await uploadFileToR2(imageFile, 'maintenance-issues')
    } catch (uploadError) {
      console.error('Image upload failed:', uploadError)
      redirect('/portal/maintenance?message=Image upload failed. Please try again.')
    }
  }

  // 5. Insert into maintenance_tickets table with verified agency_id and tenant_id
  const { error: insertError } = await supabase
    .from('maintenance_tickets')
    .insert([
      {
        unit_id: lease.unit_id,
        tenant_id: tenant.id,
        reported_by: tenant.id,
        issue_description: formattedDescription,
        image_url,
        status: 'Pending',
        agency_id: resolvedAgencyId,
      }
    ])

  if (insertError) {
    console.error('Error creating maintenance ticket:', insertError)
    redirect('/portal/maintenance?message=Error submitting ticket. Please try again.')
  }

  // 6. Comprehensive cache invalidation so admin and portal update immediately
  revalidatePath('/portal/maintenance')
  revalidatePath('/dashboard/maintenance')
  revalidatePath('/dashboard/maintenance', 'page')
  revalidatePath('/dashboard')
  redirect('/portal/maintenance?message=Maintenance request submitted successfully!')
}
