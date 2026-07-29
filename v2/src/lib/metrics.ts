import type { Conversation, DashboardData, Sentiment } from '@/types'

export interface Metrics {
  daily: DashboardData['daily']
  summary: DashboardData['summary']
}

const oneDecimal = (part: number, whole: number) =>
  whole ? Math.round((1000 * part) / whole) / 10 : 0

/**
 * Recompute the dashboard's metrics from a conversation list.
 *
 * `sentiment` scopes the reply side only — received messages, the replied count, and the
 * reply rate. Sent messages carry no sentiment, so `sent` and `total_messaged` ignore it.
 * `sentiment_counts` / `sentiment_share` also ignore it, since the breakdown is the context
 * for the filter rather than a subject of it.
 */
export function deriveMetrics(
  conversations: Conversation[],
  sentiment: Sentiment | 'all',
): Metrics {
  const sent: Record<string, number> = {}
  const received: Record<string, number> = {}
  const counts: Partial<Record<Sentiment, number>> = {}
  let replied = 0

  for (const conversation of conversations) {
    if (conversation.sentiment) {
      counts[conversation.sentiment] = (counts[conversation.sentiment] ?? 0) + 1
    }

    const matches = sentiment === 'all' || conversation.sentiment === sentiment
    if (conversation.replied && matches) replied++

    for (const message of conversation.messages) {
      const day = message.date.slice(0, 10)
      if (message.sender === 'owner') {
        sent[day] = (sent[day] ?? 0) + 1
      } else if (matches) {
        received[day] = (received[day] ?? 0) + 1
      }
    }
  }

  const classified = Object.values(counts).reduce((total, count) => total + count, 0)
  const share: Partial<Record<Sentiment, number>> = {}
  for (const [key, count] of Object.entries(counts)) {
    share[key as Sentiment] = oneDecimal(count, classified)
  }

  return {
    daily: { sent, received },
    summary: {
      total_messaged: conversations.length,
      total_replied: replied,
      reply_rate: oneDecimal(replied, conversations.length),
      sentiment_counts: counts,
      sentiment_share: share,
    },
  }
}
