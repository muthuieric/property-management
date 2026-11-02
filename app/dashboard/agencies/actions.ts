'use server'

import { createClient } from '@/utils/supabase/server'
import { getUserAgencyContext } from '@/utils/supabase/get-context'

export interface Agency {
  id: string
  name: string
}

export async function getAgencies(): Promise<Agency[]> {
  const { agencyId, role, isSuperAdmin } = await getUserAgencyContext()
  const supabase = await createClient()

  let query = supabase.from('agencies').select('id, name').order('name', { ascending: true })

  // Super admin sees all agencies; agency staff see only their own
  if (!isSuperAdmin && role !== 'super_admin' && agencyId) {
    query = query.eq('id', agencyId)
  }

  const { data, error } = await query

  if (error || !data) {
    console.error('getAgencies error:', error)
    return []
  }

  return data.map((a) => ({ id: a.id, name: a.name }))
}
