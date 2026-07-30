export type MatchConfidence = 'high' | 'medium'
export type BantValue = 'Yes' | 'No' | 'Maybe' | 'TBD' | null
export type LeadStage = 'Disqualified' | 'Qualified' | 'New'
export type LeadQuality = 'Low' | 'Medium' | 'High' | null
export type DealStage = 'Closed lost' | 'Closed won' | 'Qualified' | 'Proposal' | 'Negotiation'

export interface DealInfo {
  deal_record_id: string
  match_confidence: MatchConfidence
  match_score: number
  deal_stage: DealStage
  amount: number
  close_date: string | null
  is_closed_won: boolean
  is_closed_lost: boolean
  is_open: boolean
  deal_owner: string
}

export interface LeadMatch {
  conversation_key: string
  lead_record_id: string
  match_confidence: MatchConfidence
  match_score: number
  company: string
  authority: BantValue
  budget: BantValue
  need: BantValue
  timeline: BantValue
  bant_disqualification_reasons: string | null
  lead_score: number
  lead_quality: LeadQuality
  lead_stage: LeadStage
  is_open: boolean
  lead_owner: string
  deals: DealInfo[]
}

export type BantTally = Record<'Yes' | 'No' | 'Maybe' | 'TBD' | 'blank', number>

export interface HubspotAggregate {
  leads_by_stage: Record<LeadStage, number>
  leads_by_quality: Record<'Low' | 'Medium' | 'High' | 'blank', number>
  bant_breakdown: Record<'authority' | 'budget' | 'need' | 'timeline', BantTally>
  deals_by_stage: Record<DealStage, number>
  deals_amount_by_stage: Record<DealStage, number>
  total_leads: number
  total_deals: number
}

export interface HubspotData {
  generated_at: string
  matches: LeadMatch[]
  unmatched_leads_count: number
  aggregate: HubspotAggregate
}
