import { useState } from 'react'
import {
  format,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from 'date-fns'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

type DisplayMode = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'

const MODE_LABELS: Record<DisplayMode, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
}

const toKey = (date: Date) => format(date, 'yyyy-MM-dd')

/** Bucket a day into the period it belongs to. The key is the period's start date so buckets
 * sort chronologically; the label is what the axis and tooltip display. */
function bucketFor(date: Date, mode: DisplayMode): { key: string; label: string } {
  switch (mode) {
    case 'weekly': {
      const start = startOfWeek(date)
      return { key: toKey(start), label: format(start, 'MMM dd') }
    }
    case 'monthly': {
      const start = startOfMonth(date)
      return { key: toKey(start), label: format(start, 'MMM yyyy') }
    }
    case 'quarterly': {
      const start = startOfQuarter(date)
      return { key: toKey(start), label: format(start, 'QQQ yyyy') }
    }
    case 'yearly': {
      const start = startOfYear(date)
      return { key: toKey(start), label: format(start, 'yyyy') }
    }
    default:
      return { key: toKey(date), label: format(date, 'MMM dd') }
  }
}

/** The date range itself is a page-level filter (see App.tsx / DateRangeFilter) so `daily`
 * already only contains days within it — this component just groups what it's given. */
export function DailyChart({ daily }: { daily: DashboardData['daily'] }) {
  const [mode, setMode] = useState<DisplayMode>('monthly')

  const days = Array.from(
    new Set([...Object.keys(daily.sent), ...Object.keys(daily.received)]),
  ).sort()

  const buckets = new Map<string, { key: string; label: string; sent: number; received: number }>()
  for (const day of days) {
    const { key, label } = bucketFor(parseISO(day), mode)
    const bucket = buckets.get(key) ?? { key, label, sent: 0, received: 0 }
    bucket.sent += daily.sent[day] ?? 0
    bucket.received += daily.received[day] ?? 0
    buckets.set(key, bucket)
  }
  const data = [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key))
  const labelByKey = new Map(data.map((bucket) => [bucket.key, bucket.label]))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-sm font-semibold">
          Messages sent vs. answers received
        </CardTitle>
        <CardAction>
          <Select
            value={mode}
            onValueChange={(value) => {
              if (value) setMode(value as DisplayMode)
            }}
          >
            <SelectTrigger className="w-28">
              <SelectValue>{(value) => MODE_LABELS[value as DisplayMode]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(MODE_LABELS) as DisplayMode[]).map((value) => (
                <SelectItem key={value} value={value}>
                  {MODE_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-muted-foreground text-sm">No data in this date range.</p>
        ) : (
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <BarChart data={data}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="key"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={(key: string) => labelByKey.get(key) ?? key}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => labelByKey.get(String(value)) ?? String(value)}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="sent" fill="var(--color-sent)" radius={2} isAnimationActive={false} />
              <Bar
                dataKey="received"
                fill="var(--color-received)"
                radius={2}
                isAnimationActive={false}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
