import { NextResponse } from 'next/server'
import { sendSms } from '@/app/lib/notifications'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: Request): Promise<Response> {
  let body: { to: string; message: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { to, message } = body
  if (!to || !message) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const result = await sendSms({ to, message })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true, messageId: result.messageId })
}
