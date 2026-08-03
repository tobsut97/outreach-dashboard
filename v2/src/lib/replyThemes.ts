/** Fine-grained categorization of what negative/neutral contacts actually replied, distinct
 * from the coarser ALLOWED_TAGS in sentiment.ts. Classified directly by Claude (see notes.md),
 * not by extract.py's Ollama pipeline — re-running extract.py won't reproduce this field. */
export const REPLY_THEME_LABELS: Record<string, string> = {
  generic_decline: 'Generic decline, no reason given',
  reduction_not_offsetting: 'Prefers reduction over offsetting',
  own_climate_project: 'Already runs own climate project',
  works_with_competitor: 'Already works with a competitor',
  already_certified_reported: 'Already certified / reports on it',
  no_own_footprint_to_offset: 'Too small / no own footprint',
  budget_constraint: 'Budget constraint',
  too_busy_no_capacity: 'Too busy, no capacity',
  revisit_later: 'Open to revisit later',
  still_building_strategy: 'Still building their strategy',
  not_the_decision_maker: 'Not the decision maker',
  leaving_company: 'Leaving the company',
  new_role_not_responsible: 'New role, not responsible anymore',
  on_leave: 'On leave',
  referred_named_contact: 'Referred to a named contact',
  already_in_contact_with_colleague: 'Already in contact with a colleague',
  asked_clarifying_question: 'Asked a clarifying question',
  off_topic_unrelated: 'Off-topic / unrelated reply',
  ack_no_content: 'Acknowledgment only, no content',
  hard_no_carbon_credits: 'Hard no to carbon credits',
  other_unclear: 'Other / unclear',
}

export const REPLY_THEME_IDS = Object.keys(REPLY_THEME_LABELS)

export const replyThemeLabel = (id: string) => REPLY_THEME_LABELS[id] ?? id
