import { Fragment, useEffect, useState } from 'react'
import { AppSidebar } from '@/components/AppSidebar'
import { DailyChart } from '@/components/DailyChart'
import { KpiStrip } from '@/components/KpiStrip'
import { ProfileUpload } from '@/components/ProfileUpload'
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
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { answerSentiment, profileOwner, type AnswerName, type ProfileName } from '@/filters'
import { deriveMetrics } from '@/lib/metrics'
import {
  applyOverrides,
  conversationKey,
  loadOverrides,
  persistOverrides,
  type ConversationOverride,
  type Overrides,
} from '@/lib/overrides'
import { SENTIMENT_LABELS } from '@/lib/sentiment'
import rawData from '../data.json'
import type { DashboardData, Sentiment } from '@/types'

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

function App() {
  // Seeded from the build-time import — the common case of just opening the dashboard
  // needs nothing else. An in-app CSV upload (server.py) replaces this with a fresh fetch
  // once a job completes, so a newly ingested profile appears without a rebuild.
  const [data, setData] = useState<DashboardData>(() => rawData as unknown as DashboardData)
  const [profile, setProfile] = useState<ProfileName>('Show All')
  const [answer, setAnswer] = useState<AnswerName>('Show All')
  const [view, setView] = useState<View>(parseHash)
  const [overrides, setOverrides] = useState<Overrides>(loadOverrides)

  useEffect(() => {
    const onHashChange = () => setView(parseHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const owner = profileOwner(profile)
  const scoped = owner
    ? data.conversations.filter((conversation) => conversation.owner === owner)
    : data.conversations
  const conversations = applyOverrides(scoped, overrides)

  // The detail page is scoped by its own sentiment, so the answer filter only shapes the
  // dashboard. Changing it therefore returns to the dashboard.
  const { daily, summary } = deriveMetrics(
    conversations.filter((conversation) => !conversation.irrelevant),
    view.name === 'sentiment' ? 'all' : answerSentiment(answer),
  )

  const saveOverride = (key: string, override: ConversationOverride) => {
    setOverrides((current) => {
      const next: Overrides = { ...current, [key]: override }
      persistOverrides(next)
      return next
    })
  }

  const trail: { label: string; hash?: string }[] = [{ label: 'Profiles', hash: '#/' }]
  if (view.name === 'sentiment') {
    trail.push({ label: profile, hash: '#/' })
    trail.push({ label: `${SENTIMENT_LABELS[view.sentiment]} answers` })
  } else if (answer === 'Show All') {
    trail.push({ label: profile })
  } else {
    trail.push({ label: profile, hash: '#/' })
    trail.push({ label: `${answer} answers` })
  }

  return (
    <SidebarProvider>
      <AppSidebar
        profile={profile}
        answer={answer}
        onProfileChange={setProfile}
        onAnswerChange={(next) => {
          setAnswer(next)
          navigate('#/')
        }}
      />
      {/* min-w-0: flex items default to min-width:auto, so the conversations table would
          otherwise widen the whole inset instead of scrolling inside its own container. */}
      <SidebarInset className="min-w-0">
        <header className="flex h-16 shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 !h-4" />
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
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 pt-0">
          {conversations.length === 0 ? (
            profile === 'Show All' ? (
              <p className="text-muted-foreground text-sm">
                No profiles have any data yet. Pick a named profile from the sidebar to
                upload its export.
              </p>
            ) : (
              <ProfileUpload profile={profile} onUploaded={setData} />
            )
          ) : view.name === 'sentiment' ? (
            <SentimentDetail
              sentiment={view.sentiment}
              conversations={conversations}
              summary={summary}
              onSaveOverride={(conversation, override) =>
                saveOverride(conversationKey(conversation), override)
              }
            />
          ) : (
            <>
              <KpiStrip summary={summary} />
              <DailyChart daily={daily} />
              <SentimentBreakdown
                summary={summary}
                onSelect={(sentiment) => navigate(`#/sentiment/${sentiment}`)}
              />
            </>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
