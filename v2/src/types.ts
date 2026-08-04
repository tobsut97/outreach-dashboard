export type Sentiment = 'positive' | 'negative' | 'neutral'

export interface Message {
  sender: 'owner' | 'prospect'
  sender_name: string
  date: string
  text: string
}

export interface Conversation {
  profile_url: string
  full_name: string
  email: string
  company: string
  position: string
  connected_at: string
  owner: string
  messages: Message[]
  replied: boolean
  sentiment: Sentiment | null
  tags: string[]
  reply_theme: string | null
  /** Booked meetings that were never going to have a HubSpot lead in the first place (e.g.
   *  conference/event meetings), so the funnel's "never matched a HubSpot lead" count shouldn't
   *  treat them as a matching failure. */
  excluded_from_lead_matching?: boolean
}

export interface DashboardData {
  conversations: Conversation[]
  daily: {
    sent: Record<string, number>
    received: Record<string, number>
  }
  summary: {
    total_messaged: number
    total_replied: number
    reply_rate: number
    sentiment_counts: Partial<Record<Sentiment, number>>
    sentiment_share: Partial<Record<Sentiment, number>>
  }
}
