import { format, parseISO } from 'date-fns'
import { Ban, CircleCheck, Handshake, XCircle } from 'lucide-react'
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
import { dealsInStage, lostDeals, lostLeads, matchedLeads, qualifiedLeads, type MatchedDeal } from '@/lib/hubspot'
import type { Summary } from '@/lib/metrics'
import { conversationKey, type ManagedConversation } from '@/lib/overrides'
import type { HubspotData, LeadMatch, MatchConfidence } from '@/types/hubspot'

const BANT_LABELS: Record<'authority' | 'budget' | 'need' | 'timeline', string> = {
  authority: 'Authority',
  budget: 'Budget',
  need: 'Need',
  timeline: 'Timeline',
}

const CONFIDENCE_BADGE: Record<MatchConfidence, { variant: 'default' | 'secondary'; label: string }> = {
  high: { variant: 'default', label: 'High confidence' },
  medium: { variant: 'secondary', label: 'Medium confidence' },
}

const currency = (amount: number) =>
  amount.toLocaleString('en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })

const dealsAmount = (deals: MatchedDeal[]) => deals.reduce((sum, { deal }) => sum + deal.amount, 0)

function bantChips(match: LeadMatch) {
  return (['authority', 'budget', 'need', 'timeline'] as const)
    .map((field) => ({ label: BANT_LABELS[field][0], value: match[field] }))
    .filter((chip) => chip.value)
}

export function PipelinePage({
  hubspot,
  conversations,
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
  const matched = matchedLeads(conversations, hubspot)
  const qualified = qualifiedLeads(matched)
  const lost = lostLeads(matched)
  const qualifiedDealRows = dealsInStage(matched, 'Qualified')
  const lostDealRows = lostDeals(matched)

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Qualified leads"
          value={qualified.length}
          icon={CircleCheck}
          iconClassName="text-emerald-500"
          badgeClassName="bg-emerald-500/10"
        />
        <KpiCard
          label="Lost leads"
          value={lost.length}
          icon={XCircle}
          iconClassName="text-red-500"
          badgeClassName="bg-red-500/10"
        />
        <KpiCard
          label="Qualified deals"
          value={qualifiedDealRows.length}
          sub={currency(dealsAmount(qualifiedDealRows))}
          icon={Handshake}
          iconClassName="text-sky-500"
          badgeClassName="bg-sky-500/10"
        />
        <KpiCard
          label="Lost deals"
          value={lostDealRows.length}
          sub={currency(dealsAmount(lostDealRows))}
          icon={Ban}
          iconClassName="text-amber-500"
          badgeClassName="bg-amber-500/10"
        />
      </div>

      <LeadTable
        title={`Qualified leads (${qualified.length})`}
        leads={qualified}
        conversationByKey={conversationByKey}
        onOpenConversation={onOpenConversation}
        showDisqualificationReason={false}
      />

      <LeadTable
        title={`Lost leads (${lost.length})`}
        leads={lost}
        conversationByKey={conversationByKey}
        onOpenConversation={onOpenConversation}
        showDisqualificationReason
      />

      <DealTable
        title={`Qualified deals (${qualifiedDealRows.length})`}
        rows={qualifiedDealRows}
        conversationByKey={conversationByKey}
        onOpenConversation={onOpenConversation}
      />

      <DealTable
        title={`Lost deals (${lostDealRows.length})`}
        rows={lostDealRows}
        conversationByKey={conversationByKey}
        onOpenConversation={onOpenConversation}
      />
    </>
  )
}

function LeadTable({
  title,
  leads,
  conversationByKey,
  onOpenConversation,
  showDisqualificationReason,
}: {
  title: string
  leads: LeadMatch[]
  conversationByKey: Map<string, ManagedConversation>
  onOpenConversation: (conversation: ManagedConversation) => void
  showDisqualificationReason: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {leads.length === 0 ? (
          <p className="text-muted-foreground text-sm">None in the current filters.</p>
        ) : (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[25%]">Contact</TableHead>
                <TableHead className="w-[12%]">Match</TableHead>
                <TableHead className="w-[20%]">BANT</TableHead>
                <TableHead className="w-[15%]">Lead owner</TableHead>
                {showDisqualificationReason && <TableHead className="w-[28%]">Disqualified because</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((match) => {
                const conversation = conversationByKey.get(match.conversation_key)
                const badge = CONFIDENCE_BADGE[match.match_confidence]
                const chips = bantChips(match)
                return (
                  <TableRow
                    key={match.lead_record_id}
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
                      {chips.length === 0 ? (
                        <span className="text-muted-foreground text-xs">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {chips.map((chip) => (
                            <Badge key={chip.label} variant="outline" className="text-xs font-normal">
                              {chip.label}:{chip.value}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground align-top whitespace-normal">
                      {match.lead_owner || '—'}
                    </TableCell>
                    {showDisqualificationReason && (
                      <TableCell className="text-muted-foreground align-top whitespace-normal">
                        {match.bant_disqualification_reasons || '—'}
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function DealTable({
  title,
  rows,
  conversationByKey,
  onOpenConversation,
}: {
  title: string
  rows: MatchedDeal[]
  conversationByKey: Map<string, ManagedConversation>
  onOpenConversation: (conversation: ManagedConversation) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">None in the current filters.</p>
        ) : (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[25%]">Contact</TableHead>
                <TableHead className="w-[15%]">Amount</TableHead>
                <TableHead className="w-[15%]">Close date</TableHead>
                <TableHead className="w-[15%]">Deal owner</TableHead>
                <TableHead className="w-[12%]">Match</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ lead, deal }) => {
                const conversation = conversationByKey.get(lead.conversation_key)
                const badge = CONFIDENCE_BADGE[deal.match_confidence]
                return (
                  <TableRow
                    key={deal.deal_record_id}
                    onClick={conversation ? () => onOpenConversation(conversation) : undefined}
                    className={conversation ? 'hover:bg-muted/60 cursor-pointer' : ''}
                  >
                    <TableCell className="align-top whitespace-normal">
                      <div className="font-medium">{conversation?.full_name || '—'}</div>
                      <div className="text-muted-foreground text-xs">{lead.company || '—'}</div>
                    </TableCell>
                    <TableCell className="align-top whitespace-normal">{currency(deal.amount)}</TableCell>
                    <TableCell className="text-muted-foreground align-top whitespace-normal">
                      {deal.close_date ? format(parseISO(deal.close_date), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground align-top whitespace-normal">
                      {deal.deal_owner || '—'}
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant={badge.variant}>{deal.match_confidence}</Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
