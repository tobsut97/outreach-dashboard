import type { ComponentType } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface KpiCardProps {
  label: string
  value: string | number
  sub?: string | null
  icon: ComponentType<{ className?: string }>
  iconClassName: string
  badgeClassName: string
}

export function KpiCard({ label, value, sub, icon: Icon, iconClassName, badgeClassName }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-foreground text-sm font-semibold">
          {label}
        </CardTitle>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${badgeClassName}`}
        >
          <Icon className={`h-5 w-5 ${iconClassName}`} />
        </span>
      </CardHeader>
      <CardContent>
        <div className="font-kpi text-3xl font-bold tabular-nums">{value}</div>
        {sub && (
          <div className="font-kpi text-muted-foreground mt-1 text-sm tabular-nums">{sub}</div>
        )}
      </CardContent>
    </Card>
  )
}
