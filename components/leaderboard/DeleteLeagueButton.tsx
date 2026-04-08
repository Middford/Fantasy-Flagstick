'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

interface Props {
  leagueId: string
  leagueName: string
}

export default function DeleteLeagueButton({ leagueId, leagueName }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setLoading(true)
    setError('')
    const res = await fetch('/api/delete-league', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leagueId }),
    })
    const data = await res.json()
    if (data.error) {
      setError(data.error)
      setLoading(false)
      setConfirming(false)
    } else {
      router.push('/league')
      router.refresh()
    }
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-3 px-4 py-4 bg-[#1a0a0a] border-t border-[#5c2d2d]">
        <p className="text-sm font-semibold text-white text-center">Delete &ldquo;{leagueName}&rdquo;?</p>
        <p className="text-xs text-[#e05555] text-center">This cannot be undone. All members and picks will be removed.</p>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirming(false)}
            disabled={loading}
            className="flex-1 bg-[#1a3d2b] border border-[#2d5c3f] text-white font-bold rounded-xl py-3 text-sm active:scale-95 transition-transform disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 bg-[#e05555] text-white font-bold rounded-xl py-3 text-sm active:scale-95 transition-transform disabled:opacity-50"
          >
            {loading ? 'Deleting…' : 'Yes, delete'}
          </button>
        </div>
        {error && <p className="text-[#e05555] text-xs text-center">{error}</p>}
      </div>
    )
  }

  return (
    <div className="px-4 py-4 border-t border-[#1a3d2b]">
      <button
        onClick={() => setConfirming(true)}
        className="flex items-center gap-2 text-[#e05555] text-sm font-medium active:opacity-60"
      >
        <Trash2 size={15} />
        Delete league
      </button>
    </div>
  )
}
