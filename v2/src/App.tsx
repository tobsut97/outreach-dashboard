import { useState } from 'react'
import { AppSidebar } from '@/components/AppSidebar'
import { DailyChart } from '@/components/DailyChart'
import { KpiStrip } from '@/components/KpiStrip'
import { SentimentBreakdown } from '@/components/SentimentBreakdown'
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
import rawData from '../data.json'
import type { DashboardData } from '@/types'

const data = rawData as unknown as DashboardData

function App() {
  const [profile, setProfile] = useState<ProfileName>('Show All')
  const [answer, setAnswer] = useState<AnswerName>('Show All')

  const owner = profileOwner(profile)
  const conversations = owner
    ? data.conversations.filter((conversation) => conversation.owner === owner)
    : data.conversations
  const { daily, summary } = deriveMetrics(conversations, answerSentiment(answer))

  return (
    <SidebarProvider>
      <AppSidebar
        profile={profile}
        answer={answer}
        onProfileChange={setProfile}
        onAnswerChange={setAnswer}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 !h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">Profiles</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                {answer === 'Show All' ? (
                  <BreadcrumbItem>
                    <BreadcrumbPage>{profile}</BreadcrumbPage>
                  </BreadcrumbItem>
                ) : (
                  <>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink href="#">{profile}</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{answer} answers</BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {conversations.length === 0 ? (
            <Card>
              <CardContent className="text-muted-foreground text-sm">
                No export has been ingested for {profile} yet. Add their CSV to{' '}
                <code className="text-foreground">SOURCES</code> in{' '}
                <code className="text-foreground">extract.py</code> and re-run it.
              </CardContent>
            </Card>
          ) : (
            <>
              <KpiStrip summary={summary} />
              <DailyChart daily={daily} />
              <SentimentBreakdown summary={summary} />
            </>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
