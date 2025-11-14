import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'
import { DashboardChartsWrapper } from '@/components/dashboard-charts-wrapper'
import { DashboardStats, OverdueAlert } from '@/components/dashboard-stats'
import { updateOverdueInvoices } from '@/lib/utils/update-overdue-invoices'
import { SetupAlert } from '@/components/setup-alert'

interface DashboardStatsData {
  clients_count: number
  total_quotes: number
  quotes_draft: number
  quotes_sent: number
  quotes_accepted: number
  quotes_rejected: number
  total_invoices: number
  invoices_draft: number
  invoices_issued: number
  invoices_paid: number
  invoices_overdue: number
  total_revenue: number
  current_month_revenue: number
  previous_month_revenue: number
  overdue_total: number
  products_count: number
  total_orders: number
  suppliers_count: number
  expenses_count: number
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations('dashboard')
  const tNav = await getTranslations('navigation')
  
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Automatically update overdue invoices before loading dashboard data
  await updateOverdueInvoices()

  // Get current and previous month dates
  const now = new Date()
  const currentMonthStart = startOfMonth(now)
  const previousMonthStart = startOfMonth(subMonths(now, 1))
  const previousMonthEnd = endOfMonth(subMonths(now, 1))

  // Fetch dashboard stats via secure function (not directly exposed via API)
  const { data: dashboardStats } = await supabase
    .rpc('get_user_dashboard_stats')
    .single()

  // Fetch detailed data for charts (only what's needed)
  const [
    topClients,
    last12MonthsRevenue,
  ] = await Promise.all([
    // Top 5 clients by revenue
    supabase
      .from('invoices')
      .select('client_id, total, clients(name)')
      .eq('user_id', user.id)
      .eq('status', 'paid')
      .is('deleted_at', null),
    
    // Last 12 months revenue (monthly)
    supabase
      .from('invoices')
      .select('total, date')
      .eq('user_id', user.id)
      .eq('status', 'paid')
      .gte('date', subMonths(now, 11).toISOString())
      .is('deleted_at', null),
  ])

  // Extract values from secure function (much faster!)
  const defaultStats: DashboardStatsData = {
    clients_count: 0,
    total_quotes: 0,
    quotes_draft: 0,
    quotes_sent: 0,
    quotes_accepted: 0,
    quotes_rejected: 0,
    total_invoices: 0,
    invoices_draft: 0,
    invoices_issued: 0,
    invoices_paid: 0,
    invoices_overdue: 0,
    total_revenue: 0,
    current_month_revenue: 0,
    previous_month_revenue: 0,
    overdue_total: 0,
    products_count: 0,
    total_orders: 0,
    suppliers_count: 0,
    expenses_count: 0,
  }
  
  const viewStats: DashboardStatsData = (dashboardStats as DashboardStatsData) || defaultStats

  const totalRevenue = Number(viewStats.total_revenue) || 0
  const currentMonthTotal = Number(viewStats.current_month_revenue) || 0
  const previousMonthTotal = Number(viewStats.previous_month_revenue) || 0
  const overdueTotal = Number(viewStats.overdue_total) || 0
  
  // Calculate trends
  const revenueTrend = previousMonthTotal > 0 
    ? ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100 
    : currentMonthTotal > 0 ? 100 : 0

  // Process top clients
  const clientRevenues = new Map<string, { name: string; total: number }>()
  topClients.data?.forEach((invoice: any) => {
    if (invoice.clients?.name) {
      const current = clientRevenues.get(invoice.client_id) || { name: invoice.clients.name, total: 0 }
      current.total += Number(invoice.total)
      clientRevenues.set(invoice.client_id, current)
    }
  })
  const top5Clients = Array.from(clientRevenues.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  // Process monthly revenue for charts
  const monthlyRevenue = new Map<string, number>()
  for (let i = 11; i >= 0; i--) {
    const month = format(subMonths(now, i), 'yyyy-MM')
    monthlyRevenue.set(month, 0)
  }
  last12MonthsRevenue.data?.forEach((invoice: any) => {
    const month = format(new Date(invoice.date), 'yyyy-MM')
    monthlyRevenue.set(month, (monthlyRevenue.get(month) || 0) + Number(invoice.total))
  })
  const monthlyData = Array.from(monthlyRevenue.entries()).map(([month, total]) => ({ month, total }))

  // Process quotes by status (from materialized view)
  const quotesStats = {
    accepted: viewStats.quotes_accepted || 0,
    sent: viewStats.quotes_sent || 0,
    rejected: viewStats.quotes_rejected || 0,
    draft: viewStats.quotes_draft || 0,
  }

  // Process invoices by status (from materialized view)
  const invoicesStats = {
    paid: viewStats.invoices_paid || 0,
    issued: viewStats.invoices_issued || 0,
    overdue: viewStats.invoices_overdue || 0,
    draft: viewStats.invoices_draft || 0,
  }

  const stats: Array<{
    title: string
    value: string | number
    icon: string
    description: string
    trend?: number
    trendLabel?: string
    variant?: 'default' | 'destructive'
    link?: string
  }> = [
    {
      title: t('totalRevenue'),
      value: `CHF ${totalRevenue.toFixed(2)}`,
      icon: 'DollarSign',
      description: t('paidInvoices'),
      trend: revenueTrend,
      trendLabel: revenueTrend >= 0 ? t('vsLastMonth') : t('vsLastMonth'),
      link: '/dashboard/invoices?status=paid',
    },
    {
      title: tNav('clients'),
      value: viewStats.clients_count || 0,
      icon: 'Users',
      description: t('activeClients'),
      link: '/dashboard/clients',
    },
    {
      title: t('pendingInvoices'),
      value: invoicesStats.issued,
      icon: 'Clock',
      description: t('awaitingPayment'),
      link: '/dashboard/invoices?status=issued',
    },
      {
        title: t('overdueInvoices'),
        value: invoicesStats.overdue,
        icon: 'AlertCircle',
        description: `CHF ${overdueTotal.toFixed(2)}`,
        variant: invoicesStats.overdue > 0 ? 'destructive' : 'default',
        link: '/dashboard/invoices?status=overdue',
      },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      {/* Setup Alert for QR Code Configuration */}
      <SetupAlert />

      {/* Overdue Alert Banner */}
      {invoicesStats.overdue > 0 && (
        <OverdueAlert 
          count={invoicesStats.overdue}
          amount={overdueTotal.toFixed(2)}
          locale={locale}
        />
      )}

      {/* KPI Cards */}
      <DashboardStats stats={stats} locale={locale} />

      {/* Charts */}
      <DashboardChartsWrapper 
        monthlyData={monthlyData}
        topClients={top5Clients}
        quotesStats={quotesStats}
        invoicesStats={invoicesStats}
        locale={locale}
      />
    </div>
  )
}

