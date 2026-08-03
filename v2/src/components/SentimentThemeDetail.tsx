import { MessageSquareReply, Percent } from 'lucide-react'
import { ConversationsCard } from '@/components/ConversationsCard'
import { KpiCard } from '@/components/KpiCard'
import type { ManagedConversation } from '@/lib/overrides'
import { replyThemeLabel } from '@/lib/replyThemes'
import { SENTIMENT_BADGE_COLOR, SENTIMENT_ICON_COLOR, SENTIMENT_LABELS } from '@/lib/sentiment'
import type { Sentiment } from '@/types'

export function SentimentThemeDetail({
  sentiment,
  theme,
  conversations,
  onOpenConversation,
}: {
  sentiment: Sentiment
  theme: string
  conversations: ManagedConversation[]
  onOpenConversation: (conversation: ManagedConversation) => void
}) {
  const sentimentRows = conversations.filter(
    (conversation) => conversation.sentiment === sentiment && !conversation.irrelevant,
  )
  const rows = conversations.filter(
    (conversation) => conversation.sentiment === sentiment && conversation.reply_theme === theme,
  )
  const active = rows.filter((conversation) => !conversation.irrelevant)
  const share = sentimentRows.length ? Math.round((1000 * active.length) / sentimentRows.length) / 10 : 0

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard
          label={replyThemeLabel(theme)}
          value={active.length}
          icon={MessageSquareReply}
          iconClassName={SENTIMENT_ICON_COLOR[sentiment]}
          badgeClassName={SENTIMENT_BADGE_COLOR[sentiment]}
        />
        <KpiCard
          label={`Share of ${SENTIMENT_LABELS[sentiment].toLowerCase()} answers`}
          value={`${share}%`}
          icon={Percent}
          iconClassName="text-muted-foreground"
          badgeClassName="bg-muted-foreground/10"
        />
      </div>
      <ConversationsCard
        conversations={rows}
        onOpenConversation={onOpenConversation}
        reasonsColumn="theme"
      />
    </>
  )
}
