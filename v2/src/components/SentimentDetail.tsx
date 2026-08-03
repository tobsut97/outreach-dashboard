import { format, parseISO } from 'date-fns'
import { ChevronDown, ExternalLink, MessageSquareReply, Percent, Search, Tags, X } from 'lucide-react'
import { useState } from 'react'
import { KpiCard } from '@/components/KpiCard'
import { ReplyThemeTreemap } from '@/components/ReplyThemeTreemap'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { oneDecimal, type Summary } from '@/lib/metrics'
import type { ManagedConversation } from '@/lib/overrides'
import { replyThemeLabel } from '@/lib/replyThemes'
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

const PAGE_SIZE = 20

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
  const [selectedReasons, setSelectedReasons] = useState<Set<string>>(new Set())
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const rows = conversations
    .filter((conversation) => conversation.sentiment === sentiment)
    .sort((a, b) => (firstReply(b)?.date ?? '').localeCompare(firstReply(a)?.date ?? ''))

  // Metrics exclude conversations marked irrelevant, so the counts here must too. They stay
  // in the table, dimmed, or marking one would hide it beyond any way of undoing it.
  const active = rows.filter((conversation) => !conversation.irrelevant)
  const share = summary.sentiment_share[sentiment] ?? 0
  const reasons = Object.entries(summary.tag_counts[sentiment] ?? {}).sort((a, b) => b[1] - a[1])

  const searchTerm = search.trim().toLowerCase()
  const filteredRows = rows.filter((conversation) => {
    if (selectedReasons.size > 0 && !conversation.tags.some((tag) => selectedReasons.has(tag))) {
      return false
    }
    if (selectedTheme && conversation.reply_theme !== selectedTheme) {
      return false
    }
    if (!searchTerm) return true
    const reply = firstReply(conversation)
    return (
      conversation.full_name.toLowerCase().includes(searchTerm) ||
      conversation.company.toLowerCase().includes(searchTerm) ||
      (reply?.text.toLowerCase().includes(searchTerm) ?? false)
    )
  })
  const filteredActive = filteredRows.filter((conversation) => !conversation.irrelevant)
  const filteredHidden = filteredRows.length - filteredActive.length

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const toggleReason = (tag: string) => {
    setSelectedReasons((current) => {
      const next = new Set(current)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
    setPage(1)
  }

  const reasonFilterLabel =
    selectedReasons.size === 0
      ? 'All reasons'
      : selectedReasons.size === 1
        ? tagLabel([...selectedReasons][0])
        : `${selectedReasons.size} reasons`

  const handleSelectTheme = (theme: string | null) => {
    setSelectedTheme(theme)
    setPage(1)
  }

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

      {sentiment !== 'positive' && (
        <ReplyThemeTreemap
          sentiment={sentiment}
          conversations={rows}
          selectedTheme={selectedTheme}
          onSelectTheme={handleSelectTheme}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground text-sm font-semibold">
            Conversations ({filteredActive.length})
            {filteredHidden > 0 && (
              <span className="ml-2 font-normal">+ {filteredHidden} marked irrelevant</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-xs">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Search name, company, or reply..."
                className="pl-8"
              />
            </div>
            {reasons.length > 0 && (
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
                        <Checkbox
                          checked={selectedReasons.has(tag)}
                          onCheckedChange={() => toggleReason(tag)}
                        />
                        {tagLabel(tag)}
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {selectedTheme && (
              <Badge variant="secondary" className="gap-1.5 py-1.5">
                {replyThemeLabel(selectedTheme)}
                <button
                  type="button"
                  onClick={() => handleSelectTheme(null)}
                  aria-label="Clear theme filter"
                  className="hover:text-foreground -mr-0.5"
                >
                  <X className="size-3.5" />
                </button>
              </Badge>
            )}
          </div>

          {/* table-fixed: without it the column percentages below are only hints, and long
              reply text blows the table out to thousands of pixels wide. */}
          {filteredRows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No conversations match these filters.</p>
          ) : (
            <>
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
                  {pageRows.map((conversation) => {
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

              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-sm">
                    Page {currentPage} of {totalPages}
                  </p>
                  <Pagination className="mx-0 w-auto justify-end">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          aria-disabled={currentPage === 1}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                          onClick={(event) => {
                            event.preventDefault()
                            setPage((current) => Math.max(1, current - 1))
                          }}
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          aria-disabled={currentPage === totalPages}
                          className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                          onClick={(event) => {
                            event.preventDefault()
                            setPage((current) => Math.min(totalPages, current + 1))
                          }}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </>
  )
}
