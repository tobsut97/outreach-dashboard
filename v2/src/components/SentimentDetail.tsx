import { format, parseISO } from 'date-fns'
import { ExternalLink, MessageSquareReply, Percent, Tags } from 'lucide-react'
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
import { KpiCard } from '@/components/KpiCard'
import { oneDecimal, type Summary } from '@/lib/metrics'
import type { ManagedConversation } from '@/lib/overrides'
import {
  SENTIMENT_BADGE_COLOR,
  SENTIMENT_ICON_COLOR,
  SENTIMENT_LABELS,
  TAG_BAR_COLOR,
  tagLabel,
} from '@/lib/sentiment'
import type { Conversation, Sentiment } from '@/types'

const firstReply = (conversation: Conversation) =>
  conversation.messages.find((message) => message.sender === 'prospect')

export function SentimentDetail({
  sentiment,
  conversations,
  summary,
  onOpenConversation,
}: {
  sentiment: Sentiment
  conversations: ManagedConversation[]
  summary: Summary
  onOpenConversation: (conversation: ManagedConversation) => void
}) {
  const rows = conversations
    .filter((conversation) => conversation.sentiment === sentiment)
    .sort((a, b) => (firstReply(b)?.date ?? '').localeCompare(firstReply(a)?.date ?? ''))

  // Metrics exclude conversations marked irrelevant, so the counts here must too. They stay
  // in the table, dimmed, or marking one would hide it beyond any way of undoing it.
  const active = rows.filter((conversation) => !conversation.irrelevant)
  const hidden = rows.length - active.length
  const share = summary.sentiment_share[sentiment] ?? 0
  const reasons = Object.entries(summary.tag_counts[sentiment] ?? {}).sort((a, b) => b[1] - a[1])

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label={`${SENTIMENT_LABELS[sentiment]} answers`}
          value={active.length}
          icon={MessageSquareReply}
          iconClassName={SENTIMENT_ICON_COLOR[sentiment]}
          badgeClassName={SENTIMENT_BADGE_COLOR[sentiment]}
        />
        <KpiCard
          label="Share of all replies"
          value={`${share}%`}
          icon={Percent}
          iconClassName="text-muted-foreground"
          badgeClassName="bg-muted-foreground/10"
        />
        <KpiCard
          label="Reasons identified"
          value={reasons.length}
          icon={Tags}
          iconClassName="text-sky-500"
          badgeClassName="bg-sky-500/10"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Why
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {reasons.length === 0 ? (
            <p className="text-muted-foreground text-sm">No reasons tagged.</p>
          ) : (
            <>
              {reasons.map(([tag, tagCount]) => {
                const tagShare = oneDecimal(tagCount, active.length)
                return (
                  <div key={tag} className="flex items-center gap-3">
                    <span className="w-44 shrink-0 text-sm">{tagLabel(tag)}</span>
                    <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                      <div
                        className={`h-full rounded-full ${TAG_BAR_COLOR[sentiment]}`}
                        style={{ width: `${Math.min(tagShare, 100)}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground w-10 shrink-0 text-right text-sm tabular-nums">
                      {tagCount}
                    </span>
                    <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums">
                      {tagShare}%
                    </span>
                  </div>
                )
              })}
              <p className="text-muted-foreground text-xs">
                A reply can carry up to two reasons, so these shares don't sum to 100%.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Conversations ({active.length})
            {hidden > 0 && (
              <span className="ml-2 font-normal normal-case">
                + {hidden} marked irrelevant
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* table-fixed: without it the column percentages below are only hints, and long
              reply text blows the table out to thousands of pixels wide. */}
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No conversations in this category.</p>
          ) : (
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[20%]">Name</TableHead>
                  <TableHead className="w-[18%]">Company</TableHead>
                  <TableHead className="w-[9%] whitespace-nowrap">Replied</TableHead>
                  <TableHead className="w-[18%]">Reasons</TableHead>
                  <TableHead className="w-[35%]">Their reply</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((conversation) => {
                  const reply = firstReply(conversation)
                  return (
                    <TableRow
                      key={conversation.profile_url || conversation.full_name}
                      onClick={() => onOpenConversation(conversation)}
                      className={`hover:bg-muted/60 cursor-pointer ${
                        conversation.irrelevant ? 'opacity-45' : ''
                      }`}
                    >
                      {/* TableCell defaults to whitespace-nowrap, which would clip the reply
                          text and let long company names collide with the next column. */}
                      <TableCell className="align-top font-medium whitespace-normal">
                        {conversation.profile_url ? (
                          <a
                            href={conversation.profile_url}
                            target="_blank"
                            rel="noreferrer"
                            // Otherwise opening LinkedIn would also open the sheet.
                            onClick={(event) => event.stopPropagation()}
                            className="hover:text-primary inline-flex items-center gap-1 hover:underline"
                          >
                            {conversation.full_name || '—'}
                            <ExternalLink className="size-3 shrink-0" />
                          </a>
                        ) : (
                          (conversation.full_name || '—')
                        )}
                        {conversation.position && (
                          <div className="text-muted-foreground text-xs font-normal">
                            {conversation.position}
                          </div>
                        )}
                        <div className="mt-1 flex flex-wrap gap-1">
                          {conversation.irrelevant && (
                            <Badge variant="outline" className="text-xs font-normal">
                              Irrelevant
                            </Badge>
                          )}
                          {conversation.edited && !conversation.irrelevant && (
                            <Badge variant="outline" className="text-xs font-normal">
                              Edited
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground align-top break-words whitespace-normal">
                        {conversation.company || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground align-top whitespace-nowrap tabular-nums">
                        {reply ? format(parseISO(reply.date), 'MMM d, yyyy') : '—'}
                      </TableCell>
                      <TableCell className="align-top whitespace-normal">
                        <div className="flex flex-wrap gap-1">
                          {conversation.tags.length === 0 ? (
                            <span className="text-muted-foreground text-xs">—</span>
                          ) : (
                            conversation.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="whitespace-nowrap">
                                {tagLabel(tag)}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground align-top whitespace-normal">
                        <p className="line-clamp-3 break-words" title={reply?.text ?? ''}>
                          {reply?.text ?? '—'}
                        </p>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}
