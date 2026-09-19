// utils/karibu/sync.ts
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { syncGroups, syncUsers, deleteUser, KaribuGroupInput, KaribuUserInput } from './client'

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase credentials missing for directory synchronization.')
  }

  return createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export interface SyncTenantOptions {
  propertyId?: string
  unitNumber?: string
}

export interface SyncResult {
  success: boolean
  message: string
  groupsCount?: number
  usersCount?: number
  error?: string
  details?: any
}

/**
 * Synchronize a single tenant to Karibu VMS.
 * Ensures the tenant's building/group exists first, then links the tenant as a host.
 */
export async function syncSingleTenantToKaribu(
  tenantId: string,
  options?: SyncTenantOptions
): Promise<SyncResult> {
  try {
    const supabaseAdmin = getAdminClient()

    // 1. Fetch tenant data
    const { data: tenant, error: tenantErr } = await supabaseAdmin
      .from('tenants')
      .select('id, first_name, last_name, email, phone_number, phone, agency_id')
      .eq('id', tenantId)
      .single()

    if (tenantErr || !tenant) {
      return {
        success: false,
        error: tenantErr?.message || 'Tenant record not found.',
        message: 'Could not resolve tenant for Karibu VMS sync.',
      }
    }

    let groupName = 'Resident Directory'
    let groupExternalId = `agency_${tenant.agency_id}`
    let unitNumber = options?.unitNumber || ''

    // 2. Check if a propertyId was passed explicitly
    if (options?.propertyId) {
      const { data: prop } = await supabaseAdmin
        .from('properties')
        .select('id, name')
        .eq('id', options.propertyId)
        .single()

      if (prop) {
        groupName = prop.name
        groupExternalId = prop.id
      }
    } else {
      // 3. Look for an active lease for this tenant
      const { data: activeLease } = await supabaseAdmin
        .from('leases')
        .select(`
          id,
          unit_id,
          units (
            id,
            unit_number,
            property_id,
            properties (
              id,
              name
            )
          )
        `)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      const unitData = activeLease?.units as any
      if (unitData) {
        if (!unitNumber && unitData.unit_number) {
          unitNumber = unitData.unit_number
        }
        if (unitData.properties?.name && unitData.properties?.id) {
          groupName = unitData.properties.name
          groupExternalId = unitData.properties.id
        }
      } else {
        // Fallback to agency's primary property if available
        const { data: primaryProp } = await supabaseAdmin
          .from('properties')
          .select('id, name')
          .eq('agency_id', tenant.agency_id)
          .limit(1)
          .maybeSingle()

        if (primaryProp) {
          groupName = primaryProp.name
          groupExternalId = primaryProp.id
        } else {
          // Fallback to agency name
          const { data: agency } = await supabaseAdmin
            .from('agencies')
            .select('name')
            .eq('id', tenant.agency_id)
            .single()

          if (agency?.name) {
            groupName = `${agency.name} Residents`
          }
        }
      }
    }

    // 4. Ensure group exists in Karibu VMS
    const groupSync = await syncGroups([
      {
        name: groupName,
        external_id: groupExternalId,
      },
    ])

    if (!groupSync.success) {
      console.warn('[Karibu VMS] Group sync warning:', groupSync.error)
    }

    // 5. Construct display name and sync user
    const fullName = `${tenant.first_name || ''} ${tenant.last_name || ''}`.trim() || 'Resident'
    const displayName = unitNumber ? `${fullName} (Unit ${unitNumber})` : fullName
    const phone = tenant.phone_number || tenant.phone || ''

    const userPayload: KaribuUserInput = {
      name: displayName,
      external_id: tenant.id,
      group_external_id: groupExternalId,
      email: tenant.email || undefined,
      phone: phone || undefined,
    }

    const userSync = await syncUsers([userPayload])

    if (!userSync.success) {
      return {
        success: false,
        error: userSync.error || 'Failed to sync user to Karibu VMS.',
        message: userSync.error || 'Karibu VMS user sync failed.',
        details: userSync.errors,
      }
    }

    return {
      success: true,
      message: `Successfully synchronized ${fullName} to Karibu VMS under '${groupName}'.`,
      groupsCount: 1,
      usersCount: 1,
      details: userSync.data,
    }
  } catch (err: any) {
    console.error('[Karibu VMS] syncSingleTenantToKaribu unexpected error:', err)
    return {
      success: false,
      error: err?.message || 'Unexpected synchronization error.',
      message: 'Failed to complete synchronization with Karibu VMS.',
    }
  }
}

/**
 * Synchronize the entire directory (properties as groups, tenants as users) for an agency.
 */
export async function syncAgencyDirectoryToKaribu(agencyId: string): Promise<SyncResult> {
  try {
    const supabaseAdmin = getAdminClient()

    // 1. Fetch agency info
    const { data: agency } = await supabaseAdmin
      .from('agencies')
      .select('id, name')
      .eq('id', agencyId)
      .single()

    const agencyName = agency?.name || 'Property Agency'

    // 2. Fetch all properties for this agency
    const { data: properties } = await supabaseAdmin
      .from('properties')
      .select('id, name')
      .eq('agency_id', agencyId)

    const groupsToSync: KaribuGroupInput[] = []
    const propMap = new Map<string, string>()

    // Add properties as groups
    if (properties && properties.length > 0) {
      properties.forEach((p) => {
        propMap.set(p.id, p.name)
        groupsToSync.push({
          name: p.name,
          external_id: p.id,
        })
      })
    }

    // Always ensure a fallback agency directory group
    const fallbackGroupId = `agency_${agencyId}`
    groupsToSync.push({
      name: `${agencyName} Directory`,
      external_id: fallbackGroupId,
    })

    // Batch sync groups to Karibu VMS
    const groupSyncResult = await syncGroups(groupsToSync)
    if (!groupSyncResult.success) {
      console.warn('[Karibu VMS] Bulk group sync notice:', groupSyncResult.error)
    }

    // 3. Fetch active leases with unit and property mappings
    const { data: activeLeases } = await supabaseAdmin
      .from('leases')
      .select(`
        tenant_id,
        units (
          unit_number,
          property_id
        )
      `)
      .eq('agency_id', agencyId)
      .eq('is_active', true)

    const leaseMap = new Map<string, { unitNumber: string; propertyId: string }>()
    activeLeases?.forEach((l) => {
      const unit = l.units as any
      if (l.tenant_id && unit) {
        leaseMap.set(l.tenant_id, {
          unitNumber: unit.unit_number || '',
          propertyId: unit.property_id || '',
        })
      }
    })

    // 4. Fetch all tenants for this agency
    const { data: tenants, error: tenantsErr } = await supabaseAdmin
      .from('tenants')
      .select('id, first_name, last_name, email, phone_number, phone, is_active')
      .eq('agency_id', agencyId)

    if (tenantsErr) {
      return {
        success: false,
        error: tenantsErr.message,
        message: 'Failed to retrieve tenants for synchronization.',
      }
    }

    if (!tenants || tenants.length === 0) {
      return {
        success: true,
        message: `Synced ${groupsToSync.length} properties/groups to Karibu VMS. No tenant records found to sync.`,
        groupsCount: groupsToSync.length,
        usersCount: 0,
      }
    }

    // 5. Construct batch user payload
    const defaultPropId = properties?.[0]?.id || fallbackGroupId

    const usersToSync: KaribuUserInput[] = tenants.map((tenant) => {
      const lease = leaseMap.get(tenant.id)
      const unitNumber = lease?.unitNumber
      const propId = lease?.propertyId || defaultPropId

      const fullName = `${tenant.first_name || ''} ${tenant.last_name || ''}`.trim() || 'Resident'
      const displayName = unitNumber ? `${fullName} (Unit ${unitNumber})` : fullName
      const phone = tenant.phone_number || tenant.phone || ''

      return {
        name: displayName,
        external_id: tenant.id,
        group_external_id: propId,
        email: tenant.email || undefined,
        phone: phone || undefined,
      }
    })

    const userSyncResult = await syncUsers(usersToSync)

    const totalGroups = groupsToSync.length
    const totalUsers = usersToSync.length
    const createdUsers = userSyncResult.summary?.created ?? 0
    const updatedUsers = userSyncResult.summary?.updated ?? 0

    return {
      success: userSyncResult.success,
      message: userSyncResult.success
        ? `Successfully synced ${totalGroups} properties and ${totalUsers} tenants (${createdUsers} created, ${updatedUsers} updated) with Karibu VMS.`
        : (userSyncResult.error || 'User sync encountered issues.'),
      groupsCount: totalGroups,
      usersCount: totalUsers,
      details: {
        groups: groupSyncResult,
        users: userSyncResult,
      },
    }
  } catch (err: any) {
    console.error('[Karibu VMS] syncAgencyDirectoryToKaribu failed:', err)
    return {
      success: false,
      error: err?.message || 'Unexpected directory sync failure.',
      message: 'Failed to synchronize agency directory with Karibu VMS.',
    }
  }
}

/**
 * Remove a tenant from Karibu VMS (e.g. upon move-out or offboarding).
 */
export async function removeTenantFromKaribu(tenantId: string): Promise<SyncResult> {
  try {
    const res = await deleteUser(tenantId)
    return {
      success: res.success,
      message: res.message || `Tenant record (ID: ${tenantId}) removed from Karibu VMS.`,
      error: res.error,
    }
  } catch (err: any) {
    console.error('[Karibu VMS] removeTenantFromKaribu failed:', err)
    return {
      success: false,
      error: err?.message || 'Error deleting tenant from Karibu VMS.',
      message: 'Failed to remove tenant from Karibu VMS.',
    }
  }
}

