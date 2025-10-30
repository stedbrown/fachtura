'use client'

import dynamic from 'next/dynamic'
import { DashboardChartsClient } from './dashboard-charts-client'

// Dynamic import to avoid hydration mismatch with Dialog/Chart IDs
const DashboardChartsClientDynamic = dynamic(
  () => import('./dashboard-charts-client').then(mod => ({ default: mod.DashboardChartsClient })),
  { ssr: false }
)

export function DashboardChartsWrapper(props: React.ComponentProps<typeof DashboardChartsClient>) {
  return <DashboardChartsClientDynamic {...props} />
}

