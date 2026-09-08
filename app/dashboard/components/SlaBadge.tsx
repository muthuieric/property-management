// app/dashboard/components/SlaBadge.tsx
'use client'

import { useState, useEffect } from 'react'

interface SlaBadgeProps {
  createdAt: string
  slaHours?: number
  className?: string
}

export default function SlaBadge({
  createdAt,
  slaHours = 48,
  className = '',
}: SlaBadgeProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Initial calculation based on server render time vs client time
  const createdTime = new Date(createdAt).getTime()
  const currentTime = mounted ? Date.now() : createdTime
  const diffHours = Math.max(0, Math.floor((currentTime - createdTime) / (1000 * 60 * 60)))
  const isBreach = diffHours >= slaHours
  const hoursLeft = Math.max(0, slaHours - diffHours)

  if (!mounted) {
    // Stable server-rendered fallback matching standard 48h SLA window
    return (
      <span
        suppressHydrationWarning
        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 shrink-0 ${className}`}
      >
        ⏱️ 48h SLA Window
      </span>
    )
  }

  if (isBreach) {
    return (
      <span
        suppressHydrationWarning
        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-red-600 text-white animate-pulse shrink-0 ${className}`}
      >
        🚨 SLA Breach ({diffHours}h)
      </span>
    )
  }

  return (
    <span
      suppressHydrationWarning
      className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 shrink-0 ${className}`}
    >
      ⏱️ {hoursLeft}h SLA left
    </span>
  )
}
