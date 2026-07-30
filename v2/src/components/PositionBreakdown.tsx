import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { positionShareAmongReplies } from '@/lib/metrics'
import type { Conversation } from '@/types'

export function PositionBreakdown({ conversations }: { conversations: Conversation[] }) {
  const { rows, totalReplied, missingPosition } = positionShareAmongReplies(conversations)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-sm font-semibold">
          Most common job titles among replies
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {totalReplied === 0 ? (
          <p className="text-muted-foreground text-sm">No replies yet.</p>
        ) : (
          <>
            {rows.map((row) => (
              <div key={row.position} className="flex items-center gap-3 px-2 py-2">
                <span className="w-40 shrink-0 truncate text-sm" title={row.position}>
                  {row.position}
                </span>
                <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                  <div className="bg-sky-500 h-full rounded-full" style={{ width: `${row.share}%` }} />
                </div>
                <span className="text-muted-foreground w-10 shrink-0 text-right text-sm tabular-nums">
                  {row.count}
                </span>
                <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums">
                  {row.share}%
                </span>
              </div>
            ))}
            {missingPosition > 0 && (
              <p className="text-muted-foreground px-2 pt-1 text-xs">
                {missingPosition} of {totalReplied} replies have no job title on file — not shown
                above but counted in the percentages.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
