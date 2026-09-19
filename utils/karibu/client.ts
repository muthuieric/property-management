// utils/karibu/client.ts

export interface KaribuGroupInput {
  name: string
  external_id: string
}

export interface KaribuUserInput {
  name: string
  external_id: string
  group_external_id: string
  email?: string
  phone?: string
}

export interface KaribuSyncSummary {
  total: number
  created: number
  updated: number
  failed: number
}

export interface KaribuSyncResult<T = any> {
  success: boolean
  summary?: KaribuSyncSummary
  data?: T[]
  errors?: Array<{ external_id?: string; error: string }>
  error?: string
  message?: string
}

function getKaribuConfig() {
  const rawUrl = process.env.KARIBU_VMS_URL?.trim()
  let baseUrl = 'https://www.karibuvms.com'

  if (rawUrl && !rawUrl.includes('your-karibu-domain.com')) {
    baseUrl = rawUrl.replace(/\/+$/, '')
  }

  // Ensure https://www.karibuvms.com is used rather than apex to avoid 307 redirects
  if (baseUrl === 'https://karibuvms.com' || baseUrl === 'http://karibuvms.com') {
    baseUrl = 'https://www.karibuvms.com'
  }

  const apiKey = process.env.KARIBU_VMS_API_KEY?.trim() || ''

  return { baseUrl, apiKey }
}

export async function sendKaribuRequest<T = any>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE' | 'PUT'
    body?: any
    params?: Record<string, string>
  } = {}
): Promise<KaribuSyncResult<T>> {
  const { baseUrl, apiKey } = getKaribuConfig()

  if (!apiKey) {
    return {
      success: false,
      error: 'Missing KARIBU_VMS_API_KEY in environment configuration.',
    }
  }

  let url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`

  if (options.params) {
    const searchParams = new URLSearchParams(options.params)
    url += `?${searchParams.toString()}`
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
  }

  let body: string | undefined
  if (options.body) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }

  try {
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body,
      redirect: 'follow',
      cache: 'no-store',
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      const errorMsg = data?.error || data?.message || `Karibu VMS API returned HTTP ${res.status}: ${res.statusText}`
      return {
        success: false,
        error: errorMsg,
        errors: data?.errors,
      }
    }

    return {
      success: true,
      summary: data?.summary,
      data: data?.data,
      message: data?.message,
    }
  } catch (err: any) {
    console.error(`[Karibu VMS] Request to ${path} failed:`, err)
    return {
      success: false,
      error: err?.message || 'Network error communicating with Karibu VMS.',
    }
  }
}

/**
 * Batch sync groups (properties, buildings, or house numbers)
 */
export async function syncGroups(groups: KaribuGroupInput[]): Promise<KaribuSyncResult> {
  if (!groups || groups.length === 0) {
    return { success: true, summary: { total: 0, created: 0, updated: 0, failed: 0 }, data: [] }
  }

  return sendKaribuRequest('/api/v1/sync/groups', {
    method: 'POST',
    body: { groups },
  })
}

/**
 * Batch sync users (hosts, tenants, or residents)
 */
export async function syncUsers(users: KaribuUserInput[]): Promise<KaribuSyncResult> {
  if (!users || users.length === 0) {
    return { success: true, summary: { total: 0, created: 0, updated: 0, failed: 0 }, data: [] }
  }

  return sendKaribuRequest('/api/v1/sync/users', {
    method: 'POST',
    body: { users },
  })
}

/**
 * Delete a user from Karibu VMS by external_id
 */
export async function deleteUser(externalId: string): Promise<KaribuSyncResult> {
  if (!externalId) {
    return { success: false, error: 'External ID is required to remove user.' }
  }

  return sendKaribuRequest('/api/v1/sync/users', {
    method: 'DELETE',
    params: { external_id: externalId },
  })
}

/**
 * Delete a group from Karibu VMS by external_id
 */
export async function deleteGroup(externalId: string): Promise<KaribuSyncResult> {
  if (!externalId) {
    return { success: false, error: 'External ID is required to remove group.' }
  }

  return sendKaribuRequest('/api/v1/sync/groups', {
    method: 'DELETE',
    params: { external_id: externalId },
  })
}

/**
 * Retrieve all synced groups from Karibu VMS
 */
export async function getGroups(): Promise<KaribuSyncResult> {
  return sendKaribuRequest('/api/v1/sync/groups', {
    method: 'GET',
  })
}

/**
 * Retrieve all synced users from Karibu VMS
 */
export async function getUsers(): Promise<KaribuSyncResult> {
  return sendKaribuRequest('/api/v1/sync/users', {
    method: 'GET',
  })
}

/**
 * Test connectivity with Karibu VMS
 */
export async function testConnection(): Promise<{ ok: boolean; message: string; details?: any }> {
  const { baseUrl, apiKey } = getKaribuConfig()
  if (!apiKey) {
    return { ok: false, message: 'KARIBU_VMS_API_KEY is not configured.' }
  }

  const result = await getGroups()
  if (result.success) {
    return {
      ok: true,
      message: `Connected to Karibu VMS (${baseUrl}). Found ${result.data?.length ?? 0} active groups.`,
      details: result.data,
    }
  }

  return {
    ok: false,
    message: result.error || 'Failed to authenticate with Karibu VMS.',
  }
}

