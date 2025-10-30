import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, FileText, Receipt, DollarSign, TrendingUp, TrendingDown, AlertCircle, Clock } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'
import { DashboardChartsWrapper } from '@/components/dashboard-charts-wrapper'

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

  // Get current and previous month dates
  const now = new Date()
  const currentMonthStart = startOfMonth(now)
  const previousMonthStart = startOfMonth(subMonths(now, 1))
  const previousMonthEnd = endOfMonth(subMonths(now, 1))

  // Fetch comprehensive statistics
  const [
    clientsCount,
    quotesData,
    invoicesData,
    paidInvoices,
    overdueInvoices,
    currentMonthRevenue,
    previousMonthRevenue,
    topClients,
    last12MonthsRevenue,
    quotesByStatus
  ] = await Promise.all([
    // Total clients
    supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('deleted_at', null),
    
    // All quotes
    supabase
      .from('quotes')
      .select('status, total, created_at')
      .eq('user_id', user.id)
      .is('deleted_at', null),
    
    // All invoices
    supabase
      .from('invoices')
      .select('status, total, date, due_date')
      .eq('user_id', user.id)
      .is('deleted_at', null),
    
    // Paid invoices total
    supabase
      .from('invoices')
      .select('total')
      .eq('user_id', user.id)
      .eq('status', 'paid')
      .is('deleted_at', null),
    
    // Overdue invoices (either status=overdue OR issued with past due_date)
    supabase
      .from('invoices')
      .select('total, due_date, status')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .or(`status.eq.overdue,and(status.eq.issued,due_date.lt.${now.toISOString()})`),
    
    // Current month revenue
    supabase
      .from('invoices')
      .select('total')
      .eq('user_id', user.id)
      .eq('status', 'paid')
      .gte('date', currentMonthStart.toISOString())
      .is('deleted_at', null),
    
    // Previous month revenue
    supabase
      .from('invoices')
      .select('total')
      .eq('user_id', user.id)
      .eq('status', 'paid')
      .gte('date', previousMonthStart.toISOString())
      .lte('date', previousMonthEnd.toISOString())
      .is('deleted_at', null),
    
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
    
    // Quotes by status
    supabase
      .from('quotes')
      .select('status')
      .eq('user_id', user.id)
      .is('deleted_at', null)
  ])

  // Calculate totals
  const totalRevenue = paidInvoices.data?.reduce((sum, inv) => sum + Number(inv.total), 0) || 0
  const currentMonthTotal = currentMonthRevenue.data?.reduce((sum, inv) => sum + Number(inv.total), 0) || 0
  const previousMonthTotal = previousMonthRevenue.data?.reduce((sum, inv) => sum + Number(inv.total), 0) || 0
  const overdueTotal = overdueInvoices.data?.reduce((sum, inv) => sum + Number(inv.total), 0) || 0
  
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

  // Process quotes by status
  const quotesStats = {
    accepted: quotesByStatus.data?.filter((q: any) => q.status === 'accepted').length || 0,
    sent: quotesByStatus.data?.filter((q: any) => q.status === 'sent').length || 0,
    rejected: quotesByStatus.data?.filter((q: any) => q.status === 'rejected').length || 0,
    draft: quotesByStatus.data?.filter((q: any) => q.status === 'draft').length || 0,
  }

  // Process invoices by status
  const invoicesStats = {
    paid: invoicesData.data?.filter((inv: any) => inv.status === 'paid').length || 0,
    issued: invoicesData.data?.filter((inv: any) => inv.status === 'issued' && new Date(inv.due_date) >= now).length || 0,
    overdue: overdueInvoices.data?.length || 0,
    draft: invoicesData.data?.filter((inv: any) => inv.status === 'draft').length || 0,
  }

  const stats = [
    {
      title: t('totalRevenue'),
      value: `CHF ${totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      description: t('paidInvoices'),
      trend: revenueTrend,
      trendLabel: revenueTrend >= 0 ? t('vsLastMonth') : t('vsLastMonth'),
    },
    {
      title: tNav('clients'),
      value: clientsCount.count || 0,
      icon: Users,
      description: t('activeClients'),
    },
    {
      title: t('pendingInvoices'),
      value: invoicesStats.issued,
      icon: Clock,
      description: t('awaitingPayment'),
    },
    {
      title: t('overdueInvoices'),
      value: invoicesStats.overdue,
      icon: AlertCircle,
      description: `CHF ${overdueTotal.toFixed(2)}`,
      variant: overdueInvoices.data && overdueInvoices.data.length > 0 ? 'destructive' : 'default',
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

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className={stat.variant === 'destructive' ? 'border-destructive' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.variant === 'destructive' ? 'text-destructive' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
              {stat.trend !== undefined && (
                <div className={`flex items-center gap-1 text-xs mt-1 ${stat.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {stat.trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  <span>{Math.abs(stat.trend).toFixed(1)}% {stat.trendLabel}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

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

