import { categorizePosition } from '@/lib/position'
import type { Conversation, DashboardData, Sentiment } from '@/types'

/**
 * `DashboardData['summary']` describes what extract.py writes into data.json, which carries
 * no tag crosstab — so the derived shape is an intersection rather than a widening of it.
 */
export type Summary = DashboardData['summary'] & {
  tag_counts: Partial<Record<Sentiment, Record<string, number>>>
  positive_reply_rate: number
  meeting_booked_count: number
  meeting_booked_rate: number
}

export interface Metrics {
  daily: DashboardData['daily']
  summary: Summary
}

export const oneDecimal = (part: number, whole: number) =>
  whole ? Math.round((1000 * part) / whole) / 10 : 0

export interface PositionShare {
  position: string
  count: number
  share: number
}

export interface PositionBreakdown {
  rows: PositionShare[]
  totalReplied: number
  missingPosition: number
}

const TOP_POSITIONS = 8
export const OTHER_POSITION_LABEL = 'Other'

/**
 * Distribution of job titles among conversations that replied, as a share of ALL replies —
 * "out of everyone who replied, what titles come up most," not a per-position reply rate.
 * Titles are grouped into role categories inferred from the raw strings (see
 * `categorizePosition`), not by exact string, so DE/EN variants of the same role (e.g.
 * "Geschäftsführer"/"CEO", "CFO"/"Chief Financial Officer") land in one bucket instead of
 * splitting the count and inflating "Other". Replies with no title on file count toward the
 * denominator (`totalReplied`) but aren't shown as their own row; `missingPosition` reports how
 * many so the UI can caveat the percentages rather than let them silently not add up to 100%.
 * The long tail beyond the top few categories by volume is folded into "Other".
 */
export function positionShareAmongReplies(conversations: Conversation[]): PositionBreakdown {
  const replied = conversations.filter((conversation) => conversation.replied)
  const totalReplied = replied.length
  const missingPosition = replied.filter((conversation) => !conversation.position.trim()).length

  const counts = new Map<string, number>()
  for (const conversation of replied) {
    const position = conversation.position.trim()
    if (!position) continue
    const category = categorizePosition(position)
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }

  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  const rows = ranked.slice(0, TOP_POSITIONS).map(([position, count]) => ({
    position,
    count,
    share: oneDecimal(count, totalReplied),
  }))

  const rest = ranked.slice(TOP_POSITIONS)
  if (rest.length > 0) {
    const otherCount = rest.reduce((sum, [, count]) => sum + count, 0)
    rows.push({
      position: OTHER_POSITION_LABEL,
      count: otherCount,
      share: oneDecimal(otherCount, totalReplied),
    })
  }

  return { rows, totalReplied, missingPosition }
}

/** Recompute the dashboard's metrics from a conversation list. */
export function deriveMetrics(conversations: Conversation[]): Metrics {
  const sent: Record<string, number> = {}
  const received: Record<string, number> = {}
  const counts: Partial<Record<Sentiment, number>> = {}
  const tagCounts: Partial<Record<Sentiment, Record<string, number>>> = {}
  let replied = 0

  for (const conversation of conversations) {
    if (conversation.sentiment) {
      counts[conversation.sentiment] = (counts[conversation.sentiment] ?? 0) + 1
      const bucket = tagCounts[conversation.sentiment] ?? {}
      for (const tag of conversation.tags) {
        bucket[tag] = (bucket[tag] ?? 0) + 1
      }
      tagCounts[conversation.sentiment] = bucket
    }

    if (conversation.replied) replied++

    for (const message of conversation.messages) {
      const day = message.date.slice(0, 10)
      if (message.sender === 'owner') {
        sent[day] = (sent[day] ?? 0) + 1
      } else {
        received[day] = (received[day] ?? 0) + 1
      }
    }
  }

  const classified = Object.values(counts).reduce((total, count) => total + count, 0)
  const share: Partial<Record<Sentiment, number>> = {}
  for (const [key, count] of Object.entries(counts)) {
    share[key as Sentiment] = oneDecimal(count, classified)
  }

  const meetingBookedCount = Object.values(tagCounts).reduce(
    (total, bucket) => total + (bucket['meeting_booked'] ?? 0),
    0,
  )

  return {
    daily: { sent, received },
    summary: {
      total_messaged: conversations.length,
      total_replied: replied,
      reply_rate: oneDecimal(replied, conversations.length),
      sentiment_counts: counts,
      sentiment_share: share,
      tag_counts: tagCounts,
      positive_reply_rate: oneDecimal(counts.positive ?? 0, classified),
      meeting_booked_count: meetingBookedCount,
      meeting_booked_rate: oneDecimal(meetingBookedCount, conversations.length),
    },
  }
}
