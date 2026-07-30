export type ProfileName =
  | 'Overview'
  | 'Christian'
  | 'Lara'
  | 'Chrissy'
  | 'Leos'
  | 'Max'
  | 'Caro'

/**
 * `owner` is matched against `conversation.owner`, which is set to the full name of the
 * export's account owner. `null` means "no filter".
 *
 * Only Christian's, Chrissy's, Max's, Lara's, and Leos's exports have been ingested so
 * far. The rest are placeholders and match nothing until their CSV is processed — at
 * which point the `owner` here has to match the full name used in that conversation data.
 */
export const PROFILES: { name: ProfileName; owner: string | null }[] = [
  { name: 'Overview', owner: null },
  { name: 'Christian', owner: 'Christian Lutz' },
  { name: 'Lara', owner: 'Lara Ebert' },
  { name: 'Chrissy', owner: 'Christine Rzepka' },
  { name: 'Leos', owner: 'Leos Bloch' },
  { name: 'Max', owner: 'Maximilian Venhofen' },
  { name: 'Caro', owner: 'Caro' },
]

export const profileOwner = (name: ProfileName) =>
  PROFILES.find((entry) => entry.name === name)?.owner ?? null
