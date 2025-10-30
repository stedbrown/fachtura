'use client'

import { useState, useEffect } from 'react'
import { DashboardCharts } from '@/components/dashboard-charts'
import { DashboardSettingsDialog, type DashboardChartVisibility } from '@/components/dashboard-settings-dialog'
import Cookies from 'js-cookie'

interface DashboardChartsClientProps {
  monthlyData: { month: string; total: number }[]
  topClients: { name: string; total: number }[]
  quotesStats: { accepted: number; sent: number; rejected: number; draft: number }
  invoicesStats: { paid: number; issued: number; overdue: number; draft: number }
  locale: string
}

const DEFAULT_VISIBILITY: DashboardChartVisibility = {
  revenueChart: true,
  acceptanceRate: true,
  topClients: true,
  quotesDistribution: true,
  invoicesDistribution: true,
  documentsComparison: true,
}

export function DashboardChartsClient(props: DashboardChartsClientProps) {
  const [visibility, setVisibility] = useState<DashboardChartVisibility>(DEFAULT_VISIBILITY)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Load visibility from cookie
    const saved = Cookies.get('dashboard_chart_visibility')
    if (saved) {
      try {
        setVisibility(JSON.parse(saved))
      } catch (error) {
        console.error('Failed to parse dashboard visibility:', error)
      }
    }
  }, [])

  const handleSave = (newVisibility: DashboardChartVisibility) => {
    setVisibility(newVisibility)
    Cookies.set('dashboard_chart_visibility', JSON.stringify(newVisibility), { expires: 365 })
  }

  // Always use the same visibility for SSR and first client render to avoid hydration mismatch
  return (
    <div className="space-y-4" suppressHydrationWarning>
      <div className="flex justify-end">
        <DashboardSettingsDialog visibility={mounted ? visibility : DEFAULT_VISIBILITY} onSave={handleSave} />
      </div>
      <DashboardCharts {...props} visibility={mounted ? visibility : DEFAULT_VISIBILITY} />
    </div>
  )
}

