'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  tournamentId: string
  userId: string
}

export default function CreateJoinLeague({ tournamentId, userId }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'idle' | 'create' | 'join'>('idle')
  const [leagueName, setLeagueName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!leagueName.trim()) return
    setLoading(true)
    setError('')
    const res = await fetch('/api/create-league', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: leagueName, tournamentId }),
    })
    const data = await res.json()
    if (data.error) {
      setError(data.error)
    } else {
      router.refresh()
    }
    setLoading(false)
  }

  async function handleJoin() {
    if (!joinCode.trim()) return
    setLoading(true)
    setError('')
    const res = await fetch('/api/join-league', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: joinCode.toUpperCase(), tournamentId }),
    })
    const data = await res.json()
    if (data.error) {
      setError(data.error)
    } else {
      router.refresh()
    }
    setLoading(false)
  }

  if (mode === 'idle') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-[#8ab89a]">Play with friends</p>
        <div className="flex gap-3">
          <button
            onClick={() => setMode('create')}
            className="flex-1 bg-[#1a3d2b] border border-[#2d5c3f] rounded-xl py-3 text-sm font-bold text-white"
          >
            + Create League
          </button>
          <button
            onClick={() => setMode('join')}
            className="flex-1 bg-[#1a3d2b] border border-[#2d5c3f] rounded-xl py-3 text-sm font-bold text-white"
          >
            🔗 Join League
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <button onClick={() => { setMode('idle'); setError('') }} className="text-[#8ab89a] text-sm text-left">
        ← Back
      </button>

      {mode === 'create' && (
        <>
          <input
            type="text"
            placeholder="League name (e.g. The Middleton Cup)"
            value={leagueName}
            onChange={(e) => setLeagueName(e.target.value)}
            className="w-full bg-[#1a3d2b] border border-[#2d5c3f] rounded-xl px-4 py-3 text-white text-sm placeholder-[#5a7a65] outline-none focus:border-[#c9a227]"
            maxLength={50}
          />
          <button
            onClick={handleCreate}
            disabled={loading || !leagueName.trim()}
            className="w-full bg-[#c9a227] text-[#0a1a10] font-bold rounded-xl py-3 text-sm disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create League'}
          </button>
        </>
      )}

      {mode === 'join' && (
        <>
          <input
            type="text"
            placeholder="Enter league code (e.g. AUG26)"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            className="w-full bg-[#1a3d2b] border border-[#2d5c3f] rounded-xl px-4 py-3 text-white text-sm placeholder-[#5a7a65] outline-none focus:border-[#c9a227] uppercase"
            maxLength={8}
          />
          <button
            onClick={handleJoin}
            disabled={loading || !joinCode.trim()}
            className="w-full bg-[#c9a227] text-[#0a1a10] font-bold rounded-xl py-3 text-sm disabled:opacity-50"
          >
            {loading ? 'Joining...' : 'Join League'}
          </button>
        </>
      )}

      {error && <p className="text-[#e05555] text-sm">{error}</p>}
    </div>
  )
}
