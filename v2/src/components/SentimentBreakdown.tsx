import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Summary } from '@/lib/metrics'
import type { ManagedConversation } from '@/lib/overrides'
import { BAR_COLOR, DOT_COLOR, SENTIMENT_LABELS, SENTIMENT_ORDER, tagLabel } from '@/lib/sentiment'
import type { Conversation, Sentiment } from '@/types'

const firstReply = (conversation: Conversation) =>
  conversation.messages.find((message) => message.sender === 'prospect')

const RECENT_COUNT = 5

export function SentimentBreakdown({
  summary,
  conversations,
  onSelect,
  onOpenConversation,
}: {
  summary: Summary
  conversations: ManagedConversation[]
  onSelect: (sentiment: Sentiment) => void
  onOpenConversation: (conversation: ManagedConversation) => void
}) {
  const [expanded, setExpanded] = useState<Sentiment | null>(null)
  const total = Object.values(summary.sentiment_counts).reduce((a, b) => a + (b ?? 0), 0)

  const recentBySentiment = (sentiment: Sentiment) =>
    conversations
      .filter((conversation) => conversation.sentiment === sentiment)
      .sort((a, b) => (firstReply(b)?.date ?? '').localeCompare(firstReply(a)?.date ?? ''))
      .slice(0, RECENT_COUNT)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Answer sentiment
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {total === 0 ? (
          <p className="text-muted-foreground text-sm">No replies classified yet.</p>
        ) : (
          SENTIMENT_ORDER.map((sentiment) => {
            const count = summary.sentiment_counts[sentiment] ?? 0
            const share = summary.sentiment_share[sentiment] ?? 0
            const isExpanded = expanded === sentiment

            return (
              <div key={sentiment} className="flex flex-col">
                <button
                  type="button"
                  disabled={count === 0}
                  onClick={() => setExpanded(isExpanded ? null : sentiment)}
                  aria-expanded={isExpanded}
                  aria-label={`${SENTIMENT_LABELS[sentiment]} answers — expand`}
                  className="hover:bg-muted focus-visible:ring-ring/50 -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_COLOR[sentiment]}`} />
                  <span className="w-20 shrink-0 text-sm">{SENTIMENT_LABELS[sentiment]}</span>
                  <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                    <div
                      className={`h-full rounded-full ${BAR_COLOR[sentiment]}`}
                      style={{ width: `${share}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground w-10 shrink-0 text-right text-sm tabular-nums">
                    {count}
                  </span>
                  <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums">
                    {share}%
                  </span>
                  <ChevronRight
                    className={`text-muted-foreground size-4 shrink-0 transition-transform ${
                      isExpanded ? 'rotate-90' : ''
                    }`}
                  />
                </button>
                <div
                  className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                    isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  }`}
                >
                  <div
                    className={`overflow-hidden transition-opacity duration-300 ease-out ${
                      isExpanded ? 'opacity-100 delay-100' : 'opacity-0'
                    }`}
                  >
                    <div className="mb-2 flex flex-col gap-3 px-2 pt-1">
                      <Table className="table-fixed">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[20%]">Name</TableHead>
                          <TableHead className="w-[22%]">Tags</TableHead>
                          <TableHead className="w-[17%] whitespace-nowrap">Date</TableHead>
                          <TableHead className="w-[37%]">Preview</TableHead>
                          <TableHead className="w-[4%]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentBySentiment(sentiment).map((conversation) => {
                          const reply = firstReply(conversation)
                          return (
                            <TableRow
                              key={conversation.profile_url || conversation.full_name}
                              onClick={() => onOpenConversation(conversation)}
                              className="hover:bg-muted/60 cursor-pointer"
                            >
                              <TableCell className="align-top font-medium whitespace-normal">
                                {conversation.full_name || 'Unknown'}
                              </TableCell>
                              <TableCell className="align-top whitespace-normal">
                                <div className="flex flex-wrap gap-1">
                                  {conversation.tags.length === 0 ? (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  ) : (
                                    conversation.tags.map((tag) => (
                                      <Badge
                                        key={tag}
                                        variant="secondary"
                                        className="whitespace-nowrap"
                                      >
                                        {tagLabel(tag)}
                                      </Badge>
                                    ))
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground align-top overflow-hidden text-ellipsis whitespace-nowrap tabular-nums">
                                {reply ? format(parseISO(reply.date), 'MMM d, yyyy') : '—'}
                              </TableCell>
                              <TableCell className="text-muted-foreground align-top whitespace-normal">
                                <p className="line-clamp-2 break-words" title={reply?.text ?? ''}>
                                  {reply?.text ?? '—'}
                                </p>
                              </TableCell>
                              <TableCell className="align-top">
                                <ChevronRight className="text-muted-foreground size-4" />
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                      </Table>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-fit justify-start"
                        onClick={() => onSelect(sentiment)}
                      >
                        Show all {SENTIMENT_LABELS[sentiment]} answers
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
