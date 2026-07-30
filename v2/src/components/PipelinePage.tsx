import { format, parseISO } from 'date-fns'
import { Handshake, TrendingUp, Users, Wallet } from 'lucide-react'
import { KpiCard } from '@/components/KpiCard'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BANT_TALLY_KEYS, deriveBantBreakdown, deriveHubspotFunnel, primaryDeal } from '@/lib/hubspot'
import type { Summary } from '@/lib/metrics'
import { conversationKey, type ManagedConversation } from '@/lib/overrides'
import type { BantTally, HubspotData, LeadMatch, MatchConfidence } from '@/types/hubspot'

const BANT_LABELS: Record<'authority' | 'budget' | 'need' | 'timeline', string> = {
  authority: 'Authority',
  budget: 'Budget',
  need: 'Need',
  timeline: 'Timeline',
}

const BANT_VALUE_COLOR: Record<keyof BantTally, string> = {
  Yes: 'bg-emerald-500',
  Maybe: 'bg-amber-400',
  No: 'bg-red-400',
  TBD: 'bg-slate-300',
  blank: 'bg-muted',
}

const CONFIDENCE_BADGE: Record<MatchConfidence, { variant: 'default' | 'secondary'; label: string }> = {
  high: { variant: 'default', label: 'High confidence' },
  medium: { variant: 'secondary', label: 'Medium confidence' },
}

const currency = (amount: number) =>
  amount.toLocaleString('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

export function PipelinePage({
  hubspot,
  conversations,
  summary,
  onOpenConversation,
}: {
  hubspot: HubspotData
  conversations: ManagedConversation[]
  summary: Summary
  onOpenConversation: (conversation: ManagedConversation) => void
}) {
  const conversationByKey = new Map(
    conversations.map((conversation) => [conversationKey(conversation), conversation]),
  )
  const keys = new Set(conversationByKey.keys())
  const matched = hubspot.matches.filter((match) => keys.has(match.conversation_key))
  const funnel = deriveHubspotFunnel(conversations, summary, hubspot)
  const bant = deriveBantBreakdown(matched)
  const rows = [...matched].sort((a, b) => b.match_score - a.match_score)

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Leads matched"
          value={funnel.leadsMatchedHigh}
          sub={funnel.leadsMatchedMedium > 0 ? `+${funnel.leadsMatchedMedium} medium-confidence` : null}
          icon={Users}
          iconClassName="text-sky-500"
          badgeClassName="bg-sky-500/10"
        />
        <KpiCard
          label="Deals matched"
          value={funnel.dealsMatched}
          icon={Handshake}
          iconClassName="text-violet-500"
          badgeClassName="bg-violet-500/10"
        />
        <KpiCard
          label="Closed won"
          value={funnel.closedWonCount}
          sub={currency(funnel.closedWonAmount)}
          icon={TrendingUp}
          iconClassName="text-emerald-500"
          badgeClassName="bg-emerald-500/10"
        />
        <KpiCard
          label="Still open"
          value={funnel.stillOpenCount}
          sub={currency(funnel.stillOpenAmount)}
          icon={Wallet}
          iconClassName="text-amber-500"
          badgeClassName="bg-amber-500/10"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground text-sm font-semibold">
            Outreach → lead → deal funnel
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 text-sm">
          <FunnelStep label="Messaged" value={funnel.messaged} />
          <FunnelArrow />
          <FunnelStep label="Replied" value={funnel.replied} />
          <FunnelArrow />
          <FunnelStep label="Leads (high-confidence)" value={funnel.leadsMatchedHigh} />
          <FunnelArrow />
          <FunnelStep label="Deals" value={funnel.dealsMatched} />
          <FunnelArrow />
          <FunnelStep label="Closed won" value={funnel.closedWonCount} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground text-sm font-semibold">
            BANT breakdown (matched leads)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {matched.length === 0 ? (
            <p className="text-muted-foreground text-sm">No leads matched to outreach yet.</p>
          ) : (
            (Object.keys(bant) as (keyof typeof bant)[]).map((field) => (
              <BantRow key={field} label={BANT_LABELS[field]} tally={bant[field]} />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground text-sm font-semibold">
            Matched leads ({rows.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No leads matched to outreach yet.</p>
          ) : (
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[20%]">Contact</TableHead>
                  <TableHead className="w-[10%]">Match</TableHead>
                  <TableHead className="w-[20%]">BANT</TableHead>
                  <TableHead className="w-[12%]">Lead stage</TableHead>
                  <TableHead className="w-[38%]">Deal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((match) => (
                  <LeadRow
                    key={match.lead_record_id}
                    match={match}
                    conversation={conversationByKey.get(match.conversation_key)}
                    onOpenConversation={onOpenConversation}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground text-sm font-semibold">
            HubSpot pipeline totals (all leads/deals, independent of outreach match)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
          <TotalStat label="Total leads" value={hubspot.aggregate.total_leads} />
          <TotalStat label="Total deals" value={hubspot.aggregate.total_deals} />
          <TotalStat
            label="Closed won"
            value={`${hubspot.aggregate.deals_by_stage['Closed won']} · ${currency(hubspot.aggregate.deals_amount_by_stage['Closed won'])}`}
          />
          <TotalStat label="Closed lost" value={hubspot.aggregate.deals_by_stage['Closed lost']} />
        </CardContent>
      </Card>
    </>
  )
}

function FunnelStep({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg border px-3 py-2">
      <span className="font-kpi text-lg font-bold tabular-nums">{value}</span>
      <span className="text-muted-foreground text-xs whitespace-nowrap">{label}</span>
    </div>
  )
}

function FunnelArrow() {
  return <span className="text-muted-foreground text-lg">→</span>
}

function BantRow({ label, tally }: { label: string; tally: BantTally }) {
  const total = BANT_TALLY_KEYS.reduce((sum, key) => sum + tally[key], 0)
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-sm">{label}</span>
      <div className="bg-muted flex h-3 flex-1 overflow-hidden rounded-full">
        {BANT_TALLY_KEYS.map((key) =>
          tally[key] > 0 ? (
            <div
              key={key}
              className={BANT_VALUE_COLOR[key]}
              style={{ width: total ? `${(100 * tally[key]) / total}%` : 0 }}
              title={`${key}: ${tally[key]}`}
            />
          ) : null,
        )}
      </div>
      <span className="text-muted-foreground w-40 shrink-0 text-right text-xs">
        {BANT_TALLY_KEYS.filter((key) => tally[key] > 0)
          .map((key) => `${key} ${tally[key]}`)
          .join(' · ')}
      </span>
    </div>
  )
}

function TotalStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-kpi font-semibold tabular-nums">{value}</span>
    </div>
  )
}

function LeadRow({
  match,
  conversation,
  onOpenConversation,
}: {
  match: LeadMatch
  conversation: ManagedConversation | undefined
  onOpenConversation: (conversation: ManagedConversation) => void
}) {
  const badge = CONFIDENCE_BADGE[match.match_confidence]
  const deal = primaryDeal(match.deals)
  const bantChips = (['authority', 'budget', 'need', 'timeline'] as const)
    .map((field) => ({ label: BANT_LABELS[field][0], value: match[field] }))
    .filter((chip) => chip.value)

  return (
    <TableRow
      onClick={conversation ? () => onOpenConversation(conversation) : undefined}
      className={conversation ? 'hover:bg-muted/60 cursor-pointer' : ''}
    >
      <TableCell className="align-top whitespace-normal">
        <div className="font-medium">{conversation?.full_name || '—'}</div>
        <div className="text-muted-foreground text-xs">{match.company || '—'}</div>
      </TableCell>
      <TableCell className="align-top">
        <Badge variant={badge.variant}>{match.match_confidence}</Badge>
      </TableCell>
      <TableCell className="align-top whitespace-normal">
        {bantChips.length === 0 ? (
          <span className="text-muted-foreground text-xs">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {bantChips.map((chip) => (
              <Badge key={chip.label} variant="outline" className="text-xs font-normal">
                {chip.label}:{chip.value}
              </Badge>
            ))}
          </div>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground align-top whitespace-normal">
        {match.lead_stage}
      </TableCell>
      <TableCell className="align-top whitespace-normal">
        {!deal ? (
          <span className="text-muted-foreground text-xs">No matched deal</span>
        ) : (
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="font-normal">
              {deal.deal_stage}
            </Badge>
            <span className="text-muted-foreground">{currency(deal.amount)}</span>
            {deal.close_date && (
              <span className="text-muted-foreground">{format(parseISO(deal.close_date), 'MMM d, yyyy')}</span>
            )}
            {match.deals.length > 1 && (
              <span className="text-muted-foreground">+{match.deals.length - 1} more</span>
            )}
          </div>
        )}
      </TableCell>
    </TableRow>
  )
}
