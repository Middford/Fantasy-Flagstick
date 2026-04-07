'use client'

export type DramaItem = {
  id: string
  type: 'eagle' | 'water' | 'birdie_run' | 'postman_fires' | 'mulligan_used' | 'lead_change' | 'price_spike' | 'budget_tight'
  message: string
  timestamp: string
}

const typeIcon: Record<DramaItem['type'], string> = {
  eagle: '🦅',
  water: '🌊',
  birdie_run: '🔥',
  postman_fires: '📮',
  mulligan_used: '🔄',
  lead_change: '🏆',
  price_spike: '📈',
  budget_tight: '⚠️',
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

export default function DramaFeed({ items }: { items: DramaItem[] }) {
  if (items.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-[#5a7a65] text-sm">
        Drama feed updates live as holes complete ⛳
      </div>
    )
  }

  return (
    <div className="flex flex-col divide-y divide-[#1a3d2b]">
      {items.map((item) => (
        <div key={item.id} className="flex gap-3 px-4 py-3">
          <span className="text-xl flex-shrink-0">{typeIcon[item.type]}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white leading-snug">{item.message}</p>
            <p className="text-[10px] text-[#5a7a65] mt-0.5">{timeAgo(item.timestamp)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
