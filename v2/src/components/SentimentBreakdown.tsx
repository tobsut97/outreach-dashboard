import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Summary } from '@/lib/metrics'
import type { ManagedConversation } from '@/lib/overrides'
import { BAR_COLOR, DOT_COLOR, SENTIMENT_LABELS, SENTIMENT_ORDER } from '@/lib/sentiment'
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
                {isExpanded && (
                  <div className="mb-2 ml-5 flex flex-col gap-1 border-l pl-4">
                    {recentBySentiment(sentiment).map((conversation) => {
                      const reply = firstReply(conversation)
                      return (
                        <button
                          key={conversation.profile_url || conversation.full_name}
                          type="button"
                          onClick={() => onOpenConversation(conversation)}
                          className="hover:bg-muted focus-visible:ring-ring/50 flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors outline-none focus-visible:ring-3"
                        >
                          <span className="truncate">{conversation.full_name || 'Unknown'}</span>
                          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                            {reply ? format(parseISO(reply.date), 'MMM d, yyyy') : '—'}
                          </span>
                        </button>
                      )
                    })}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 w-fit justify-start"
                      onClick={() => onSelect(sentiment)}
                    >
                      Show all {SENTIMENT_LABELS[sentiment]} answers
                    </Button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
