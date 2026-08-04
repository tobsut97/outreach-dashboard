import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ExternalLink, PencilLine, XIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import type { ConversationOverride, ManagedConversation } from '@/lib/overrides'
import {
  ALLOWED_TAGS,
  DOT_COLOR,
  MAX_TAGS,
  SENTIMENT_LABELS,
  SENTIMENT_ORDER,
  tagLabel,
} from '@/lib/sentiment'
import type { Sentiment } from '@/types'

const DRAWER_WIDTH = 'sm:max-w-lg'

/** Docked in-flow panel, not a modal — it's a flex sibling of the main content in App.tsx, so
 *  opening it shrinks the table instead of overlaying it. Width animates via a plain CSS
 *  transition; content sits in a fixed-width inner wrapper so it doesn't reflow mid-transition. */
export function ConversationDrawer({
  conversation,
  open,
  onOpenChange,
  onSave,
  saveError,
}: {
  conversation: ManagedConversation | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (override: ConversationOverride) => void
  saveError?: string | null
}) {
  const [editing, setEditing] = useState(false)
  const [sentiment, setSentiment] = useState<Sentiment | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [irrelevant, setIrrelevant] = useState(false)

  // Reset the draft whenever a different conversation is opened, so edits never leak
  // from one row to the next.
  useEffect(() => {
    setEditing(false)
    setSentiment(conversation?.sentiment ?? null)
    setTags(conversation?.tags ?? [])
    setIrrelevant(conversation?.irrelevant ?? false)
  }, [conversation])

  const toggleTag = (tag: string) => {
    setTags((current) =>
      current.includes(tag)
        ? current.filter((t) => t !== tag)
        : current.length >= MAX_TAGS
          ? current
          : [...current, tag],
    )
  }

  const save = () => {
    onSave({
      ...(sentiment ? { sentiment } : {}),
      tags,
      irrelevant,
    })
    setEditing(false)
  }

  const cancel = () => {
    if (!conversation) return
    setSentiment(conversation.sentiment)
    setTags(conversation.tags)
    setIrrelevant(conversation.irrelevant)
    setEditing(false)
  }

  return (
    <div
      className={`sticky top-2 my-2 mr-2 flex h-[calc(100svh-1rem)] shrink-0 flex-col overflow-hidden transition-[width] duration-[380ms] ease-out ${
        open ? `w-full ${DRAWER_WIDTH}` : 'w-0'
      }`}
    >
      {conversation && (
        <div
          className={`flex h-full w-full flex-col gap-0 overflow-hidden rounded-xl bg-background shadow-sm ${DRAWER_WIDTH}`}
        >
          <div className="flex flex-col gap-0.5 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-medium text-foreground">
                {conversation.full_name || 'Unknown'}
                {conversation.profile_url && (
                  <a
                    href={conversation.profile_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-primary"
                    aria-label="Open LinkedIn profile"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                )}
              </h2>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
              >
                <XIcon />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {[conversation.position, conversation.company].filter(Boolean).join(' · ') ||
                'No company on file'}
            </p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-2">
            <section className="flex flex-col gap-3">
              <Label className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Sentiment
              </Label>
              {editing ? (
                <div className="flex flex-wrap gap-2">
                  {SENTIMENT_ORDER.map((value) => (
                    <Button
                      key={value}
                      variant={sentiment === value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSentiment(value)}
                    >
                      <span className={`size-2 shrink-0 rounded-full ${DOT_COLOR[value]}`} />
                      {SENTIMENT_LABELS[value]}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  {conversation.sentiment ? (
                    <>
                      <span
                        className={`size-2 shrink-0 rounded-full ${DOT_COLOR[conversation.sentiment]}`}
                      />
                      {SENTIMENT_LABELS[conversation.sentiment]}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Not classified</span>
                  )}
                </div>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <Label className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Reasons {editing && `(${tags.length}/${MAX_TAGS})`}
              </Label>
              {editing ? (
                <div className="flex flex-wrap gap-1.5">
                  {ALLOWED_TAGS.map((tag) => {
                    const selected = tags.includes(tag)
                    return (
                      <Button
                        key={tag}
                        variant={selected ? 'secondary' : 'ghost'}
                        size="xs"
                        // At the cap, only already-selected reasons stay clickable so they
                        // can be removed.
                        disabled={!selected && tags.length >= MAX_TAGS}
                        onClick={() => toggleTag(tag)}
                      >
                        {tagLabel(tag)}
                      </Button>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {conversation.tags.length === 0 ? (
                    <span className="text-muted-foreground text-sm">None</span>
                  ) : (
                    conversation.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tagLabel(tag)}
                      </Badge>
                    ))
                  )}
                </div>
              )}
            </section>

            <section className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="irrelevant" className="text-sm">
                  Irrelevant
                </Label>
                <span className="text-muted-foreground text-xs">
                  Excludes this conversation from every metric.
                </span>
              </div>
              <Switch
                id="irrelevant"
                checked={irrelevant}
                onCheckedChange={setIrrelevant}
                disabled={!editing}
              />
            </section>

            <Separator />

            <section className="flex flex-col gap-3">
              <Label className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Conversation ({conversation.messages.length} messages)
              </Label>
              <div className="flex flex-col gap-3">
                {conversation.messages.map((message, index) => (
                  <div
                    key={`${message.date}-${index}`}
                    className={
                      message.sender === 'owner'
                        ? 'bg-muted rounded-lg p-3 text-sm'
                        : 'bg-primary/5 border-primary/20 rounded-lg border p-3 text-sm'
                    }
                  >
                    <div className="text-muted-foreground mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium">
                        {message.sender === 'owner' ? conversation.owner : conversation.full_name}
                      </span>
                      <span className="tabular-nums">
                        {format(parseISO(message.date), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap break-words">{message.text}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="mt-auto flex flex-col gap-2 p-4">
            {saveError && <p className="text-destructive text-sm">{saveError}</p>}
            {editing ? (
              <div className="flex gap-2">
                <Button onClick={save}>Save changes</Button>
                <Button variant="ghost" onClick={cancel}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <PencilLine data-icon="inline-start" />
                Edit
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
