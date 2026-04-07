'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Flag, Trophy, User } from 'lucide-react'

const tabs = [
  { href: '/',         label: 'Home',    Icon: Home },
  { href: '/picks',    label: 'Picks',   Icon: Flag },
  { href: '/league',   label: 'League',  Icon: Trophy },
  { href: '/profile',  label: 'Profile', Icon: User },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px]
                 bg-[#0a1a10] border-t border-[#1a3d2b] safe-bottom z-50"
    >
      <div className="flex items-center justify-around py-2">
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors
                         ${active ? 'text-[#c9a227]' : 'text-[#5a7a65]'}`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
