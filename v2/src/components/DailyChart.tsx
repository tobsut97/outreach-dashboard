import { useState } from 'react'
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

  const minDate = days[0] || ''
  const maxDate = days[days.length - 1] || ''

  const [startDate, setStartDate] = useState(minDate)
  const [endDate, setEndDate] = useState(maxDate)

  const filteredDays = days.filter((day) => day >= startDate && day <= endDate)
  const data = filteredDays.map((day) => ({
    day,
    sent: daily.sent[day] ?? 0,
    received: daily.received[day] ?? 0,
  }))

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3">
        <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Messages sent vs. answers received, per day
        </CardTitle>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="start-date" className="text-xs font-medium text-muted-foreground">
              From
            </label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={minDate}
              max={endDate}
              className="rounded border border-input bg-background px-3 py-1.5 text-sm font-mono"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="end-date" className="text-xs font-medium text-muted-foreground">
              To
            </label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              max={maxDate}
              className="rounded border border-input bg-background px-3 py-1.5 text-sm font-mono"
            />
          </div>
          <button
            onClick={() => {
              setStartDate(minDate)
              setEndDate(maxDate)
            }}
            className="text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
          >
            Reset
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-muted-foreground text-sm">No data in this date range.</p>
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
