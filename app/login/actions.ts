// app/login/actions.ts
'use server'

import { login as authLogin, sendMagicLink } from '@/app/auth/actions'

export async function login(formData: FormData) {
  return await authLogin(formData)
}

export async function magicLink(formData: FormData) {
  return await sendMagicLink(formData)
}