// app/page.tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const routeUser = () => {
      // If the URL has the invite flag, send them to setup their password
      if (window.location.hash.includes('type=invite') || window.location.hash.includes('type=recovery')) {
        router.push('/update-password')
      } else {
        router.push('/dashboard')
      }
    }

    // 1. Immediately check if the token was already processed on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        routeUser()
      } else if (!window.location.hash.includes('access_token')) {
        // If there's no session and no token in the URL, they are logged out
        router.push('/login')
      }
    })

    // 2. Listen for the exact moment the token is processed
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
        routeUser()
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center animate-pulse">
        <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium tracking-wide">
          Verifying secure invitation...
        </p>
      </div>
    </div>
  )
}