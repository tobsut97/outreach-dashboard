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

// A profile's owner string is often just a placeholder guess (e.g. 'Lara' rather than her
// real LinkedIn name) until their CSV is actually uploaded, at which point extract.py's
// owner-detection (server.py) discovers the real name. This override — the same
// localStorage-layering pattern as lib/overrides.ts — lets that discovery correct the
// mapping at runtime instead of requiring a source edit.
const OWNER_OVERRIDES_KEY = 'outreach-dashboard.profile-owners.v1'

function loadOwnerOverrides(): Partial<Record<ProfileName, string>> {
  try {
    const raw = localStorage.getItem(OWNER_OVERRIDES_KEY)
    return raw ? (JSON.parse(raw) as Partial<Record<ProfileName, string>>) : {}
  } catch {
    return {}
  }
}

export function saveProfileOwner(profile: ProfileName, owner: string): void {
  try {
    const current = loadOwnerOverrides()
    localStorage.setItem(OWNER_OVERRIDES_KEY, JSON.stringify({ ...current, [profile]: owner }))
  } catch {
    // Private browsing or a full quota — the mapping still applies for this session.
  }
}

export const profileOwner = (name: ProfileName) =>
  loadOwnerOverrides()[name] ?? PROFILES.find((entry) => entry.name === name)?.owner ?? null

export const answerSentiment = (name: AnswerName) =>
  ANSWERS.find((entry) => entry.name === name)?.sentiment ?? 'all'
