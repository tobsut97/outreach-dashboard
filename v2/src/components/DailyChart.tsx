import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { DashboardData } from '@/types'

const chartConfig = {
  sent: { label: 'Sent', color: 'var(--chart-1)' },
  received: { label: 'Received', color: 'var(--chart-2)' },
} satisfies ChartConfig

export function DailyChart({ daily }: { daily: DashboardData['daily'] }) {
  const days = Array.from(new Set([...Object.keys(daily.sent), ...Object.keys(daily.received)])).sort()
  const data = days.map((day) => ({
    day,
    sent: daily.sent[day] ?? 0,
    received: daily.received[day] ?? 0,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Messages sent vs. answers received, per day
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-muted-foreground text-sm">No data yet.</p>
        ) : (
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <BarChart data={data}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="sent" fill="var(--color-sent)" radius={2} />
              <Bar dataKey="received" fill="var(--color-received)" radius={2} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
