import type { DealInfo, DealStage, HubspotData, LeadMatch } from '@/types/hubspot'
import { conversationKey, type ManagedConversation } from '@/lib/overrides'

/** Lead matches whose `conversation_key` is in the currently filtered conversation set, so the
 *  qualified/lost breakdown respects the app's existing profile/date filters. */
export function matchedLeads(conversations: ManagedConversation[], hubspot: HubspotData): LeadMatch[] {
  const keys = new Set(conversations.map((conversation) => conversationKey(conversation)))
  return hubspot.matches.filter((match) => keys.has(match.conversation_key))
}

export function meetingBookedConversations(conversations: ManagedConversation[]): ManagedConversation[] {
  return conversations.filter((conversation) => conversation.tags.includes('meeting_booked'))
}

/** Leads whose outreach conversation was itself tagged meeting_booked — the subset of `matches`
 *  that traces back to an actual booked meeting, as opposed to every matched lead regardless of
 *  how the outreach conversation went. */
export function leadsFromMeetingBooked(matches: LeadMatch[], conversations: ManagedConversation[]): LeadMatch[] {
  const keys = new Set(meetingBookedConversations(conversations).map((conversation) => conversationKey(conversation)))
  return matches.filter((match) => keys.has(match.conversation_key))
}

/** Meeting-booked conversations with no matching HubSpot lead at all — the funnel's biggest
 *  drop-off point, worth surfacing explicitly rather than letting it disappear as a gap between
 *  two numbers. */
export function meetingsWithoutLead(
  matches: LeadMatch[],
  conversations: ManagedConversation[],
): ManagedConversation[] {
  const leadKeys = new Set(matches.map((match) => match.conversation_key))
  return meetingBookedConversations(conversations).filter(
    (conversation) => !leadKeys.has(conversationKey(conversation)),
  )
}

export function qualifiedLeads(matches: LeadMatch[]): LeadMatch[] {
  return matches.filter((match) => match.lead_stage === 'Qualified')
}

export function lostLeads(matches: LeadMatch[]): LeadMatch[] {
  return matches.filter((match) => match.lead_stage === 'Disqualified')
}

export function openLeads(matches: LeadMatch[]): LeadMatch[] {
  return matches.filter((match) => match.is_open)
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

export function wonDeals(matches: LeadMatch[]): MatchedDeal[] {
  return matches.flatMap((lead) => lead.deals.filter((deal) => deal.is_closed_won).map((deal) => ({ lead, deal })))
}
