import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { sendSms } from '@/app/lib/notifications'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface BulkSmsRecipient {
  to: string
  message: string
}

interface BulkSmsBody {
  recipients: BulkSmsRecipient[]
  message?: string // fallback message applied to recipients without their own message
}

export async function POST(req: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: BulkSmsBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { recipients, message: fallbackMessage } = body
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return NextResponse.json({ error: 'recipients must be a non-empty array' }, { status: 400 })
  }

  const results: Array<{ to: string; success: boolean; messageId: string | null; error: string | null }> = []
  let sent = 0
  let failed = 0

  // Africa's Talking supports bulk sends; chunk to stay well within limits
  const CHUNK = 200
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const chunk = recipients.slice(i, i + CHUNK)

    await Promise.all(
      chunk.map(async (r) => {
        const message = r.message || fallbackMessage || ''
        if (!message) {
          failed++
          results.push({ to: r.to, success: false, messageId: null, error: 'No message provided' })
          return
        }

        const res = await sendSms({ to: r.to, message })
        if (res.success) {
          sent++
          results.push({ to: r.to, success: true, messageId: res.messageId, error: null })
        } else {
          failed++
          results.push({ to: r.to, success: false, messageId: null, error: res.error })
        }
      })
    )
  }

  return NextResponse.json({
    success: failed === 0,
    total: recipients.length,
    sent,
    failed,
    results,
  })
}
