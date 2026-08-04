import type { Conversation, Sentiment } from '@/types'

/**
 * Manual corrections to the classifier's output.
 *
 * Edits are stored server-side in a single overrides.json blob (see api/overrides.ts) and
 * layered over data.json at render time, so every browser sees the same state. Keying on
 * profile_url means they survive re-running extract.py. They do not feed back into the
 * pipeline — classify_cache.json still holds the model's original answer, so a re-run will not
 * learn from them.
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

export const conversationKey = (conversation: Conversation) =>
  conversation.profile_url || conversation.email || conversation.full_name

export async function fetchOverrides(): Promise<Overrides> {
  try {
    const response = await fetch('/api/overrides')
    if (!response.ok) return {}
    return (await response.json()) as Overrides
  } catch {
    // Network failure shouldn't take the dashboard down — worst case, edits are momentarily
    // invisible until the next successful fetch.
    return {}
  }
}

export async function saveOverrides(overrides: Overrides): Promise<void> {
  const response = await fetch('/api/overrides', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(overrides),
  })
  if (!response.ok) {
    throw new Error(`Failed to save overrides: ${response.status}`)
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
