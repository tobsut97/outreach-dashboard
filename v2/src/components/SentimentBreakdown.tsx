import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Summary } from '@/lib/metrics'
import type { Sentiment } from '@/types'

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

// Literal classes, not runtime concatenation — Tailwind only emits what it can see.
const TAG_BAR_COLOR: Record<Sentiment, string> = {
  positive: 'bg-emerald-500/40',
  neutral: 'bg-slate-400/40',
  negative: 'bg-red-400/40',
}

// Vocabulary is fixed by ALLOWED_TAGS in extract.py.
const TAG_LABELS: Record<string, string> = {
  meeting_booked: 'Meeting booked',
  open_to_call: 'Open to call',
  referred_colleague: 'Referred a colleague',
  future_timing: 'Better timing later',
  has_existing_solution: 'Has existing solution',
  no_budget: 'No budget',
  not_relevant: 'Not relevant',
  role_change: 'Changed role',
  no_reason_given: 'No reason given',
  unclear: 'Unclear',
}

const oneDecimal = (part: number, whole: number) =>
  whole ? Math.round((1000 * part) / whole) / 10 : 0

export function SentimentBreakdown({ summary }: { summary: Summary }) {
  const total = Object.values(summary.sentiment_counts).reduce((a, b) => a + (b ?? 0), 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Sentiment &amp; reasons
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {ORDER.map((sentiment) => {
          const count = summary.sentiment_counts[sentiment] ?? 0
          const share = summary.sentiment_share[sentiment] ?? 0
          const reasons = Object.entries(summary.tag_counts[sentiment] ?? {}).sort(
            (a, b) => b[1] - a[1],
          )

          return (
            <div key={sentiment} className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_COLOR[sentiment]}`} />
                <span className="w-44 shrink-0 text-sm">{LABELS[sentiment]}</span>
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
              </div>

              {reasons.map(([tag, tagCount]) => {
                const tagShare = oneDecimal(tagCount, count)
                return (
                  <div key={tag} className="text-muted-foreground flex items-center gap-3">
                    <span className="h-2 w-2 shrink-0" />
                    <span className="w-44 shrink-0 pl-5 text-xs">
                      {TAG_LABELS[tag] ?? tag}
                    </span>
                    <div className="bg-muted/60 h-1 flex-1 overflow-hidden rounded-full">
                      <div
                        className={`h-full rounded-full ${TAG_BAR_COLOR[sentiment]}`}
                        style={{ width: `${Math.min(tagShare, 100)}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs tabular-nums">
                      {tagCount}
                    </span>
                    <span className="w-12 shrink-0 text-right text-xs tabular-nums">
                      {tagShare}%
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}

        {total === 0 ? (
          <p className="text-muted-foreground text-sm">No replies classified yet.</p>
        ) : (
          <p className="text-muted-foreground text-xs">
            A reply can carry up to two reasons, so reason shares don't sum to their
            sentiment's share.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
