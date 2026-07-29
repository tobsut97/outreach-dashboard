import type { Sentiment } from '@/types'

export type ProfileName =
  | 'Show All'
  | 'Christian'
  | 'Lara'
  | 'Chrissy'
  | 'Leos'
  | 'Max'
  | 'Caro'
  | 'Gesa'

export type AnswerName = 'Show All' | 'Positive' | 'Neutral' | 'Negative'

/**
 * `owner` is matched against `conversation.owner`, which extract.py sets from the `owner`
 * field of its `SOURCES` entry. `null` means "no filter".
 *
 * Only Christian's export has been ingested so far. The rest are placeholders and match
 * nothing until their CSV is added to `SOURCES` — at which point the `owner` here has to
 * match the full name used there.
 */
export const PROFILES: { name: ProfileName; owner: string | null }[] = [
  { name: 'Show All', owner: null },
  { name: 'Christian', owner: 'Christian Lutz' },
  { name: 'Lara', owner: 'Lara' },
  { name: 'Chrissy', owner: 'Chrissy' },
  { name: 'Leos', owner: 'Leos' },
  { name: 'Max', owner: 'Max' },
  { name: 'Caro', owner: 'Caro' },
  { name: 'Gesa', owner: 'Gesa' },
]

export const ANSWERS: { name: AnswerName; sentiment: Sentiment | 'all' }[] = [
  { name: 'Show All', sentiment: 'all' },
  { name: 'Positive', sentiment: 'positive' },
  { name: 'Neutral', sentiment: 'neutral' },
  { name: 'Negative', sentiment: 'negative' },
]

export const profileOwner = (name: ProfileName) =>
  PROFILES.find((entry) => entry.name === name)?.owner ?? null

export const answerSentiment = (name: AnswerName) =>
  ANSWERS.find((entry) => entry.name === name)?.sentiment ?? 'all'
