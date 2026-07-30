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
import type { DateRange } from 'react-day-picker'
import type { Conversation } from '@/types'

export const toKey = (date: Date) => format(date, 'yyyy-MM-dd')

/** The date a conversation counts against for range filtering: its earliest message, i.e.
 *  when the owner first reached out. Replies that arrive after the picked range don't pull
 *  the conversation out of scope — only when it started does. */
export function firstMessageKey(conversation: Conversation): string | null {
  if (conversation.messages.length === 0) return null
  return conversation.messages.reduce(
    (min, message) => (message.date.slice(0, 10) < min ? message.date.slice(0, 10) : min),
    conversation.messages[0].date.slice(0, 10),
  )
}

export function conversationInRange(
  conversation: Conversation,
  fromKey: string,
  toKeyValue: string,
): boolean {
  const key = firstMessageKey(conversation)
  return key !== null && key >= fromKey && key <= toKeyValue
}

const DATA_MIN_YEAR = 2025
const DATA_MAX_YEAR = 2026

/** Hard cutoff: conversations starting outside this window are dropped everywhere, not just
 *  hidden by the date-range picker. */
export function restrictToDataYears(conversations: Conversation[]): Conversation[] {
  return conversations.filter((conversation) =>
    conversationInRange(conversation, `${DATA_MIN_YEAR}-01-01`, `${DATA_MAX_YEAR}-12-31`),
  )
}

/** Bounds the date picker to when conversations in the current scope actually started. */
export function dateBounds(conversations: Conversation[]): { minDate: Date; maxDate: Date } {
  const keys = conversations
    .map(firstMessageKey)
    .filter((key): key is string => key !== null)
    .sort()
  const today = new Date()
  const minKey = keys[0]
  const maxKey = keys[keys.length - 1]
  return {
    minDate: minKey ? parseISO(minKey) : today,
    maxDate: maxKey ? parseISO(maxKey) : today,
  }
}

export function rangePresets(minDate: Date, maxDate: Date): { label: string; range: DateRange }[] {
  const today = new Date()
  const lastWeek = subWeeks(today, 1)
  const lastMonth = subMonths(today, 1)
  const lastQuarter = subQuarters(today, 1)
  const lastYear = subYears(today, 1)

  return [
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
}
