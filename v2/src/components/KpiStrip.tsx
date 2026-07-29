import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardData } from '@/types'

export function KpiStrip({ summary }: { summary: DashboardData['summary'] }) {
  const items = [
    { label: 'Messaged', value: summary.total_messaged },
    { label: 'Replied', value: summary.total_replied },
    { label: 'Reply rate', value: `${summary.reply_rate}%` },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{item.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
