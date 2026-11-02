import { NextResponse } from 'next/server'
import { sendEmail } from '@/app/lib/notifications'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: Request): Promise<Response> {
  let body: { to: string; subject: string; message: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { to, subject, message } = body
  if (!to || !subject || !message) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const result = await sendEmail({
    to,
    subject,
    html: `<div style="font-family:sans-serif;color:#134E4A;padding:16px;"><pre style="white-space:pre-wrap;font-family:inherit;">${message}</pre></div>`,
    text: message,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true, messageId: result.messageId })
}
