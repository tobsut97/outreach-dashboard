/**
 * Groups the free-text job titles LinkedHelper exports (no normalization upstream — see
 * extract.py) into a small set of role categories, inferred by keyword from the actual titles
 * seen across the ingested CSVs (e.g. "Geschäftsführer", "Nachhaltigkeitsmanagerin",
 * "Chief Sustainability Officer" all landing in one bucket). Titles that don't match any
 * category are returned unchanged, so they still show up individually until they're common
 * enough to earn their own bar, or fall into "Other" alongside the rest of the long tail.
 */
const foldUmlauts = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')

const CATEGORIES: [label: string, patterns: RegExp[]][] = [
  [
    'Sustainability / ESG',
    [/sustainab/, /nachhaltig/, /\besg\b/, /\bcsr\b/, /klimaschutz/, /climate/, /corporate responsibility/, /environmental/],
  ],
  ['Finance', [/\bcfo\b/, /chief financial/, /finance/, /finanz/, /controlling/, /treasury/]],
  [
    'Executive / Managing Director',
    [
      /\bceo\b/,
      /geschaftsfuhrer/,
      /managing director/,
      /chief executive/,
      /\bfounder\b/,
      /grunder/,
      /vorstand/,
      /\bowner\b/,
      /inhaber/,
      /\bpartner\b/,
      /\bpresident\b/,
    ],
  ],
  ['Marketing / Communications', [/marketing/, /communications/, /kommunikation/, /\bbrand\b/, /\bpr\b/]],
  [
    'HR / People',
    [/\bhr\b/, /human resources/, /personal/, /people & organisation/, /people and organisation/, /recruiting/, /\btalent\b/],
  ],
  ['Operations', [/\bcoo\b/, /chief operating/, /operations/, /operativ/]],
  ['Sales / Business Development', [/\bsales\b/, /vertrieb/, /business development/, /account manager/, /account executive/]],
  ['Procurement / Supply Chain', [/procurement/, /einkauf/, /supply chain/, /logistik/, /logistics/]],
  ['Legal / Compliance', [/\blegal\b/, /compliance/, /\brecht/, /jurist/]],
  ['IT / Technology', [/\bcto\b/, /chief technology/, /\bit\b/, /software/, /\bengineer/]],
  ['Consulting', [/consultant/, /berater/, /consulting/]],
]

export function categorizePosition(raw: string): string {
  const folded = foldUmlauts(raw)
  for (const [label, patterns] of CATEGORIES) {
    if (patterns.some((pattern) => pattern.test(folded))) return label
  }
  return raw
}
