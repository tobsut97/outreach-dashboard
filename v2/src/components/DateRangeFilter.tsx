import { useState } from 'react'
import { format, subMonths } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { rangePresets, toKey } from '@/lib/dateRange'

export function DateRangeFilter({
  range,
  onRangeChange,
  minDate,
  maxDate,
  days,
}: {
  range: DateRange | undefined
  onRangeChange: (range: DateRange | undefined) => void
  minDate: Date
  maxDate: Date
  days: string[]
}) {
  const [open, setOpen] = useState(false)
  const presets = rangePresets(minDate, maxDate)

  const hasData = (preset: DateRange) => {
    if (!preset.from || !preset.to) return false
    const from = toKey(preset.from)
    const to = toKey(preset.to)
    return days.some((day) => day >= from && day <= to)
  }

  return (
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
              <span>Timerange</span>
            )}
          </Button>
        }
      />
      <PopoverContent className="w-auto p-0" align="start">
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
                  onRangeChange(preset.range)
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
            onSelect={onRangeChange}
            numberOfMonths={2}
            disabled={{ before: minDate, after: maxDate }}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
