import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Summary } from '@/lib/metrics'
import { tagLabel } from '@/lib/sentiment'

export function NegativeTagBreakdown({ summary }: { summary: Summary }) {
  const counts = summary.tag_counts.negative ?? {}
  const total = summary.sentiment_counts.negative ?? 0
  const rows = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Most mentioned negative reasons
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No negative replies classified yet.</p>
        ) : (
          rows.map(([tag, count]) => {
            const share = total ? Math.round((1000 * count) / total) / 10 : 0
            return (
              <div key={tag} className="flex items-center gap-3 px-2 py-2">
                <span className="w-40 shrink-0 truncate text-sm" title={tagLabel(tag)}>
                  {tagLabel(tag)}
                </span>
                <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                  <div className="bg-red-400/40 h-full rounded-full" style={{ width: `${share}%` }} />
                </div>
                <span className="text-muted-foreground w-10 shrink-0 text-right text-sm tabular-nums">
                  {count}
                </span>
                <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums">
                  {share}%
                </span>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
