import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import BottomNav from '@/components/ui/BottomNav'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 overflow-auto pb-20">{children}</main>
      <BottomNav />
    </div>
  )
}
