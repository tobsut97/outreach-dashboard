import { ChevronRight } from 'lucide-react'
import { Cell, Pie, PieChart } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Summary } from '@/lib/metrics'
import { DOT_COLOR, SENTIMENT_LABELS, SENTIMENT_ORDER } from '@/lib/sentiment'
import type { Sentiment } from '@/types'

// Pie/Cell need real CSS colors, not the Tailwind classes DOT_COLOR holds. Tailwind v4 already
// exposes every default-palette shade as a CSS variable, so these stay in sync with DOT_COLOR's
// bg-emerald-500/bg-slate-400/bg-red-400 for free — same source, no new tokens to maintain.
const HUE_VAR: Record<Sentiment, string> = {
  positive: 'var(--color-emerald-500)',
  neutral: 'var(--color-slate-400)',
  negative: 'var(--color-red-400)',
}

const PIE_SIZE = 280

export function SentimentBreakdown({
  summary,
  onSelect,
}: {
  summary: Summary
  onSelect: (sentiment: Sentiment) => void
}) {
  const total = Object.values(summary.sentiment_counts).reduce((a, b) => a + (b ?? 0), 0)
  const data = SENTIMENT_ORDER.map((sentiment) => ({
    sentiment,
    value: summary.sentiment_counts[sentiment] ?? 0,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground text-sm font-semibold">Answer sentiment</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-muted-foreground text-sm">No replies classified yet.</p>
        ) : (
          <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-2">
            <PieChart width={PIE_SIZE} height={PIE_SIZE} className="mx-auto">
              <Pie
                data={data}
                dataKey="value"
                nameKey="sentiment"
                innerRadius={55}
                outerRadius={90}
                strokeWidth={2}
                stroke="var(--color-card)"
                isAnimationActive={false}
              >
                {data.map((entry) => (
                  <Cell key={entry.sentiment} fill={HUE_VAR[entry.sentiment]} />
                ))}
              </Pie>
            </PieChart>

            <div className="flex flex-col gap-1">
              {SENTIMENT_ORDER.map((sentiment) => {
                const count = summary.sentiment_counts[sentiment] ?? 0
                const share = summary.sentiment_share[sentiment] ?? 0
                return (
                  <button
                    key={sentiment}
                    type="button"
                    disabled={count === 0}
                    onClick={() => onSelect(sentiment)}
                    className="hover:bg-muted focus-visible:ring-ring/50 -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50"
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT_COLOR[sentiment]}`} />
                    <span className="flex-1 text-sm">{SENTIMENT_LABELS[sentiment]}</span>
                    <span className="text-muted-foreground text-sm tabular-nums">{count}</span>
                    <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums">
                      {share}%
                    </span>
                    <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
