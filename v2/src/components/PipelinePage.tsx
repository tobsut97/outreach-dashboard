import { format, parseISO } from 'date-fns'
import { SortableTableHead } from '@/components/SortableTableHead'
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
  meetingsWithoutLead,
  openLeads,
  qualifiedLeads,
  wonDeals,
  type MatchedDeal,
} from '@/lib/hubspot'
import type { Summary } from '@/lib/metrics'
import { conversationKey, type ManagedConversation } from '@/lib/overrides'
import { sortRows, useSort } from '@/lib/sort'
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
  const meetingsBooked = meetingBookedConversations(conversations)
  const withoutLead = meetingsWithoutLead(matched, conversations)
  const leads = leadsFromMeetingBooked(matched, conversations)

  const open = openLeads(leads)
  const qualified = qualifiedLeads(leads)
  const lost = lostLeads(leads)
  const qualifiedDealRows = dealsInStage(leads, 'Qualified')
  const lostDealRows = lostDeals(leads)
  const wonDealRows = wonDeals(leads)

  return (
    <>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-6">
          <div className="flex items-center gap-4">
            <FunnelOrigin label="Meetings booked" value={meetingsBooked.length} />
            {withoutLead.length > 0 && (
              <div className="border-muted-foreground/30 flex items-center gap-2 border-l pl-4">
                <span className="text-muted-foreground text-xs">
                  {withoutLead.length} never matched a HubSpot lead
                </span>
              </div>
            )}
          </div>

          <FunnelConnector />

          <FunnelCategory label="Leads" total={leads.length}>
            <FunnelNode label="Open" value={open.length} dotClassName="bg-sky-500" />
            <FunnelNode label="Qualified" value={qualified.length} dotClassName="bg-emerald-500" />
            <FunnelNode label="Disqualified" value={lost.length} dotClassName="bg-red-500" />
          </FunnelCategory>

          <FunnelConnector />

          <FunnelCategory label="Deals" total={qualifiedDealRows.length + lostDealRows.length + wonDealRows.length}>
            <FunnelNode
              label="Qualified"
              value={qualifiedDealRows.length}
              sub={currency(dealsAmount(qualifiedDealRows))}
              dotClassName="bg-violet-500"
            />
            <FunnelNode
              label="Lost"
              value={lostDealRows.length}
              sub={currency(dealsAmount(lostDealRows))}
              dotClassName="bg-amber-500"
            />
            <FunnelNode
              label="Won"
              value={wonDealRows.length}
              sub={currency(dealsAmount(wonDealRows))}
              dotClassName="bg-emerald-500"
            />
          </FunnelCategory>
        </CardContent>
      </Card>

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
        title={`Disqualified leads (${lost.length})`}
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

      <MeetingsWithoutLeadTable meetings={withoutLead} onOpenConversation={onOpenConversation} />
    </>
  )
}

/** Custom funnel diagram, not built from shadcn Card/Table — a bordered box with a
 *  fieldset-style overlapping legend label groups each category's nodes, and a vertical
 *  line+arrow connects one category to the next. */
function FunnelOrigin({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-primary/30 bg-primary/5 flex flex-col items-center gap-1 rounded-xl border-2 px-6 py-4">
      <span className="font-kpi text-2xl font-bold tabular-nums">{value}</span>
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</span>
    </div>
  )
}

function FunnelConnector() {
  return (
    <div className="flex flex-col items-center">
      <div className="bg-border h-6 w-px" />
      <div className="border-muted-foreground border-r-2 border-b-2 size-2 rotate-45" />
    </div>
  )
}

function FunnelCategory({
  label,
  total,
  children,
}: {
  label: string
  total: number
  children: React.ReactNode
}) {
  return (
    <div className="relative w-full max-w-2xl rounded-xl border pt-5 pb-4">
      <span className="bg-card text-muted-foreground absolute -top-3 left-4 px-2 text-xs font-semibold tracking-wide uppercase">
        {label} · {total}
      </span>
      <div className="grid grid-cols-3 gap-3 px-4">{children}</div>
    </div>
  )
}

function FunnelNode({
  label,
  value,
  sub,
  dotClassName,
}: {
  label: string
  value: number
  sub?: string
  dotClassName: string
}) {
  return (
    <div className="bg-muted/40 flex flex-col items-center gap-1 rounded-lg px-3 py-3 text-center">
      <span className={`size-1.5 rounded-full ${dotClassName}`} />
      <span className="font-kpi text-lg font-bold tabular-nums">{value}</span>
      <span className="text-muted-foreground text-xs">{label}</span>
      {sub && <span className="text-muted-foreground text-[11px] tabular-nums">{sub}</span>}
    </div>
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
  const [sort, toggleSort] = useSort<'contact' | 'owner'>()
  const sortedLeads = sortRows(leads, sort, (match, key) =>
    key === 'contact'
      ? conversationByKey.get(match.conversation_key)?.full_name || null
      : match.lead_owner || null,
  )

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
                <SortableTableHead label="Contact" sortKey="contact" sort={sort} onToggle={toggleSort} className="w-[30%]" />
                <TableHead className="w-[25%]">BANT</TableHead>
                <SortableTableHead label="Lead owner" sortKey="owner" sort={sort} onToggle={toggleSort} className="w-[20%]" />
                {showDisqualificationReason && <TableHead className="w-[25%]">Disqualified because</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedLeads.map((match) => {
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
  const [sort, toggleSort] = useSort<'contact' | 'amount' | 'closeDate' | 'owner'>()
  const sortedRows = sortRows(rows, sort, ({ lead, deal }, key) => {
    switch (key) {
      case 'contact':
        return conversationByKey.get(lead.conversation_key)?.full_name || null
      case 'amount':
        return deal.amount
      case 'closeDate':
        return deal.close_date ?? null
      case 'owner':
        return deal.deal_owner || null
    }
  })

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
                <SortableTableHead label="Contact" sortKey="contact" sort={sort} onToggle={toggleSort} className="w-[30%]" />
                <SortableTableHead label="Amount" sortKey="amount" sort={sort} onToggle={toggleSort} className="w-[20%]" />
                <SortableTableHead
                  label="Close date"
                  sortKey="closeDate"
                  sort={sort}
                  onToggle={toggleSort}
                  className="w-[20%]"
                />
                <SortableTableHead label="Deal owner" sortKey="owner" sort={sort} onToggle={toggleSort} className="w-[30%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map(({ lead, deal }) => {
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

function MeetingsWithoutLeadTable({
  meetings,
  onOpenConversation,
}: {
  meetings: ManagedConversation[]
  onOpenConversation: (conversation: ManagedConversation) => void
}) {
  const [sort, toggleSort] = useSort<'contact' | 'company' | 'owner'>()
  const sortedMeetings = sortRows(meetings, sort, (conversation, key) => {
    switch (key) {
      case 'contact':
        return conversation.full_name || null
      case 'company':
        return conversation.company || null
      case 'owner':
        return conversation.owner || null
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground text-sm font-semibold">
          Meetings booked with no matching HubSpot lead ({meetings.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {meetings.length === 0 ? (
          <p className="text-muted-foreground text-sm">Every booked meeting has a matching HubSpot lead.</p>
        ) : (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <SortableTableHead label="Contact" sortKey="contact" sort={sort} onToggle={toggleSort} className="w-[35%]" />
                <SortableTableHead label="Company" sortKey="company" sort={sort} onToggle={toggleSort} className="w-[35%]" />
                <SortableTableHead label="Owner" sortKey="owner" sort={sort} onToggle={toggleSort} className="w-[30%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMeetings.map((conversation) => (
                <TableRow
                  key={conversationKey(conversation)}
                  onClick={() => onOpenConversation(conversation)}
                  className="hover:bg-muted/60 cursor-pointer"
                >
                  <TableCell className="align-top whitespace-normal font-medium">{conversation.full_name}</TableCell>
                  <TableCell className="text-muted-foreground align-top whitespace-normal">
                    {conversation.company || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground align-top whitespace-normal">
                    {conversation.owner || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
