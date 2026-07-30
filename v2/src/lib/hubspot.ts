import { conversationKey, type ManagedConversation } from '@/lib/overrides'
import type { Summary } from '@/lib/metrics'
import type { BantTally, DealInfo, HubspotData, LeadMatch } from '@/types/hubspot'

export interface PipelineFunnel {
  messaged: number
  replied: number
  leadsMatchedHigh: number
  leadsMatchedMedium: number
  dealsMatched: number
  closedWonCount: number
  closedWonAmount: number
  closedLostCount: number
  stillOpenCount: number
  stillOpenAmount: number
}

/** Best/most-recent deal to surface for a lead row: prefer the highest-confidence deal, then
 *  the most recently closed one. */
export function primaryDeal(deals: DealInfo[]): DealInfo | null {
  if (deals.length === 0) return null
  return [...deals].sort((a, b) => {
    if (a.match_confidence !== b.match_confidence) return a.match_confidence === 'high' ? -1 : 1
    return (b.close_date ?? '').localeCompare(a.close_date ?? '')
  })[0]
}

/** Joins hubspot.json's lead matches against the currently filtered conversation set, so the
 *  pipeline funnel respects the app's existing profile/date filters. */
export function deriveHubspotFunnel(
  conversations: ManagedConversation[],
  summary: Summary,
  hubspot: HubspotData,
): PipelineFunnel {
  const keys = new Set(conversations.map((conversation) => conversationKey(conversation)))
  const matched = hubspot.matches.filter((match) => keys.has(match.conversation_key))
  const highConfidence = matched.filter((match) => match.match_confidence === 'high')
  const deals = matched.flatMap((match) => match.deals)

  let closedWonCount = 0
  let closedWonAmount = 0
  let closedLostCount = 0
  let stillOpenCount = 0
  let stillOpenAmount = 0
  for (const deal of deals) {
    if (deal.is_closed_won) {
      closedWonCount++
      closedWonAmount += deal.amount
    } else if (deal.is_closed_lost) {
      closedLostCount++
    } else if (deal.is_open) {
      stillOpenCount++
      stillOpenAmount += deal.amount
    }
  }

  return {
    messaged: summary.total_messaged,
    replied: summary.total_replied,
    leadsMatchedHigh: highConfidence.length,
    leadsMatchedMedium: matched.length - highConfidence.length,
    dealsMatched: deals.length,
    closedWonCount,
    closedWonAmount,
    closedLostCount,
    stillOpenCount,
    stillOpenAmount,
  }
}

const BANT_KEYS = ['Yes', 'No', 'Maybe', 'TBD', 'blank'] as const

function emptyTally(): BantTally {
  return { Yes: 0, No: 0, Maybe: 0, TBD: 0, blank: 0 }
}

/** BANT breakdown recomputed over only the matched-and-filtered leads shown on the page, as
 *  opposed to hubspot.json's `aggregate.bant_breakdown`, which covers every lead in the CSV. */
export function deriveBantBreakdown(
  matches: LeadMatch[],
): Record<'authority' | 'budget' | 'need' | 'timeline', BantTally> {
  const breakdown = {
    authority: emptyTally(),
    budget: emptyTally(),
    need: emptyTally(),
    timeline: emptyTally(),
  }
  for (const match of matches) {
    for (const field of ['authority', 'budget', 'need', 'timeline'] as const) {
      const value = match[field] ?? 'blank'
      breakdown[field][value]++
    }
  }
  return breakdown
}

export const BANT_TALLY_KEYS = BANT_KEYS
