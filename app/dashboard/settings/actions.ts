// app/dashboard/settings/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'

export interface AgencySettings {
  agency_id: string
  require_expense_approval: boolean
  require_invoice_cancellation_approval: boolean
  enable_automated_billing: boolean
  updated_at?: string
}

export type AgencySettingKey =
  | 'require_expense_approval'
  | 'require_invoice_cancellation_approval'
  | 'enable_automated_billing'

const DEFAULT_SETTINGS: Omit<AgencySettings, 'agency_id'> = {
  require_expense_approval: true,
  require_invoice_cancellation_approval: true,
  enable_automated_billing: false,
}

/**
 * Retrieves global operational protocols and approval rules for the active agency.
 * Returns enterprise defaults if records have not yet been seeded.
 */
export async function getAgencySettings(): Promise<AgencySettings> {
  try {
    const supabase = await createClient()
    const { agencyId, role } = await getUserAgencyContext()

    const fallback: AgencySettings = {
      agency_id: agencyId,
      ...DEFAULT_SETTINGS,
    }

    if (role !== 'agency_owner') {
      return fallback
    }

    const { data, error } = await supabase
      .from('agency_settings')
      .select('*')
      .eq('agency_id', agencyId)
      .maybeSingle()

    if (error) {
      console.warn('Error fetching agency_settings (table may need migration):', error)
      return fallback
    }

    if (!data) {
      // Auto-initialize default settings row in database
      const { data: inserted, error: insertErr } = await supabase
        .from('agency_settings')
        .insert([{ agency_id: agencyId, ...DEFAULT_SETTINGS }])
        .select('*')
        .single()

      if (!insertErr && inserted) {
        return inserted as AgencySettings
      }
      return fallback
    }

    return data as AgencySettings
  } catch (err) {
    console.warn('getAgencySettings caught exception:', err)
    return {
      agency_id: '',
      ...DEFAULT_SETTINGS,
    }
  }
}

/**
 * Instantly updates an operational protocol toggle in public.agency_settings.
 * Restricted strictly to users with the 'agency_owner' role.
 */
export async function updateAgencySetting(
  key: AgencySettingKey,
  value: boolean
): Promise<{ success: boolean; error?: string; settings?: AgencySettings }> {
  try {
    const supabase = await createClient()
    const { agencyId, role } = await getUserAgencyContext()

    if (role !== 'agency_owner') {
      return {
        success: false,
        error: 'Unauthorized: Only Agency Owners can modify operational protocol settings.',
      }
    }

    const validKeys: AgencySettingKey[] = [
      'require_expense_approval',
      'require_invoice_cancellation_approval',
      'enable_automated_billing',
    ]

    if (!validKeys.includes(key)) {
      return { success: false, error: `Invalid setting key: ${key}` }
    }

    // Upsert into agency_settings table
    const { data, error } = await supabase
      .from('agency_settings')
      .upsert(
        {
          agency_id: agencyId,
          [key]: value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'agency_id' }
      )
      .select('*')
      .single()

    if (error) {
      console.error('Error updating agency setting:', error)
      return { success: false, error: error.message || 'Failed to update protocol setting.' }
    }

    revalidatePath('/dashboard/settings')
    revalidatePath('/dashboard/financials')
    revalidatePath('/dashboard/maintenance')
    revalidatePath('/dashboard')

    return {
      success: true,
      settings: data as AgencySettings,
    }
  } catch (err: any) {
    console.error('updateAgencySetting error:', err)
    return {
      success: false,
      error: err?.message || 'An unexpected error occurred while updating settings.',
    }
  }
}

