import { format, parseISO } from 'date-fns'
import { Ban, Circle, CircleCheck, Handshake, MessageSquareHeart, TrendingUp, XCircle } from 'lucide-react'
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
import {
  dealsInStage,
  leadsFromMeetingBooked,
  lostDeals,
  lostLeads,
  matchedLeads,
  meetingBookedConversations,
  openLeads,
  qualifiedLeads,
  wonDeals,
  type MatchedDeal,
} from '@/lib/hubspot'
import type { Summary } from '@/lib/metrics'
import { conversationKey, type ManagedConversation } from '@/lib/overrides'
import type { LeadMatch, HubspotData } from '@/types/hubspot'

const BANT_LABELS: Record<'authority' | 'budget' | 'need' | 'timeline', string> = {
  authority: 'Authority',
  budget: 'Budget',
  need: 'Need',
  timeline: 'Timeline',
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
  const open = openLeads(matched)
  const qualified = qualifiedLeads(matched)
  const lost = lostLeads(matched)
  const qualifiedDealRows = dealsInStage(matched, 'Qualified')
  const lostDealRows = lostDeals(matched)
  const wonDealRows = wonDeals(matched)

  const meetingsBooked = meetingBookedConversations(conversations)
  const leadsFromMeetings = leadsFromMeetingBooked(matched, conversations)
  const qualifiedFromMeetings = qualifiedLeads(leadsFromMeetings)
  const dealsFromMeetings = leadsFromMeetings.flatMap((lead) => lead.deals)
  const wonFromMeetings = dealsFromMeetings.filter((deal) => deal.is_closed_won)

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground text-sm font-semibold">
            Meeting booked → lead → deal
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 text-sm">
          <FunnelStep label="Meetings booked" value={meetingsBooked.length} />
          <FunnelArrow />
          <FunnelStep label="Became a lead" value={leadsFromMeetings.length} />
          <FunnelArrow />
          <FunnelStep label="Qualified" value={qualifiedFromMeetings.length} />
          <FunnelArrow />
          <FunnelStep label="Became a deal" value={dealsFromMeetings.length} />
          <FunnelArrow />
          <FunnelStep label="Won" value={wonFromMeetings.length} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Meetings booked"
          value={meetingsBooked.length}
          icon={MessageSquareHeart}
          iconClassName="text-pink-500"
          badgeClassName="bg-pink-500/10"
        />
        <KpiCard
          label="Open leads"
          value={open.length}
          icon={Circle}
          iconClassName="text-sky-500"
          badgeClassName="bg-sky-500/10"
        />
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
          iconClassName="text-violet-500"
          badgeClassName="bg-violet-500/10"
        />
        <KpiCard
          label="Lost deals"
          value={lostDealRows.length}
          sub={currency(dealsAmount(lostDealRows))}
          icon={Ban}
          iconClassName="text-amber-500"
          badgeClassName="bg-amber-500/10"
        />
        <KpiCard
          label="Won deals"
          value={wonDealRows.length}
          sub={currency(dealsAmount(wonDealRows))}
          icon={TrendingUp}
          iconClassName="text-emerald-500"
          badgeClassName="bg-emerald-500/10"
        />
      </div>

      <LeadTable
        title={`Open leads (${open.length})`}
        leads={open}
        conversationByKey={conversationByKey}
        onOpenConversation={onOpenConversation}
        showDisqualificationReason={false}
      />

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

      <DealTable
        title={`Won deals (${wonDealRows.length})`}
        rows={wonDealRows}
        conversationByKey={conversationByKey}
        onOpenConversation={onOpenConversation}
      />
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
                <TableHead className="w-[30%]">Contact</TableHead>
                <TableHead className="w-[25%]">BANT</TableHead>
                <TableHead className="w-[20%]">Lead owner</TableHead>
                {showDisqualificationReason && <TableHead className="w-[25%]">Disqualified because</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((match) => {
                const conversation = conversationByKey.get(match.conversation_key)
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
                <TableHead className="w-[30%]">Contact</TableHead>
                <TableHead className="w-[20%]">Amount</TableHead>
                <TableHead className="w-[20%]">Close date</TableHead>
                <TableHead className="w-[30%]">Deal owner</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ lead, deal }) => {
                const conversation = conversationByKey.get(lead.conversation_key)
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
