import { Fragment, useEffect, useState } from 'react'
import { AppSidebar } from '@/components/AppSidebar'
import { DailyChart } from '@/components/DailyChart'
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
import { answerSentiment, profileOwner, type AnswerName, type ProfileName } from '@/filters'
import { deriveMetrics } from '@/lib/metrics'
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

function App() {
  const [profile, setProfile] = useState<ProfileName>('Show All')
  const [answer, setAnswer] = useState<AnswerName>('Show All')
  const [view, setView] = useState<View>(parseHash)

  useEffect(() => {
    const onHashChange = () => setView(parseHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const owner = profileOwner(profile)
  const conversations = owner
    ? data.conversations.filter((conversation) => conversation.owner === owner)
    : data.conversations

  // The detail page is scoped by its own sentiment, so the answer filter only shapes the
  // dashboard. Changing it therefore returns to the dashboard.
  const { daily, summary } = deriveMetrics(
    conversations,
    view.name === 'sentiment' ? 'all' : answerSentiment(answer),
  )

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
              conversations={conversations}
              summary={summary}
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
