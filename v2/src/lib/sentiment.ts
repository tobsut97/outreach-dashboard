import type { Sentiment } from '@/types'

export const SENTIMENT_ORDER: Sentiment[] = ['positive', 'neutral', 'negative']

export const SENTIMENT_LABELS: Record<Sentiment, string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
}

export const DOT_COLOR: Record<Sentiment, string> = {
  positive: 'bg-emerald-500',
  neutral: 'bg-slate-400',
  negative: 'bg-red-400',
}

export const BAR_COLOR: Record<Sentiment, string> = {
  positive: 'bg-emerald-500',
  neutral: 'bg-slate-400',
  negative: 'bg-red-400',
}

// Literal classes, not runtime concatenation — Tailwind only emits what it can see.
export const TAG_BAR_COLOR: Record<Sentiment, string> = {
  positive: 'bg-emerald-500/40',
  neutral: 'bg-slate-400/40',
  negative: 'bg-red-400/40',
}

// Vocabulary is fixed by ALLOWED_TAGS in extract.py.
export const TAG_LABELS: Record<string, string> = {
  meeting_booked: 'Meeting booked',
  open_to_call: 'Open to call',
  referred_colleague: 'Referred a colleague',
  future_timing: 'Better timing later',
  has_existing_solution: 'Has existing solution',
  no_budget: 'No budget',
  not_relevant: 'Not relevant',
  role_change: 'Changed role',
  no_reason_given: 'No reason given',
  unclear: 'Unclear',
}

/** Mirrors ALLOWED_TAGS in extract.py — keep the two in step. */
export const ALLOWED_TAGS = Object.keys(TAG_LABELS)

/** A reply carries at most this many reasons, matching the classifier's constraint. */
export const MAX_TAGS = 2

export const tagLabel = (tag: string) => TAG_LABELS[tag] ?? tag
