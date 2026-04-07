import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a1a10]">
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-[#c9a227] font-serif">Fantasy Flagstick</h1>
          <p className="text-[#8ab89a] mt-1">Hole-by-hole fantasy golf for the majors</p>
        </div>
        <SignIn
          appearance={{
            variables: {
              colorPrimary: '#c9a227',
              colorBackground: '#1a3d2b',
              colorText: '#ffffff',
              colorTextSecondary: '#8ab89a',
              colorInputBackground: '#0a1a10',
              colorInputText: '#ffffff',
              borderRadius: '8px',
            },
          }}
        />
      </div>
    </div>
  )
}
