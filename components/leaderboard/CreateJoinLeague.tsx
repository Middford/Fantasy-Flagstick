'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Check } from 'lucide-react'

interface Props {
  tournamentId: string
  userId: string
}

export default function CreateJoinLeague({ tournamentId, userId }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'idle' | 'create' | 'created' | 'join' | 'joined'>('idle')
  const [leagueName, setLeagueName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [createdCode, setCreatedCode] = useState('')
  const [createdName, setCreatedName] = useState('')
  const [joinedName, setJoinedName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleCreate() {
    if (!leagueName.trim()) return
    setLoading(true)
    setError('')
    const res = await fetch('/api/create-league', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: leagueName.trim(), tournamentId }),
    })
    const data = await res.json()
    if (data.error) {
      setError(data.error)
    } else {
      setCreatedCode(data.league.code)
      setCreatedName(data.league.name)
      setMode('created')
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
      body: JSON.stringify({ code: joinCode.toUpperCase().trim(), tournamentId }),
    })
    const data = await res.json()
    if (data.error) {
      setError(data.error)
    } else {
      setJoinedName(data.league.name)
      setMode('joined')
      setTimeout(() => router.refresh(), 1200)
    }
    setLoading(false)
  }

  function copyCode() {
    navigator.clipboard.writeText(createdCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function reset() {
    setMode('idle')
    setLeagueName('')
    setJoinCode('')
    setError('')
    setCopied(false)
  }

  // ── Idle: two big buttons ─────────────────────────────────────────────────
  if (mode === 'idle') {
    return (
      <div className="flex flex-col gap-3 px-4 py-5">
        <p className="text-sm font-semibold text-[#8ab89a]">Play with friends</p>
        <button
          onClick={() => setMode('create')}
          className="w-full bg-[#c9a227] text-[#0a1a10] font-bold rounded-xl py-4 text-sm active:scale-95 transition-transform"
        >
          + Create a League
        </button>
        <button
          onClick={() => setMode('join')}
          className="w-full bg-[#1a3d2b] border border-[#2d5c3f] text-white font-bold rounded-xl py-4 text-sm active:scale-95 transition-transform"
        >
          🔗 Join a League
        </button>
      </div>
    )
  }

  // ── Created: show code prominently ────────────────────────────────────────
  if (mode === 'created') {
    return (
      <div className="flex flex-col gap-4 px-4 py-5">
        <div className="text-center">
          <div className="text-2xl mb-1">🏆</div>
          <h2 className="text-base font-bold text-white">{createdName}</h2>
          <p className="text-xs text-[#8ab89a] mt-0.5">Your league is ready</p>
        </div>

        {/* Code display */}
        <div className="bg-[#0a1a10] border-2 border-[#c9a227] rounded-2xl p-5 text-center">
          <p className="text-[11px] text-[#8ab89a] uppercase tracking-widest mb-2">Invite Code</p>
          <div className="text-4xl font-bold text-[#c9a227] tracking-widest font-score">
            {createdCode}
          </div>
          <p className="text-[11px] text-[#5a7a65] mt-2">Share this with your friends</p>
        </div>

        {/* Copy button */}
        <button
          onClick={copyCode}
          className={`flex items-center justify-center gap-2 w-full rounded-xl py-3.5 text-sm font-bold transition-all
            ${copied
              ? 'bg-[#4adb7a] text-[#0a1a10]'
              : 'bg-[#1a3d2b] border border-[#2d5c3f] text-white active:scale-95'
            }`}
        >
          {copied ? (
            <><Check size={16} /> Copied!</>
          ) : (
            <><Copy size={16} /> Copy Code</>
          )}
        </button>

        <button
          onClick={() => router.refresh()}
          className="w-full bg-[#c9a227] text-[#0a1a10] font-bold rounded-xl py-3.5 text-sm active:scale-95 transition-transform"
        >
          Go to League
        </button>
      </div>
    )
  }

  // ── Joined: brief success ─────────────────────────────────────────────────
  if (mode === 'joined') {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
        <div className="text-3xl">✅</div>
        <p className="text-base font-bold text-white">Joined!</p>
        <p className="text-sm text-[#8ab89a]">{joinedName}</p>
      </div>
    )
  }

  // ── Create / Join forms ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3 px-4 py-5">
      <button onClick={reset} className="text-[#8ab89a] text-sm text-left">
        ← Back
      </button>

      {mode === 'create' && (
        <>
          <p className="text-sm font-semibold text-white">Name your league</p>
          <input
            type="text"
            placeholder="e.g. The Middleton Cup"
            value={leagueName}
            onChange={(e) => setLeagueName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
            className="w-full bg-[#1a3d2b] border border-[#2d5c3f] rounded-xl px-4 py-3 text-white text-sm placeholder-[#5a7a65] outline-none focus:border-[#c9a227]"
            maxLength={50}
          />
          <button
            onClick={handleCreate}
            disabled={loading || !leagueName.trim()}
            className="w-full bg-[#c9a227] text-[#0a1a10] font-bold rounded-xl py-3.5 text-sm disabled:opacity-50 active:scale-95 transition-transform"
          >
            {loading ? 'Creating...' : 'Create League'}
          </button>
        </>
      )}

      {mode === 'join' && (
        <>
          <p className="text-sm font-semibold text-white">Enter invite code</p>
          <input
            type="text"
            placeholder="e.g. AUG26XY"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            autoFocus
            className="w-full bg-[#1a3d2b] border border-[#2d5c3f] rounded-xl px-4 py-3 text-white text-sm placeholder-[#5a7a65] outline-none focus:border-[#c9a227] uppercase tracking-widest text-center text-lg font-bold"
            maxLength={8}
          />
          <button
            onClick={handleJoin}
            disabled={loading || !joinCode.trim()}
            className="w-full bg-[#c9a227] text-[#0a1a10] font-bold rounded-xl py-3.5 text-sm disabled:opacity-50 active:scale-95 transition-transform"
          >
            {loading ? 'Joining...' : 'Join League'}
          </button>
        </>
      )}

      {error && <p className="text-[#e05555] text-sm text-center">{error}</p>}
    </div>
  )
}
