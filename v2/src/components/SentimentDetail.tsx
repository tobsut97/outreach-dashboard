import { ChevronDown, MessageSquareReply, Percent, Tags } from 'lucide-react'
import { useState } from 'react'
import { ConversationsCard } from '@/components/ConversationsCard'
import { KpiCard } from '@/components/KpiCard'
import { ReplyThemeTreemap } from '@/components/ReplyThemeTreemap'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
  onSelectTheme,
}: {
  sentiment: Sentiment
  conversations: ManagedConversation[]
  summary: Summary
  onOpenConversation: (conversation: ManagedConversation) => void
  onSelectTheme: (theme: string) => void
}) {
  const [selectedReasons, setSelectedReasons] = useState<Set<string>>(new Set())

  const rows = conversations
    .filter((conversation) => conversation.sentiment === sentiment)
    .sort((a, b) => (firstReply(b)?.date ?? '').localeCompare(firstReply(a)?.date ?? ''))

  // Metrics exclude conversations marked irrelevant, so the counts here must too. They stay
  // in the table, dimmed, or marking one would hide it beyond any way of undoing it.
  const active = rows.filter((conversation) => !conversation.irrelevant)
  const share = summary.sentiment_share[sentiment] ?? 0

  // Positive replies have no fine-grained reply_theme (only negative/neutral were classified),
  // so positive keeps the old coarse-tag "Why" card/filter/column; negative/neutral get the
  // treemap instead, which already covers the same ground at finer granularity.
  const hasThemes = sentiment !== 'positive'

  const reasons = Object.entries(summary.tag_counts[sentiment] ?? {}).sort((a, b) => b[1] - a[1])
  const themeCount = new Set(
    active.map((conversation) => conversation.reply_theme).filter((theme): theme is string => Boolean(theme)),
  ).size

  const toggleReason = (tag: string) => {
    setSelectedReasons((current) => {
      const next = new Set(current)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  const reasonFilterLabel =
    selectedReasons.size === 0
      ? 'All reasons'
      : selectedReasons.size === 1
        ? tagLabel([...selectedReasons][0])
        : `${selectedReasons.size} reasons`

  const tableRows = hasThemes
    ? rows
    : rows.filter(
        (conversation) =>
          selectedReasons.size === 0 || conversation.tags.some((tag) => selectedReasons.has(tag)),
      )

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
          value={hasThemes ? themeCount : reasons.length}
          icon={Tags}
          iconClassName="text-sky-500"
          badgeClassName="bg-sky-500/10"
        />
      </div>

      {hasThemes ? (
        <ReplyThemeTreemap sentiment={sentiment} conversations={rows} onSelectTheme={onSelectTheme} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground text-sm font-semibold">Why</CardTitle>
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
      )}

      <ConversationsCard
        conversations={tableRows}
        onOpenConversation={onOpenConversation}
        reasonsColumn={hasThemes ? 'theme' : 'tags'}
        extraControls={
          !hasThemes && reasons.length > 0 ? (
            <Popover>
              <PopoverTrigger
                render={
                  <Button variant="outline" className="gap-1.5">
                    {reasonFilterLabel}
                    <ChevronDown className="size-4" />
                  </Button>
                }
              />
              <PopoverContent align="start" className="w-64">
                <div className="flex flex-col gap-2">
                  {reasons.map(([tag]) => (
                    <label
                      key={tag}
                      className="hover:bg-muted -mx-1 flex items-center gap-2 rounded-md px-1 py-1.5 text-sm"
                    >
                      <Checkbox checked={selectedReasons.has(tag)} onCheckedChange={() => toggleReason(tag)} />
                      {tagLabel(tag)}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : undefined
        }
      />
    </>
  )
}
