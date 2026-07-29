import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
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

function formatDate(dateStr: string): string {
  if (!dateStr) return 'Pick a date'
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

function parseDate(dateStr: string): Date | undefined {
  if (!dateStr) return undefined
  const [year, month, day] = dateStr.split('-')
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
}

export function DailyChart({ daily }: { daily: DashboardData['daily'] }) {
  const days = Array.from(new Set([...Object.keys(daily.sent), ...Object.keys(daily.received)])).sort()

  const minDate = days[0] || ''
  const maxDate = days[days.length - 1] || ''

  const [startDate, setStartDate] = useState(minDate)
  const [endDate, setEndDate] = useState(maxDate)
  const [startOpen, setStartOpen] = useState(false)
  const [endOpen, setEndOpen] = useState(false)

  const filteredDays = days.filter((day) => day >= startDate && day <= endDate)
  const data = filteredDays.map((day) => ({
    day,
    sent: daily.sent[day] ?? 0,
    received: daily.received[day] ?? 0,
  }))

  const handleStartDateSelect = (date: Date | undefined) => {
    if (!date) return
    const isoStr = date.toISOString().split('T')[0]
    setStartDate(isoStr)
    setStartOpen(false)
  }

  const handleEndDateSelect = (date: Date | undefined) => {
    if (!date) return
    const isoStr = date.toISOString().split('T')[0]
    setEndDate(isoStr)
    setEndOpen(false)
  }

  const minDateObj = parseDate(minDate)
  const maxDateObj = parseDate(maxDate)
  const startDateObj = parseDate(startDate)
  const endDateObj = parseDate(endDate)

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3">
        <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Messages sent vs. answers received, per day
        </CardTitle>
        <div className="flex flex-wrap items-end gap-2">
          <Popover open={startOpen} onOpenChange={setStartOpen}>
            <PopoverTrigger>
              <Button variant="outline" className="w-40">
                From: {formatDate(startDate)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDateObj}
                onSelect={handleStartDateSelect}
                disabled={(date) =>
                  (minDateObj && date < minDateObj) ||
                  (maxDateObj && date > maxDateObj) ||
                  (endDateObj && date > endDateObj) ||
                  false
                }
              />
            </PopoverContent>
          </Popover>

          <Popover open={endOpen} onOpenChange={setEndOpen}>
            <PopoverTrigger>
              <Button variant="outline" className="w-40">
                To: {formatDate(endDate)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDateObj}
                onSelect={handleEndDateSelect}
                disabled={(date) =>
                  (minDateObj && date < minDateObj) ||
                  (maxDateObj && date > maxDateObj) ||
                  (startDateObj && date < startDateObj) ||
                  false
                }
              />
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStartDate(minDate)
              setEndDate(maxDate)
            }}
          >
            Reset
          </Button>
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
