import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata: Metadata = {
  title: 'Fantasy Flagstick',
  description: 'Hole-by-hole fantasy golf for the majors',
  manifest: '/manifest.json',
  themeColor: '#c9a227',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Flagstick',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full">
        <body className="min-h-full bg-[#0a1a10] text-white antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
