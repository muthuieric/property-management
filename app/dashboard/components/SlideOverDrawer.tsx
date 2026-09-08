'use client'

import { useEffect, useRef } from 'react'

interface SlideOverDrawerProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  maxWidth?: string // e.g. 'max-w-lg'
}

export default function SlideOverDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'max-w-lg',
}: SlideOverDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      // Prevent body scroll when drawer is open
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
      {/* Dark, semi-transparent backdrop overlay */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        {/* Right-Side Slide-Over Drawer panel */}
        <div
          ref={drawerRef}
          className={`w-screen ${maxWidth} bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out animate-in slide-in-from-right`}
        >
          {/* Header: Crisp white header with title and subtle X close button */}
          <div className="bg-white border-b border-slate-200 px-6 py-5 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs text-slate-500 mt-0.5 leading-normal">
                  {subtitle}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-all duration-200 ease-in-out focus:outline-none"
              aria-label="Close drawer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body: Subtle bg-slate-50 background */}
          <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
            {children}
          </div>

          {/* Footer: Fixed footer at the bottom of the drawer */}
          {footer && (
            <div className="bg-white border-t border-slate-200 p-4 flex items-center justify-end gap-3 shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
