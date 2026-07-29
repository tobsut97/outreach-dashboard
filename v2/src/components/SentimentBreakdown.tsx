import { ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Summary } from '@/lib/metrics'
import {
  BAR_COLOR,
  DOT_COLOR,
  SENTIMENT_LABELS,
  SENTIMENT_ORDER,
} from '@/lib/sentiment'
import type { Sentiment } from '@/types'

export function SentimentBreakdown({
  summary,
  onSelect,
}: {
  summary: Summary
  onSelect: (sentiment: Sentiment) => void
}) {
  const total = Object.values(summary.sentiment_counts).reduce((a, b) => a + (b ?? 0), 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Answer sentiment
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {total === 0 ? (
          <p className="text-muted-foreground text-sm">No replies classified yet.</p>
        ) : (
          SENTIMENT_ORDER.map((sentiment) => {
            const count = summary.sentiment_counts[sentiment] ?? 0
            const share = summary.sentiment_share[sentiment] ?? 0

            return (
              <button
                key={sentiment}
                type="button"
                disabled={count === 0}
                onClick={() => onSelect(sentiment)}
                aria-label={`${SENTIMENT_LABELS[sentiment]} answers — view details`}
                className="hover:bg-muted focus-visible:ring-ring/50 -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50"
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_COLOR[sentiment]}`} />
                <span className="w-20 shrink-0 text-sm">{SENTIMENT_LABELS[sentiment]}</span>
                <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                  <div
                    className={`h-full rounded-full ${BAR_COLOR[sentiment]}`}
                    style={{ width: `${share}%` }}
                  />
                </div>
                <span className="text-muted-foreground w-10 shrink-0 text-right text-sm tabular-nums">
                  {count}
                </span>
                <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums">
                  {share}%
                </span>
                <ChevronRight className="text-muted-foreground size-4 shrink-0" />
              </button>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
