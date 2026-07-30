import { Fragment, useEffect, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { AppSidebar } from '@/components/AppSidebar'
import { ConversationSheet } from '@/components/ConversationSheet'
import { DailyChart } from '@/components/DailyChart'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { KpiStrip } from '@/components/KpiStrip'
import { SentimentBreakdown } from '@/components/SentimentBreakdown'
import { SentimentDetail } from '@/components/SentimentDetail'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { conversationInRange, dateBounds, restrictToDataYears, toKey } from '@/lib/dateRange'
import { profileOwner, type ProfileName } from '@/filters'
import { deriveMetrics } from '@/lib/metrics'
import {
  applyOverrides,
  conversationKey,
  loadOverrides,
  persistOverrides,
  type ConversationOverride,
  type ManagedConversation,
  type Overrides,
} from '@/lib/overrides'
import { SENTIMENT_LABELS } from '@/lib/sentiment'
import rawData from '../data.json'
import type { DashboardData, Sentiment } from '@/types'

const data = rawData as unknown as DashboardData

type View = { name: 'dashboard' } | { name: 'sentiment'; sentiment: Sentiment }

/** Hash routing rather than a router dependency: two views, and it still works over file://,
 *  which the single-file dist build is meant to support. */
function parseHash(): View {
  const match = /^#\/sentiment\/(positive|neutral|negative)$/.exec(window.location.hash)
  return match ? { name: 'sentiment', sentiment: match[1] as Sentiment } : { name: 'dashboard' }
}

const navigate = (hash: string) => {
  window.location.hash = hash
}

/** Keeps only the days a trimmed conversation set can actually vouch for, so a conversation
 * that started in range but got a reply after it doesn't stretch the chart past the range. */
function trimDaily(
  daily: DashboardData['daily'],
  fromKey: string,
  toKeyValue: string,
): DashboardData['daily'] {
  const trim = (series: Record<string, number>) =>
    Object.fromEntries(
      Object.entries(series).filter(([day]) => day >= fromKey && day <= toKeyValue),
    )
  return { sent: trim(daily.sent), received: trim(daily.received) }
}

const allConversations = restrictToDataYears(data.conversations)

function App() {
  const [profile, setProfile] = useState<ProfileName>('Show All')
  const [view, setView] = useState<View>(parseHash)
  const [overrides, setOverrides] = useState<Overrides>(loadOverrides)
  const [range, setRange] = useState<DateRange | undefined>(undefined)
  const [selected, setSelected] = useState<ManagedConversation | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    const onHashChange = () => setView(parseHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const owner = profileOwner(profile)
  const scoped = owner
    ? allConversations.filter((conversation) => conversation.owner === owner)
    : allConversations
  const managed = applyOverrides(scoped, overrides)

  const { minDate, maxDate } = dateBounds(managed)
  const fromKey = range?.from ? toKey(range.from) : toKey(minDate)
  const toKeyValue = range?.to ? toKey(range.to) : toKey(maxDate)
  const dateFiltered = managed.filter((conversation) =>
    conversationInRange(conversation, fromKey, toKeyValue),
  )
  const availableDays = Array.from(
    new Set(
      managed.flatMap((conversation) => conversation.messages.map((message) => message.date.slice(0, 10))),
    ),
  ).sort()

  const metricsInput = dateFiltered.filter((conversation) => !conversation.irrelevant)
  const { daily, summary } = deriveMetrics(metricsInput)
  const trimmedDaily = trimDaily(daily, fromKey, toKeyValue)

  const saveOverride = (key: string, override: ConversationOverride) => {
    setOverrides((current) => {
      const next: Overrides = { ...current, [key]: override }
      persistOverrides(next)
      return next
    })
  }

  const openConversation = (conversation: ManagedConversation) => {
    setSelected(conversation)
    setSheetOpen(true)
  }

  const handleProfileChange = (next: ProfileName) => {
    setProfile(next)
    setRange(undefined)
  }

  const trail: { label: string; hash?: string }[] = [{ label: 'Profiles', hash: '#/' }]
  if (view.name === 'sentiment') {
    trail.push({ label: profile, hash: '#/' })
    trail.push({ label: `${SENTIMENT_LABELS[view.sentiment]} answers` })
  } else {
    trail.push({ label: profile })
  }

  const headline =
    view.name === 'sentiment' ? `${SENTIMENT_LABELS[view.sentiment]} Answers` : 'Outreach Overview'

  return (
    <SidebarProvider>
      <AppSidebar profile={profile} onProfileChange={handleProfileChange} />
      {/* min-w-0: flex items default to min-width:auto, so the conversations table would
          otherwise widen the whole inset instead of scrolling inside its own container. */}
      <SidebarInset className="min-w-0">
        <header className="flex h-16 shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2" />
            <Breadcrumb>
              <BreadcrumbList>
                {trail.map((crumb, index) => {
                  const isLast = index === trail.length - 1
                  return (
                    <Fragment key={crumb.label}>
                      <BreadcrumbItem className={isLast ? undefined : 'hidden md:block'}>
                        {isLast || !crumb.hash ? (
                          <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink href={crumb.hash}>{crumb.label}</BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                      {!isLast && <BreadcrumbSeparator className="hidden md:block" />}
                    </Fragment>
                  )
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-col gap-4 px-6 pt-4 pb-8">
          <h1 className="text-xl font-semibold tracking-tight">{headline}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangeFilter
              range={range}
              onRangeChange={setRange}
              minDate={minDate}
              maxDate={maxDate}
              days={availableDays}
            />
          </div>
        </div>
        <Separator />
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 pt-6">
          {managed.length === 0 ? (
            <Card>
              <CardContent className="text-muted-foreground text-sm">
                No export has been ingested for {profile} yet. Add their CSV to{' '}
                <code className="text-foreground">SOURCES</code> in{' '}
                <code className="text-foreground">extract.py</code> and re-run it.
              </CardContent>
            </Card>
          ) : view.name === 'sentiment' ? (
            <SentimentDetail
              sentiment={view.sentiment}
              conversations={dateFiltered}
              summary={summary}
              onOpenConversation={openConversation}
            />
          ) : (
            <>
              <KpiStrip summary={summary} />
              <DailyChart daily={trimmedDaily} />
              <SentimentBreakdown
                summary={summary}
                onSelect={(sentiment) => navigate(`#/sentiment/${sentiment}`)}
              />
            </>
          )}
        </div>
      </SidebarInset>
      <ConversationSheet
        conversation={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSave={(override) => {
          if (selected) saveOverride(conversationKey(selected), override)
        }}
      />
    </SidebarProvider>
  )
}

export default App
