'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  name: string
  href: string
  icon: (props: { className?: string }) => React.ReactNode
  badge?: string
  exact?: boolean
  ownerOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  {
    name: 'Overview',
    href: '/dashboard',
    exact: true,
    icon: ({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    name: 'Properties',
    href: '/dashboard/properties',
    icon: ({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.75a1.5 1.5 0 011.5-1.5h1.5a1.5 1.5 0 011.5 1.5V21" />
      </svg>
    ),
  },
  {
    name: 'Tenants',
    href: '/dashboard/tenants',
    icon: ({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    name: 'Maintenance',
    href: '/dashboard/maintenance',
    icon: ({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233l2.846-2.846a3.75 3.75 0 00-5.304-5.304l-2.846 2.846m0 0a3.75 3.75 0 00-.918 3.652l-3.324 3.324" />
      </svg>
    ),
  },
  {
    name: 'Financials',
    href: '/dashboard/financials',
    ownerOnly: true,
    icon: ({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6H2.25m0 0v10.5m0-10.5h10.5m-10.5 0a.75.75 0 01.75-.75h.75m10.5 0h.75a.75.75 0 01.75.75v.75m0 0H6m10.5 0v10.5m0 0H6m10.5 0a.75.75 0 01-.75.75H15m-9 0H5.25A.75.75 0 014.5 16.5V6" />
      </svg>
    ),
  },
  {
    name: 'Deposit Ledger',
    href: '/dashboard/deposits',
    badge: 'Trust',
    ownerOnly: true,
    icon: ({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    name: 'Utilities & Move-Out',
    href: '/dashboard/clearance',
    ownerOnly: true,
    icon: ({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.09 1.976 1.052 1.976 2.187V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.25c0-1.135.845-2.098 1.976-2.188.374-.03.748-.057 1.124-.08" />
      </svg>
    ),
  },
  {
    name: 'Team Management',
    href: '/dashboard/team',
    ownerOnly: true,
    icon: ({ className }) => (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
]

interface DashboardSidebarNavProps {
  onNavigate?: () => void
  userRole?: string
}

export default function DashboardSidebarNav({ onNavigate, userRole }: DashboardSidebarNavProps) {
  const pathname = usePathname()

  const isLinkActive = (item: NavItem) => {
    if (item.exact) {
      return pathname === item.href
    }
    return pathname.startsWith(item.href)
  }

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.ownerOnly || userRole === 'agency_owner'
  )

  return (
    <nav className="flex flex-col space-y-1 px-3 py-4">
      <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
        Navigation
      </div>
      {visibleItems.map((item) => {
        const active = isLinkActive(item)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 ${
              active
                ? 'bg-emerald-500/10 text-white font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-emerald-500/10'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`transition-colors duration-150 ${
                  active
                    ? 'text-emerald-400'
                    : 'text-slate-400 group-hover:text-emerald-400'
                }`}
              >
                {item.icon({ className: 'w-4 h-4 shrink-0' })}
              </span>
              <span className="truncate">{item.name}</span>
            </div>

            {item.badge ? (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider ${
                  active
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-slate-800 text-slate-400 group-hover:bg-emerald-500/10 group-hover:text-emerald-400'
                }`}
              >
                {item.badge}
              </span>
            ) : active ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
