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

function formatRangeDisplay(start: string, end: string): string {
  if (!start || !end) return 'Select date range'
  const [sy, sm, sd] = start.split('-')
  const [ey, em, ed] = end.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(sm) - 1]} ${parseInt(sd)}, ${sy} - ${months[parseInt(em) - 1]} ${parseInt(ed)}, ${ey}`
}

function parseDate(dateStr: string): Date | undefined {
  if (!dateStr) return undefined
  const [year, month, day] = dateStr.split('-')
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
}

function dateToIso(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function DailyChart({ daily }: { daily: DashboardData['daily'] }) {
  const days = Array.from(new Set([...Object.keys(daily.sent), ...Object.keys(daily.received)])).sort()
  const minDate = days[0] || ''
  const maxDate = days[days.length - 1] || ''

  const [startDate, setStartDate] = useState(minDate)
  const [endDate, setEndDate] = useState(maxDate)
  const [open, setOpen] = useState(false)

  const filteredDays = days.filter((day) => day >= startDate && day <= endDate)
  const data = filteredDays.map((day) => ({
    day,
    sent: daily.sent[day] ?? 0,
    received: daily.received[day] ?? 0,
  }))

  const minDateObj = parseDate(minDate)
  const maxDateObj = parseDate(maxDate)
  const startDateObj = parseDate(startDate)
  const endDateObj = parseDate(endDate)

  const applyRange = (start: Date, end: Date) => {
    setStartDate(dateToIso(start))
    setEndDate(dateToIso(end))
    setOpen(false)
  }

  const quickSelects = [
    {
      label: 'This week',
      apply: () => {
        const today = new Date()
        const start = new Date(today)
        start.setDate(today.getDate() - today.getDay())
        applyRange(start, today)
      },
    },
    {
      label: 'Last week',
      apply: () => {
        const today = new Date()
        const end = new Date(today)
        end.setDate(today.getDate() - today.getDay() - 1)
        const start = new Date(end)
        start.setDate(end.getDate() - 6)
        applyRange(start, end)
      },
    },
    {
      label: 'Last month',
      apply: () => {
        const today = new Date()
        const end = new Date(today.getFullYear(), today.getMonth(), 0)
        const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        applyRange(start, end)
      },
    },
    {
      label: 'Last quarter',
      apply: () => {
        const today = new Date()
        const quarter = Math.floor(today.getMonth() / 3)
        const end = new Date(today.getFullYear(), quarter * 3, 0)
        const start = new Date(today.getFullYear(), quarter * 3 - 3, 1)
        applyRange(start, end)
      },
    },
    {
      label: 'This year',
      apply: () => {
        const today = new Date()
        const start = new Date(today.getFullYear(), 0, 1)
        applyRange(start, today)
      },
    },
    {
      label: 'Last year',
      apply: () => {
        const start = new Date(new Date().getFullYear() - 1, 0, 1)
        const end = new Date(new Date().getFullYear() - 1, 11, 31)
        applyRange(start, end)
      },
    },
  ]

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3">
        <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Messages sent vs. answers received, per day
        </CardTitle>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger>
            <Button variant="outline" className="justify-start">
              📅 {formatRangeDisplay(startDate, endDate)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex">
              <div className="flex flex-col gap-2 border-r border-input p-4">
                {quickSelects.map((qs) => (
                  <Button
                    key={qs.label}
                    variant="ghost"
                    size="sm"
                    className="justify-start text-sm font-normal"
                    onClick={qs.apply}
                  >
                    {qs.label}
                  </Button>
                ))}
              </div>
              <div className="flex gap-4 p-4">
                <Calendar
                  mode="single"
                  selected={startDateObj}
                  onSelect={(date) => {
                    if (date && endDateObj && date <= endDateObj) {
                      setStartDate(dateToIso(date))
                    } else if (date) {
                      setStartDate(dateToIso(date))
                      setEndDate(dateToIso(date))
                    }
                  }}
                  disabled={(date) =>
                    (minDateObj && date < minDateObj) ||
                    (maxDateObj && date > maxDateObj) ||
                    false
                  }
                />
                <Calendar
                  mode="single"
                  selected={endDateObj}
                  onSelect={(date) => {
                    if (date && startDateObj && date >= startDateObj) {
                      setEndDate(dateToIso(date))
                    } else if (date) {
                      setStartDate(dateToIso(date))
                      setEndDate(dateToIso(date))
                    }
                  }}
                  disabled={(date) =>
                    (minDateObj && date < minDateObj) ||
                    (maxDateObj && date > maxDateObj) ||
                    false
                  }
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
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
