import { DailyChart } from '@/components/DailyChart'
import { KpiStrip } from '@/components/KpiStrip'
import { SentimentBreakdown } from '@/components/SentimentBreakdown'
import rawData from '../data.json'
import type { DashboardData } from '@/types'

const data = rawData as unknown as DashboardData

function App() {
  return (
    <main className="bg-background min-h-svh p-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <h1 className="text-xl font-bold">Outreach Dashboard</h1>

        <KpiStrip summary={data.summary} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DailyChart daily={data.daily} />
          <SentimentBreakdown summary={data.summary} />
        </div>
      </div>
    </main>
  )
}

export default App
