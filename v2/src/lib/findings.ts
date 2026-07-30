import { oneDecimal } from '@/lib/metrics'
import type { ManagedConversation } from '@/lib/overrides'
import { SENTIMENT_LABELS, tagLabel } from '@/lib/sentiment'
import type { Sentiment } from '@/types'

export interface Finding {
  id: string
  sentiment: Sentiment
  tag: string
  count: number
  share: number
  summary: string
}

/**
 * Ranks (sentiment, tag) buckets by size and turns the largest few into plain-language
 * findings. This is a description of the biggest patterns already in the data, not a
 * recommendation — it doesn't say what to do about them.
 */
export function computeFindings(conversations: ManagedConversation[], limit = 3): Finding[] {
  const classified = conversations.filter((conversation) => conversation.sentiment)
  const total = classified.length
  if (total === 0) return []

  const buckets = new Map<string, { sentiment: Sentiment; tag: string; count: number }>()
  for (const conversation of classified) {
    for (const tag of conversation.tags) {
      const key = `${conversation.sentiment}:${tag}`
      const bucket = buckets.get(key) ?? {
        sentiment: conversation.sentiment as Sentiment,
        tag,
        count: 0,
      }
      bucket.count += 1
      buckets.set(key, bucket)
    }
  }

  return [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((bucket) => {
      const share = oneDecimal(bucket.count, total)
      const sentimentLabel = SENTIMENT_LABELS[bucket.sentiment].toLowerCase()
      return {
        id: `${bucket.sentiment}:${bucket.tag}`,
        sentiment: bucket.sentiment,
        tag: bucket.tag,
        count: bucket.count,
        share,
        summary: `${bucket.count} of ${total} classified replies (${share}%) are ${sentimentLabel} — ${tagLabel(bucket.tag).toLowerCase()}.`,
      }
    })
}

export function findingConversations(
  conversations: ManagedConversation[],
  finding: Pick<Finding, 'sentiment' | 'tag'>,
): ManagedConversation[] {
  return conversations.filter(
    (conversation) =>
      conversation.sentiment === finding.sentiment && conversation.tags.includes(finding.tag),
  )
}
