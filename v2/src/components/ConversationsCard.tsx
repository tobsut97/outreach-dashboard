import { format, parseISO } from 'date-fns'
import { ExternalLink, Search } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { SortableTableHead } from '@/components/SortableTableHead'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ManagedConversation } from '@/lib/overrides'
import { replyThemeLabel } from '@/lib/replyThemes'
import { tagLabel } from '@/lib/sentiment'
import { sortRows, useSort } from '@/lib/sort'
import type { Conversation } from '@/types'

const firstReply = (conversation: Conversation) =>
  conversation.messages.find((message) => message.sender === 'prospect')

const PAGE_SIZE = 20

type SortKey = 'name' | 'company' | 'replied' | 'reasons'

function sortAccessor(reasonsColumn: 'tags' | 'theme') {
  return (conversation: ManagedConversation, key: SortKey): string | number | null => {
    switch (key) {
      case 'name':
        return conversation.full_name || null
      case 'company':
        return conversation.company || null
      case 'replied':
        return firstReply(conversation)?.date ?? null
      case 'reasons':
        if (reasonsColumn === 'theme') {
          return conversation.reply_theme ? replyThemeLabel(conversation.reply_theme) : null
        }
        return conversation.tags[0] ? tagLabel(conversation.tags[0]) : null
    }
  }
}

/** Shared conversations table + search + pagination, used by both the full sentiment page
 * (already filtered to one sentiment, plus its own reason-filter controls) and the per-theme
 * drill-through page (already filtered to one theme) — this component only owns search and
 * pagination on whatever list it's handed. */
export function ConversationsCard({
  conversations,
  onOpenConversation,
  reasonsColumn,
  extraControls,
}: {
  conversations: ManagedConversation[]
  onOpenConversation: (conversation: ManagedConversation) => void
  reasonsColumn: 'tags' | 'theme'
  extraControls?: ReactNode
}) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sort, toggleSort] = useSort<SortKey>()

  const searchTerm = search.trim().toLowerCase()
  const searchedRows = conversations.filter((conversation) => {
    if (!searchTerm) return true
    const reply = firstReply(conversation)
    return (
      conversation.full_name.toLowerCase().includes(searchTerm) ||
      conversation.company.toLowerCase().includes(searchTerm) ||
      (reply?.text.toLowerCase().includes(searchTerm) ?? false)
    )
  })
  const filteredRows = sortRows(searchedRows, sort, sortAccessor(reasonsColumn))
  const filteredActive = filteredRows.filter((conversation) => !conversation.irrelevant)
  const filteredHidden = filteredRows.length - filteredActive.length

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
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
          {extraControls}
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
                  <SortableTableHead label="Name" sortKey="name" sort={sort} onToggle={toggleSort} className="w-[20%]" />
                  <SortableTableHead label="Company" sortKey="company" sort={sort} onToggle={toggleSort} className="w-[18%]" />
                  <SortableTableHead
                    label="Replied"
                    sortKey="replied"
                    sort={sort}
                    onToggle={toggleSort}
                    className="w-[9%] whitespace-nowrap"
                  />
                  <SortableTableHead
                    label={reasonsColumn === 'theme' ? 'Theme' : 'Reasons'}
                    sortKey="reasons"
                    sort={sort}
                    onToggle={toggleSort}
                    className="w-[18%]"
                  />
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
                          {reasonsColumn === 'theme' ? (
                            conversation.reply_theme ? (
                              <Badge variant="secondary" className="whitespace-nowrap">
                                {replyThemeLabel(conversation.reply_theme)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )
                          ) : conversation.tags.length === 0 ? (
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
  )
}
