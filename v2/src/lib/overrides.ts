import type { Conversation, Sentiment } from '@/types'

/**
 * Manual corrections to the classifier's output.
 *
 * The dashboard is a static build with no backend, so edits live in localStorage and are
 * layered over data.json at render time. Keying on profile_url means they survive re-running
 * extract.py. They do not feed back into the pipeline — classify_cache.json still holds the
 * model's original answer, so a re-run will not learn from them.
 */
export interface ConversationOverride {
  sentiment?: Sentiment
  tags?: string[]
  irrelevant?: boolean
}

export type Overrides = Record<string, ConversationOverride>

/** A conversation with any manual correction applied. */
export type ManagedConversation = Conversation & {
  irrelevant: boolean
  edited: boolean
}

const STORAGE_KEY = 'outreach-dashboard.overrides.v1'

export const conversationKey = (conversation: Conversation) =>
  conversation.profile_url || conversation.email || conversation.full_name

export function loadOverrides(): Overrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Overrides) : {}
  } catch {
    // Corrupt or unavailable storage shouldn't take the dashboard down with it.
    return {}
  }
}

export function persistOverrides(overrides: Overrides): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  } catch {
    // Private browsing or a full quota — the edit still applies for this session.
  }
}

export function applyOverrides(
  conversations: Conversation[],
  overrides: Overrides,
): ManagedConversation[] {
  return conversations.map((conversation) => {
    const override = overrides[conversationKey(conversation)]
    if (!override) {
      return { ...conversation, irrelevant: false, edited: false }
    }
    return {
      ...conversation,
      sentiment: override.sentiment ?? conversation.sentiment,
      tags: override.tags ?? conversation.tags,
      irrelevant: override.irrelevant ?? false,
      edited: true,
    }
  })
}
