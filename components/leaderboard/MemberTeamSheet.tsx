'use client'

import { useState, useEffect } from 'react'
import { X, Lock } from 'lucide-react'

interface Pick {
  holeNumber: number
  playerId: string
  playerName: string
  pricePaid: number
  scoreVsPar: number | null
  isPostman: boolean
}

interface Props {
  leagueId: string
  targetUserId: string
  displayName: string
  round: number
  onClose: () => void
}

function scoreLabel(s: number) {
  if (s === 0) return 'E'
  return s > 0 ? `+${s}` : `${s}`
}

function scoreColour(s: number) {
  if (s < 0) return 'text-[#4adb7a]'
  if (s > 0) return 'text-[#e05555]'
  return 'text-[#8ab89a]'
}

export default function MemberTeamSheet({ leagueId, targetUserId, displayName, round, onClose }: Props) {
  const [picks, setPicks] = useState<Pick[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/member-team?leagueId=${leagueId}&userId=${targetUserId}&round=${round}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setPicks(data.picks ?? [])
      })
      .catch(() => setError('Failed to load team'))
      .finally(() => setLoading(false))
  }, [leagueId, targetUserId, round])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] z-50 bg-[#0a1a10] rounded-t-2xl border-t border-[#1a3d2b]">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#2d5c3f]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a3d2b]">
          <div>
            <h2 className="text-sm font-bold text-white">{displayName}&apos;s team</h2>
            <p className="text-[10px] text-[#8ab89a]">Round {round} · Locked picks only</p>
          </div>
          <button onClick={onClose} className="text-[#5a7a65] active:opacity-60">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[60vh] pb-8">
          {loading ? (
            <div className="px-4 py-8 text-center text-[#5a7a65] text-sm">Loading…</div>
          ) : error ? (
            <div className="px-4 py-8 text-center text-[#e05555] text-sm">{error}</div>
          ) : picks.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Lock size={24} className="mx-auto mb-2 text-[#2d5c3f]" />
              <p className="text-sm text-[#8ab89a]">No locked picks yet</p>
              <p className="text-xs text-[#5a7a65] mt-1">Picks appear here once holes tee off</p>
            </div>
          ) : (
            <div className="divide-y divide-[#1a3d2b]">
              {picks.map((pick) => (
                <div key={pick.holeNumber} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-7 h-7 rounded-lg bg-[#1a3d2b] flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-[#8ab89a]">{pick.holeNumber}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {pick.playerName}
                      {pick.isPostman && (
                        <span className="ml-1.5 text-[10px] text-[#c9a227] font-bold">📬</span>
                      )}
                    </p>
                    <p className="text-[10px] text-[#5a7a65]">£{pick.pricePaid}m</p>
                  </div>
                  {pick.scoreVsPar !== null ? (
                    <span className={`font-score text-sm font-bold ${scoreColour(pick.scoreVsPar)}`}>
                      {scoreLabel(pick.scoreVsPar)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#5a7a65]">—</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
