import { CalendarCheck, MessageSquareReply, Send, ThumbsUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Summary } from '@/lib/metrics'

export function KpiStrip({ summary }: { summary: Summary }) {
  const items = [
    {
      label: 'Messaged',
      value: summary.total_messaged,
      sub: null,
      icon: Send,
      iconClassName: 'text-muted-foreground',
      badgeClassName: 'bg-muted-foreground/10',
    },
    {
      label: 'Reply rate',
      value: `${summary.reply_rate}%`,
      sub: `${summary.total_replied} replied`,
      icon: MessageSquareReply,
      iconClassName: 'text-sky-500',
      badgeClassName: 'bg-sky-500/10',
    },
    {
      label: 'Positive reply rate',
      value: `${summary.positive_reply_rate}%`,
      sub: `${summary.sentiment_counts.positive ?? 0} positive`,
      icon: ThumbsUp,
      iconClassName: 'text-emerald-500',
      badgeClassName: 'bg-emerald-500/10',
    },
    {
      label: 'Meeting booked rate',
      value: `${summary.meeting_booked_rate}%`,
      sub: `${summary.meeting_booked_count} booked`,
      icon: CalendarCheck,
      iconClassName: 'text-violet-500',
      badgeClassName: 'bg-violet-500/10',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {item.label}
            </CardTitle>
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${item.badgeClassName}`}
            >
              <item.icon className={`h-5 w-5 ${item.iconClassName}`} />
            </span>
          </CardHeader>
          <CardContent>
            <div className="font-kpi text-3xl font-bold tabular-nums">{item.value}</div>
            {item.sub && (
              <div className="font-kpi text-muted-foreground mt-1 text-sm tabular-nums">
                {item.sub}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
