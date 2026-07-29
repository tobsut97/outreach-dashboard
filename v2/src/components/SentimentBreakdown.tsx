import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardData, Sentiment } from '@/types'

const ORDER: Sentiment[] = ['positive', 'neutral', 'negative']

const LABELS: Record<Sentiment, string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
}

const BAR_COLOR: Record<Sentiment, string> = {
  positive: 'bg-emerald-500',
  neutral: 'bg-slate-400',
  negative: 'bg-red-400',
}

const DOT_COLOR: Record<Sentiment, string> = {
  positive: 'bg-emerald-500',
  neutral: 'bg-slate-400',
  negative: 'bg-red-400',
}

export function SentimentBreakdown({ summary }: { summary: DashboardData['summary'] }) {
  const total = Object.values(summary.sentiment_counts).reduce((a, b) => a + (b ?? 0), 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Answer sentiment
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {ORDER.map((s) => {
          const count = summary.sentiment_counts[s] ?? 0
          const share = summary.sentiment_share[s] ?? 0
          return (
            <div key={s} className="flex items-center gap-3">
              <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_COLOR[s]}`} />
              <span className="w-16 shrink-0 text-sm">{LABELS[s]}</span>
              <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                <div
                  className={`h-full rounded-full ${BAR_COLOR[s]}`}
                  style={{ width: `${share}%` }}
                />
              </div>
              <span className="text-muted-foreground w-10 shrink-0 text-right text-sm tabular-nums">
                {count}
              </span>
              <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums">
                {share}%
              </span>
            </div>
          )
        })}
        {total === 0 && (
          <p className="text-muted-foreground text-sm">No replies classified yet.</p>
        )}
      </CardContent>
    </Card>
  )
}
