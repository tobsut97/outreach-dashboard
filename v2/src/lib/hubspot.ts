import type { DealInfo, DealStage, HubspotData, LeadMatch } from '@/types/hubspot'
import { conversationKey, type ManagedConversation } from '@/lib/overrides'

/** Lead matches whose `conversation_key` is in the currently filtered conversation set, so the
 *  qualified/lost breakdown respects the app's existing profile/date filters. */
export function matchedLeads(conversations: ManagedConversation[], hubspot: HubspotData): LeadMatch[] {
  const keys = new Set(conversations.map((conversation) => conversationKey(conversation)))
  return hubspot.matches.filter((match) => keys.has(match.conversation_key))
}

export function qualifiedLeads(matches: LeadMatch[]): LeadMatch[] {
  return matches.filter((match) => match.lead_stage === 'Qualified')
}

export function lostLeads(matches: LeadMatch[]): LeadMatch[] {
  return matches.filter((match) => match.lead_stage === 'Disqualified')
}

export interface MatchedDeal {
  lead: LeadMatch
  deal: DealInfo
}

export function dealsInStage(matches: LeadMatch[], stage: DealStage): MatchedDeal[] {
  return matches.flatMap((lead) => lead.deals.filter((deal) => deal.deal_stage === stage).map((deal) => ({ lead, deal })))
}

export function lostDeals(matches: LeadMatch[]): MatchedDeal[] {
  return matches.flatMap((lead) => lead.deals.filter((deal) => deal.is_closed_lost).map((deal) => ({ lead, deal })))
}
