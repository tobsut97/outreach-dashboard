import { Lightbulb } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Finding } from '@/lib/findings'
import { DOT_COLOR } from '@/lib/sentiment'

export function InsightsCallout({
  findings,
  activeId,
  onSelect,
}: {
  findings: Finding[]
  activeId: string | null
  onSelect: (finding: Finding) => void
}) {
  if (findings.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
          <Lightbulb className="size-3.5" />
          Main findings
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {findings.map((finding) => (
          <button
            key={finding.id}
            type="button"
            onClick={() => onSelect(finding)}
            aria-pressed={activeId === finding.id}
            className={`hover:bg-muted focus-visible:ring-ring/50 -mx-2 flex items-start gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-3 ${
              activeId === finding.id ? 'bg-muted' : ''
            }`}
          >
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT_COLOR[finding.sentiment]}`}
            />
            <span>{finding.summary}</span>
          </button>
        ))}
        <p className="text-muted-foreground text-xs">
          Select a finding to see the conversations behind it in the sidebar.
        </p>
      </CardContent>
    </Card>
  )
}
