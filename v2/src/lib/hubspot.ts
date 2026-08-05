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
 *  two numbers. Excludes conversations flagged excluded_from_lead_matching (e.g. conference/
 *  event meetings that were never going to produce a HubSpot lead), since those aren't a
 *  matching failure. */
export function meetingsWithoutLead(
  matches: LeadMatch[],
  conversations: ManagedConversation[],
): ManagedConversation[] {
  const leadKeys = new Set(matches.map((match) => match.conversation_key))
  return meetingBookedConversations(conversations).filter(
    (conversation) => !conversation.excluded_from_lead_matching && !leadKeys.has(conversationKey(conversation)),
  )
}

export interface MeetingsBookedBreakdown {
  /** Every conversation tagged meeting_booked, including duplicates (e.g. the same prospect
   *  outreached to by two different owners under separate conversation records). */
  totalBooked: number
  /** Booked conversations sharing a conversation_key with another booked conversation — the
   *  same real person counted twice, not a distinct additional lead opportunity. */
  duplicateConversations: number
  /** Booked, no HubSpot lead, and explicitly flagged as never going to have one (e.g. a
   *  conference meeting) — not a matching failure. */
  excludedFromMatching: number
  /** Distinct HubSpot leads tied to a booked meeting — this is the "Leads" total shown below. */
  matchedLeads: number
  /** Booked, no HubSpot lead, not excluded — a genuine gap, listed in the table below. */
  unmatched: number
}

/** Explains why "meetings booked" and "leads" differ: some booked conversations are duplicates
 *  of the same person, some are deliberately excluded from lead matching, and the rest either
 *  matched a lead or are a genuine gap. distinct booked keys = excludedFromMatching +
 *  matchedLeads + unmatched, always — each distinct key falls into exactly one bucket. */
export function meetingsBookedBreakdown(
  matches: LeadMatch[],
  conversations: ManagedConversation[],
): MeetingsBookedBreakdown {
  const booked = meetingBookedConversations(conversations)
  const distinctKeys = new Set(booked.map((conversation) => conversationKey(conversation)))
  const matchKeys = new Set(matches.map((match) => match.conversation_key))

  const excludedKeys = new Set(
    booked
      .filter((conversation) => conversation.excluded_from_lead_matching && !matchKeys.has(conversationKey(conversation)))
      .map((conversation) => conversationKey(conversation)),
  )

  return {
    totalBooked: booked.length,
    duplicateConversations: booked.length - distinctKeys.size,
    excludedFromMatching: excludedKeys.size,
    matchedLeads: leadsFromMeetingBooked(matches, conversations).length,
    unmatched: meetingsWithoutLead(matches, conversations).length,
  }
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
