'use client'

import { useState } from 'react'
import type { Trophy } from '@/lib/supabase/types'

interface Season { key: string; name: string; emoji: string }
interface MajorTrophy { id: string; name: string; detail: string; emoji: string }

interface Props {
  seasons: Season[]
  majorTrophies: MajorTrophy[]
  earnedTypes: string[]
  leagueTrophies: Trophy[]
  majorsPlayed: number
}

export default function ProfileTabs({ seasons, majorTrophies, earnedTypes, leagueTrophies, majorsPlayed }: Props) {
  const [tab, setTab] = useState<'season' | 'cabinet' | 'rules'>('season')
  const earned = new Set(earnedTypes)

  return (
    <div className="flex flex-col">
      {/* Tab bar */}
      <div className="flex border-b border-[#1a3d2b]">
        {(['season', 'cabinet', 'rules'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-xs font-semibold transition-colors
              ${tab === t ? 'text-[#c9a227] border-b-2 border-[#c9a227]' : 'text-[#5a7a65]'}`}
          >
            {t === 'season' ? '📅 Season' : t === 'cabinet' ? '🏆 Cabinet' : '📖 Rules'}
          </button>
        ))}
      </div>

      {/* Season tab */}
      {tab === 'season' && (
        <div className="flex flex-col">
          <div className="px-4 py-4 border-b border-[#1a3d2b]">
            <h2 className="text-sm font-bold text-[#8ab89a] uppercase tracking-wide mb-3">2026 Season</h2>
            <div className="grid grid-cols-4 gap-2">
              {seasons.map((s) => (
                <div key={s.key} className="bg-[#1a3d2b] rounded-xl p-3 text-center">
                  <div className="text-xl mb-1">{s.emoji}</div>
                  <div className="text-sm font-score font-bold text-white">—</div>
                  <div className="text-[9px] text-[#8ab89a] mt-0.5">{s.name}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="px-4 py-4">
            <div className="bg-[#1a3d2b] rounded-xl p-4 text-center border border-[#2d5c3f]">
              <p className="text-[#8ab89a] text-sm">Masters Round 1</p>
              <p className="text-2xl font-bold text-[#c9a227] mt-1">Thursday 10 April</p>
              <p className="text-[#8ab89a] text-sm mt-0.5">14:00 BST · Augusta National</p>
            </div>
          </div>
        </div>
      )}

      {/* Cabinet tab */}
      {tab === 'cabinet' && (
        <div className="flex flex-col">
          {/* Major trophies */}
          <div className="px-4 py-4 border-b border-[#1a3d2b]">
            <h2 className="text-sm font-bold text-[#8ab89a] uppercase tracking-wide mb-3">Major Titles</h2>
            <div className="grid grid-cols-5 gap-2">
              {majorTrophies.map((trophy) => {
                const isEarned = earned.has(trophy.id)
                return (
                  <div
                    key={trophy.id}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border
                      ${isEarned ? 'border-[#c9a227] bg-[#1a3d2b]' : 'border-[#1a3d2b] bg-[#0a1a10] opacity-30'}`}
                  >
                    <span className="text-2xl">{trophy.emoji}</span>
                    <span className="text-[9px] text-center text-[#8ab89a] leading-tight">{trophy.name}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* League trophies */}
          <div className="px-4 py-4">
            <h2 className="text-sm font-bold text-[#8ab89a] uppercase tracking-wide mb-3">
              League Trophies ({leagueTrophies.length})
            </h2>
            {leagueTrophies.length === 0 ? (
              <p className="text-sm text-[#5a7a65]">
                Win your league to earn a trophy. Masters Round 1 is Thursday.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {leagueTrophies.map((trophy) => (
                  <div key={trophy.id} className="bg-[#1a3d2b] border border-[#c9a227] rounded-xl p-3">
                    <div className="text-2xl mb-1">🏆</div>
                    <p className="text-xs font-bold text-[#c9a227]">{trophy.name}</p>
                    <p className="text-[10px] text-[#8ab89a] mt-0.5">{trophy.detail}</p>
                    <p className="text-[10px] text-[#5a7a65] mt-1">{trophy.year}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rules tab */}
      {tab === 'rules' && (
        <div className="flex flex-col divide-y divide-[#1a3d2b] pb-24">
          <div className="px-4 py-4">
            <h3 className="text-xs font-bold text-[#c9a227] uppercase tracking-wide mb-2">🎯 Objective</h3>
            <p className="text-sm text-[#8ab89a] leading-relaxed">
              Pick one golfer per hole, per round. Your score is the sum of your players&apos; scores on each hole.
              Lowest score wins — just like real golf.
            </p>
          </div>

          <div className="px-4 py-4">
            <h3 className="text-xs font-bold text-[#c9a227] uppercase tracking-wide mb-2">💷 Budget</h3>
            <p className="text-sm text-[#8ab89a] leading-relaxed mb-2">
              You have <span className="text-white font-bold">£180m</span> to spend per round across 18 holes.
              Player prices range from <span className="text-white font-bold">£4m</span> to <span className="text-white font-bold">£15m</span>.
            </p>
            <p className="text-sm text-[#8ab89a] leading-relaxed">
              Same player max <span className="text-white font-bold">3 times</span> per round. Prices shift between rounds based on form.
            </p>
          </div>

          <div className="px-4 py-4">
            <h3 className="text-xs font-bold text-[#c9a227] uppercase tracking-wide mb-2">⛳ Scoring</h3>
            <div className="space-y-1.5 text-sm">
              {[
                { label: 'Eagle (or better)', score: '−2', colour: 'text-[#4adb7a]' },
                { label: 'Birdie', score: '−1', colour: 'text-[#4adb7a]' },
                { label: 'Par', score: 'E', colour: 'text-white' },
                { label: 'Bogey', score: '+1', colour: 'text-[#e05555]' },
                { label: 'Double+ (or worse)', score: '+2', colour: 'text-[#e05555]' },
              ].map(({ label, score, colour }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[#8ab89a]">{label}</span>
                  <span className={`font-score font-bold ${colour}`}>{score}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="px-4 py-4">
            <h3 className="text-xs font-bold text-[#c9a227] uppercase tracking-wide mb-3">🃏 Chips</h3>
            <p className="text-[11px] text-[#5a7a65] mb-3">One of each per tournament. Cannot be undone.</p>
            <div className="space-y-3">
              {[
                { emoji: '🏆', name: 'Sponsorship Deal', colour: 'text-[#c9a227]', desc: 'Adds £20m to your budget for one round.' },
                { emoji: '📮', name: 'Postman', colour: 'text-[#d63030]', desc: 'Doubles one player\'s score on every hole you pick them this round. Birdies become −2, bogeys become +2.' },
                { emoji: '🔄', name: 'Mulligan', colour: 'text-[#20a090]', desc: 'Swap one locked pick for a different player who hasn\'t completed that hole yet.' },
              ].map(({ emoji, name, colour, desc }) => (
                <div key={name} className="bg-[#1a3d2b] rounded-xl p-3 flex items-start gap-3">
                  <span className="text-2xl">{emoji}</span>
                  <div>
                    <p className={`text-sm font-bold ${colour}`}>{name}</p>
                    <p className="text-[11px] text-[#8ab89a] leading-snug mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="px-4 py-4">
            <h3 className="text-xs font-bold text-[#c9a227] uppercase tracking-wide mb-2">🔒 Locking &amp; Swapping</h3>
            <p className="text-sm text-[#8ab89a] leading-relaxed mb-2">
              You can swap your pick for any hole freely <span className="text-white font-bold">until your chosen player completes that hole</span>. The moment they finish, the pick locks automatically.
            </p>
            <p className="text-sm text-[#8ab89a] leading-relaxed mb-2">
              If your player is still selected when they <span className="text-white font-bold">tee off on the next hole</span>, they lock immediately for that hole too — even before they finish it.
            </p>
            <p className="text-sm text-[#8ab89a] leading-relaxed">
              Only the <span className="text-[#20a090] font-bold">🔄 Mulligan</span> chip can change a locked pick.
            </p>
          </div>

          <div className="px-4 py-4">
            <h3 className="text-xs font-bold text-[#c9a227] uppercase tracking-wide mb-2">🥇 Winning</h3>
            <p className="text-sm text-[#8ab89a] leading-relaxed mb-2">
              Lowest combined score across all four rounds wins.
            </p>
            <p className="text-xs font-bold text-[#8ab89a] uppercase tracking-wide mb-1.5">Tiebreaker (in order)</p>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-[#4adb7a] font-bold w-5">1.</span>
                <span className="text-[#8ab89a]">Most eagles scored</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#4adb7a] font-bold w-5">2.</span>
                <span className="text-[#8ab89a]">Most birdies scored</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#c9a227] font-bold w-5">3.</span>
                <span className="text-[#8ab89a]">Highest total value gain from player price rises</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
