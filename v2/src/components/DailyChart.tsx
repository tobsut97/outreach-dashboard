import { useState } from 'react'
import {
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subMonths,
  subQuarters,
  subWeeks,
  subYears,
} from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { type DateRange } from 'react-day-picker'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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

// data.json carries years of pre-campaign LinkedIn history for contacts who were already
// connections; the campaign itself starts in late 2025.
const DATA_START = '2025-01-01'

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

export function DailyChart({ daily }: { daily: DashboardData['daily'] }) {
  const days = Array.from(new Set([...Object.keys(daily.sent), ...Object.keys(daily.received)]))
    .filter((day) => day >= DATA_START)
    .sort()

  const minDay = days[0] ?? DATA_START
  const maxDay = days[days.length - 1] ?? DATA_START
  const minDate = parseISO(minDay)
  const maxDate = parseISO(maxDay)

  const [range, setRange] = useState<DateRange | undefined>({ from: minDate, to: maxDate })
  const [mode, setMode] = useState<DisplayMode>('daily')
  const [open, setOpen] = useState(false)

  const fromKey = range?.from ? toKey(range.from) : minDay
  const endKey = range?.to ? toKey(range.to) : fromKey

  const buckets = new Map<string, { key: string; label: string; sent: number; received: number }>()
  for (const day of days) {
    if (day < fromKey || day > endKey) continue
    const { key, label } = bucketFor(parseISO(day), mode)
    const bucket = buckets.get(key) ?? { key, label, sent: 0, received: 0 }
    bucket.sent += daily.sent[day] ?? 0
    bucket.received += daily.received[day] ?? 0
    buckets.set(key, bucket)
  }
  const data = [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key))
  const labelByKey = new Map(data.map((bucket) => [bucket.key, bucket.label]))

  const today = new Date()
  const lastWeek = subWeeks(today, 1)
  const lastMonth = subMonths(today, 1)
  const lastQuarter = subQuarters(today, 1)
  const lastYear = subYears(today, 1)

  const presets: { label: string; range: DateRange }[] = [
    { label: 'Show all', range: { from: minDate, to: maxDate } },
    { label: 'This week', range: { from: startOfWeek(today), to: today } },
    { label: 'Last week', range: { from: startOfWeek(lastWeek), to: endOfWeek(lastWeek) } },
    { label: 'Last month', range: { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) } },
    {
      label: 'Last quarter',
      range: { from: startOfQuarter(lastQuarter), to: endOfQuarter(lastQuarter) },
    },
    { label: 'This year', range: { from: startOfYear(today), to: today } },
    { label: 'Last year', range: { from: startOfYear(lastYear), to: endOfYear(lastYear) } },
  ]

  const hasData = (preset: DateRange) => {
    if (!preset.from || !preset.to) return false
    const from = toKey(preset.from)
    const to = toKey(preset.to)
    return days.some((day) => day >= from && day <= to)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Messages sent vs. answers received
        </CardTitle>
        <CardAction className="flex flex-wrap items-center gap-2">
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

          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              render={
                <Button variant="outline" className="w-fit justify-start px-2.5 font-normal">
                  <CalendarIcon data-icon="inline-start" />
                  {range?.from ? (
                    range.to ? (
                      <>
                        {format(range.from, 'LLL dd, y')} - {format(range.to, 'LLL dd, y')}
                      </>
                    ) : (
                      format(range.from, 'LLL dd, y')
                    )
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              }
            />
            <PopoverContent className="w-auto p-0" align="end">
              <div className="flex max-sm:flex-col">
                <div className="flex flex-col gap-1 border-r p-3 max-sm:border-r-0 max-sm:border-b">
                  {presets.map((preset) => (
                    <Button
                      key={preset.label}
                      variant="ghost"
                      size="sm"
                      disabled={!hasData(preset.range)}
                      className="justify-start font-normal"
                      onClick={() => {
                        setRange(preset.range)
                        setOpen(false)
                      }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
                <Calendar
                  mode="range"
                  defaultMonth={subMonths(maxDate, 1)}
                  selected={range}
                  onSelect={setRange}
                  numberOfMonths={2}
                  disabled={{ before: minDate, after: maxDate }}
                />
              </div>
            </PopoverContent>
          </Popover>
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
              <Bar dataKey="sent" fill="var(--color-sent)" radius={2} />
              <Bar dataKey="received" fill="var(--color-received)" radius={2} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
