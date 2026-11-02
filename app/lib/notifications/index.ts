import { Resend } from 'resend'
import AfricasTalking from 'africastalking'

const resendApiKey = process.env.RESEND_API_KEY
const emailFrom = process.env.EMAIL_FROM || 'noreply@luffitech.com'

const atApiKey = process.env.AFRICASTALKING_API_KEY
const atUsername = process.env.AFRICASTALKING_USERNAME || 'sandbox'
const atFrom = process.env.AFRICASTALKING_FROM

const resend = resendApiKey ? new Resend(resendApiKey) : null

let africastalking: any = null
if (atApiKey) {
  try {
    africastalking = AfricasTalking({ apiKey: atApiKey, username: atUsername })
  } catch {
    africastalking = null
  }
}

export interface EmailResult {
  success: boolean
  messageId: string | null
  error: string | null
}

export interface SmsResult {
  success: boolean
  messageId: string | null
  error: string | null
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string
  subject: string
  html?: string
  text?: string
}): Promise<EmailResult> {
  if (!resend) {
    return { success: false, messageId: null, error: 'RESEND_API_KEY not configured' }
  }

  try {
    const { data, error } = await (resend as any).emails.send({
      from: emailFrom,
      to,
      subject,
      html,
      text,
    })

    if (error) {
      return { success: false, messageId: null, error: error.message }
    }

    return { success: true, messageId: (data as any)?.id ?? null, error: null }
  } catch (err: any) {
    return { success: false, messageId: null, error: err?.message ?? 'Unknown email error' }
  }
}

export async function sendSms({
  to,
  message,
}: {
  to: string
  message: string
}): Promise<SmsResult> {
  if (!africastalking) {
    return { success: false, messageId: null, error: 'AFRICASTALKING_API_KEY not configured' }
  }

  try {
    const sms = africastalking.SMS
    const response = await sms.send({
      to: [to],
      message,
      from: atFrom,
    })

    const recipients = (response as any)?.SMSMessageData?.Recipients || []
    const first = recipients[0]

    if (first?.status === 'Success' || first?.statusCode === 101) {
      return { success: true, messageId: first?.messageId ?? null, error: null }
    }

    return {
      success: false,
      messageId: null,
      error: first?.errorMessage ?? 'SMS not delivered',
    }
  } catch (err: any) {
    return { success: false, messageId: null, error: err?.message ?? 'Unknown SMS error' }
  }
}
