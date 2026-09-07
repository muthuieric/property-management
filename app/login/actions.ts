// app/login/actions.ts
'use server'

import { login as authLogin } from '@/app/auth/actions'

export async function login(formData: FormData) {
  return await authLogin(formData)
}