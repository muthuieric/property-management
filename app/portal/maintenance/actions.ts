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

  // 2. Automatically pull the tenant_id associated with auth.uid()
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, agency_id')
    .eq('user_id', user.id)
    .single()

  if (tenantError || !tenant) {
    console.error('Tenant lookup error:', tenantError)
    redirect('/portal/maintenance?message=Tenant account profile not found')
  }

  // 3. Find tenant's active lease to determine the unit and agency
  const { data: lease, error: leaseError } = await supabase
    .from('leases')
    .select('unit_id, agency_id')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (leaseError || !lease) {
    console.error('Active lease lookup error:', leaseError)
    redirect('/portal/maintenance?message=You must have an active lease to submit a maintenance request')
  }

  const issue_description = formData.get('issue_description') as string
  const imageFile = formData.get('image') as File | null

  if (!issue_description || !issue_description.trim()) {
    redirect('/portal/maintenance?message=Please provide a description of the issue')
  }

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

  // 5. Insert into maintenance_tickets table
  const { error: insertError } = await supabase
    .from('maintenance_tickets')
    .insert([
      {
        unit_id: lease.unit_id,
        reported_by: tenant.id,
        issue_description: issue_description.trim(),
        image_url,
        status: 'Open',
        agency_id: lease.agency_id || tenant.agency_id,
      }
    ])

  if (insertError) {
    console.error('Error creating maintenance ticket:', insertError)
    redirect('/portal/maintenance?message=Error submitting ticket. Please try again.')
  }

  revalidatePath('/portal/maintenance')
  revalidatePath('/dashboard/maintenance')
  redirect('/portal/maintenance?message=Maintenance request submitted successfully!')
}

