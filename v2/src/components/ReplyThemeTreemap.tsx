import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ManagedConversation } from '@/lib/overrides'
import { replyThemeLabel } from '@/lib/replyThemes'
import { TAG_BAR_COLOR } from '@/lib/sentiment'
import { squarify } from '@/lib/treemap'
import type { Sentiment } from '@/types'

const HEIGHT = 320
const LABEL_MIN_WIDTH = 70
const LABEL_MIN_HEIGHT = 34

// Same hue each sentiment page already uses for its dot/bar (DOT_COLOR/BAR_COLOR in
// sentiment.ts), as a real CSS color rather than a Tailwind class — needed for color-mix().
const HUE_VAR: Record<Sentiment, string> = {
  positive: 'var(--color-emerald-500)',
  neutral: 'var(--color-slate-400)',
  negative: 'var(--color-red-400)',
}

// Leaves rank-ordered dark(most saturated)->light(palest, mixed toward the card surface) so
// adjacent similarly-sized leaves stay visually separable without drawing a border around them.
const MIX_MAX = 95
const MIX_MIN = 22

export function ReplyThemeTreemap({
  sentiment,
  conversations,
  onSelectTheme,
}: {
  sentiment: Sentiment
  conversations: ManagedConversation[]
  onSelectTheme: (theme: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const counts = useMemo(() => {
    const tally = new Map<string, number>()
    for (const conversation of conversations) {
      if (!conversation.reply_theme) continue
      tally.set(conversation.reply_theme, (tally.get(conversation.reply_theme) ?? 0) + 1)
    }
    return [...tally.entries()]
      .map(([id, value]) => ({ id, value }))
      .sort((a, b) => b.value - a.value)
  }, [conversations])

  const total = counts.reduce((sum, item) => sum + item.value, 0)
  // squarify() sorts its input descending by value and peels off contiguous rows in that order,
  // so `leaves[i]`'s rank is just its index — no need to re-sort here.
  const leaves = useMemo(() => (width === 0 ? [] : squarify(counts, width, HEIGHT)), [counts, width])
  const hue = HUE_VAR[sentiment]

  const leafFill = (rank: number, rankCount: number) => {
    const t = rankCount > 1 ? rank / (rankCount - 1) : 0
    const mixPercent = MIX_MAX - t * (MIX_MAX - MIX_MIN)
    return `color-mix(in oklch, ${hue} ${mixPercent}%, var(--color-card))`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground text-sm font-semibold">What they actually said</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {counts.length === 0 ? (
          <p className="text-muted-foreground text-sm">No replies classified yet.</p>
        ) : (
          <>
            <div ref={containerRef} className="relative w-full" style={{ height: HEIGHT }}>
              {leaves.map((leaf, rank) => {
                const fits = leaf.width >= LABEL_MIN_WIDTH && leaf.height >= LABEL_MIN_HEIGHT
                const share = total ? Math.round((1000 * leaf.value) / total) / 10 : 0
                return (
                  <button
                    key={leaf.id}
                    type="button"
                    onClick={() => onSelectTheme(leaf.id)}
                    className="absolute overflow-hidden text-left transition-[filter] duration-150 hover:brightness-95 focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none"
                    style={{
                      left: leaf.x + 1,
                      top: leaf.y + 1,
                      width: Math.max(leaf.width - 2, 0),
                      height: Math.max(leaf.height - 2, 0),
                      backgroundColor: leafFill(rank, leaves.length),
                    }}
                    title={`${leaf.value} replies (${share}%) — ${replyThemeLabel(leaf.id)}`}
                  >
                    {fits && (
                      <span className="text-foreground pointer-events-none absolute inset-0 flex flex-col justify-end p-1.5 text-xs leading-tight">
                        <span className="line-clamp-2 font-medium">{replyThemeLabel(leaf.id)}</span>
                        <span className="tabular-nums opacity-70">{leaf.value}</span>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground text-xs">Same data as a ranked list:</p>
              {counts.map(({ id, value }) => {
                const share = total ? Math.round((1000 * value) / total) / 10 : 0
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectTheme(id)}
                    className="hover:bg-muted flex items-center gap-3 rounded-md px-2 py-1.5 text-left"
                  >
                    <span className="w-56 shrink-0 truncate text-sm" title={replyThemeLabel(id)}>
                      {replyThemeLabel(id)}
                    </span>
                    <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                      <div
                        className={`h-full rounded-full ${TAG_BAR_COLOR[sentiment]}`}
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground w-10 shrink-0 text-right text-sm tabular-nums">
                      {value}
                    </span>
                    <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums">{share}%</span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
