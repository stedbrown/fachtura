'use client'

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig } from '@/components/ui/chart'
import { useTranslations } from 'next-intl'
import { Area, AreaChart, Bar, BarChart, Pie, PieChart, Cell, XAxis, YAxis, CartesianGrid, RadialBarChart, RadialBar, LabelList } from 'recharts'
import { format, parse } from 'date-fns'
import { it, enUS, de, fr, type Locale } from 'date-fns/locale'
import { TrendingUp, TrendingDown } from 'lucide-react'

export interface DashboardChartVisibility {
  revenueChart: boolean
  acceptanceRate: boolean
  topClients: boolean
  quotesDistribution: boolean
  invoicesDistribution: boolean
  documentsComparison: boolean
}

interface DashboardChartsProps {
  monthlyData: { month: string; total: number }[]
  topClients: { name: string; total: number }[]
  quotesStats: { accepted: number; sent: number; rejected: number; draft: number }
  invoicesStats: { paid: number; issued: number; overdue: number; draft: number }
  locale: string
  visibility?: DashboardChartVisibility
}

const localeMap: Record<string, Locale> = {
  it,
  en: enUS,
  de,
  fr,
  rm: de,
}

export function DashboardCharts({
  monthlyData,
  topClients,
  quotesStats,
  invoicesStats,
  locale,
  visibility = {
    revenueChart: true,
    acceptanceRate: true,
    topClients: true,
    quotesDistribution: true,
    invoicesDistribution: true,
    documentsComparison: true,
  },
}: DashboardChartsProps) {
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const tQuotes = useTranslations('quotes.status')
  const tInvoices = useTranslations('invoices.status')

  const dateLocale = localeMap[locale] || enUS

  // Format monthly data
  const formattedMonthlyData = monthlyData.map((item) => ({
    ...item,
    monthLabel: format(parse(item.month, 'yyyy-MM', new Date()), 'MMM yyyy', { locale: dateLocale }),
  }))

  // Calculate trend
  const totalRevenue = monthlyData.reduce((acc, item) => acc + item.total, 0)
  const lastMonth = monthlyData[monthlyData.length - 1]?.total || 0
  const secondLastMonth = monthlyData[monthlyData.length - 2]?.total || 1
  const trendPercent = secondLastMonth > 0 ? ((lastMonth - secondLastMonth) / secondLastMonth) * 100 : 0

  // Chart configs following Shadcn UI pattern with direct CSS var references
  const revenueChartConfig = {
    total: {
      label: t('revenue'),
      color: 'var(--chart-1)',
    },
  } satisfies ChartConfig

  const topClientsChartConfig = {
    total: {
      label: t('revenue'),
      color: 'var(--chart-2)',
    },
  } satisfies ChartConfig

  // Quotes chart config
  const quotesChartConfig = {
    accepted: {
      label: tQuotes('accepted'),
      color: 'var(--chart-1)',
    },
    sent: {
      label: tQuotes('sent'),
      color: 'var(--chart-2)',
    },
    rejected: {
      label: tQuotes('rejected'),
      color: 'var(--chart-4)',
    },
    draft: {
      label: tQuotes('draft'),
      color: 'var(--chart-3)',
    },
  } satisfies ChartConfig

  // Prepare quotes data with fill for Pie Charts
  const quotesChartData = [
    { status: 'accepted', value: quotesStats.accepted, fill: 'var(--color-accepted)' },
    { status: 'sent', value: quotesStats.sent, fill: 'var(--color-sent)' },
    { status: 'rejected', value: quotesStats.rejected, fill: 'var(--color-rejected)' },
    { status: 'draft', value: quotesStats.draft, fill: 'var(--color-draft)' },
  ].filter((item) => item.value > 0)

  // Invoices chart config
  const invoicesChartConfig = {
    paid: {
      label: tInvoices('paid'),
      color: 'var(--chart-1)',
    },
    issued: {
      label: tInvoices('issued'),
      color: 'var(--chart-3)',
    },
    overdue: {
      label: tInvoices('overdue'),
      color: 'var(--chart-5)',
    },
    draft: {
      label: tInvoices('draft'),
      color: 'var(--chart-2)',
    },
  } satisfies ChartConfig

  // Prepare invoices data with fill for Pie Charts
  const invoicesChartData = [
    { status: 'paid', value: invoicesStats.paid, fill: 'var(--color-paid)' },
    { status: 'issued', value: invoicesStats.issued, fill: 'var(--color-issued)' },
    { status: 'overdue', value: invoicesStats.overdue, fill: 'var(--color-overdue)' },
    { status: 'draft', value: invoicesStats.draft, fill: 'var(--color-draft)' },
  ].filter((item) => item.value > 0)

  // Calculate quotes acceptance rate
  const totalQuotes = Object.values(quotesStats).reduce((a, b) => a + b, 0)
  const acceptanceRate = totalQuotes > 0 ? (quotesStats.accepted / totalQuotes) * 100 : 0

  // Comparison chart config
  const comparisonChartConfig = {
    quotes: {
      label: tCommon('quotes'),
      color: 'var(--chart-2)',
    },
    invoices: {
      label: tCommon('invoices'),
      color: 'var(--chart-1)',
    },
  } satisfies ChartConfig

  // Prepare comparison data with fill for Bar Charts
  const comparisonData = [
    {
      category: 'quotes',
      value: Object.values(quotesStats).reduce((a, b) => a + b, 0),
      fill: 'var(--color-quotes)',
    },
    {
      category: 'invoices',
      value: Object.values(invoicesStats).reduce((a, b) => a + b, 0),
      fill: 'var(--color-invoices)',
    },
  ]

  // Radial chart config
  const radialChartConfig = {
    accepted: {
      label: t('acceptanceRate'),
      color: 'var(--chart-1)',
    },
  } satisfies ChartConfig

  // Radial chart data with fill
  const radialData = [
    {
      name: 'accepted',
      value: acceptanceRate,
      fill: 'var(--color-accepted)',
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Monthly Revenue Line Chart */}
      {visibility.revenueChart && (
      <Card className="col-span-full lg:col-span-2">
        <CardHeader>
          <CardTitle>{t('revenueChart')}</CardTitle>
          <CardDescription>{t('revenueChartDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={revenueChartConfig} className="h-[300px] w-full">
            <AreaChart accessibilityLayer data={formattedMonthlyData}>
              <defs>
                <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
              <XAxis
                dataKey="monthLabel"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => value.slice(0, 3)}
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
              <Area
                dataKey="total"
                type="monotone"
                fill="url(#fillRevenue)"
                fillOpacity={0.4}
                stroke="var(--color-total)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
        <CardFooter>
          <div className="flex w-full items-start gap-2 text-sm">
            <div className="grid gap-2">
              <div className="flex items-center gap-2 font-medium leading-none">
                {trendPercent > 0 ? (
                  <>
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    <span>Trending up by {Math.abs(trendPercent).toFixed(1)}% this month</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    <span>Trending down by {Math.abs(trendPercent).toFixed(1)}% this month</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 leading-none text-muted-foreground">
                {formattedMonthlyData[0]?.monthLabel} - {formattedMonthlyData[formattedMonthlyData.length - 1]?.monthLabel}
              </div>
            </div>
          </div>
        </CardFooter>
      </Card>
      )}

      {/* Quotes Acceptance Rate Radial Chart */}
      {visibility.acceptanceRate && (
      <Card className="flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle>{t('acceptanceRate')}</CardTitle>
          <CardDescription>{t('quotesAcceptanceRate')}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pb-0">
          {totalQuotes === 0 ? (
            <p className="text-center py-8 text-muted-foreground">{t('noDataAvailable')}</p>
          ) : (
            <ChartContainer
              config={radialChartConfig}
              className="mx-auto aspect-square max-h-[250px]"
            >
              <RadialBarChart 
                accessibilityLayer 
                data={radialData} 
                startAngle={90} 
                endAngle={-270} 
                innerRadius={80} 
                outerRadius={140}
              >
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <RadialBar 
                  dataKey="value" 
                  background 
                  fill="var(--color-accepted)"
                  cornerRadius={10}
                />
              </RadialBarChart>
            </ChartContainer>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-2 text-sm pt-4">
          <div className="flex items-center gap-2 font-medium leading-none">
            {acceptanceRate.toFixed(1)}% {t('accepted')}
            {acceptanceRate > 50 ? (
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-amber-500" />
            )}
          </div>
          <div className="leading-none text-muted-foreground">
            {quotesStats.accepted} {t('of')} {totalQuotes} {tCommon('quotes').toLowerCase()}
          </div>
        </CardFooter>
      </Card>
      )}

      {/* Top Clients Bar Chart */}
      {visibility.topClients && (
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{t('topClients')}</CardTitle>
          <CardDescription>{t('topClientsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {topClients.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">{t('noDataAvailable')}</p>
          ) : (
            <ChartContainer config={topClientsChartConfig} className="h-[300px] w-full">
              <BarChart accessibilityLayer data={topClients}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) => value.slice(0, 10)}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="total" fill="var(--color-total)" radius={8} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
      )}

      {/* Quotes Distribution Pie Chart */}
      {visibility.quotesDistribution && (
      <Card className="flex flex-col">
        <CardHeader className="pb-0">
          <CardTitle>{t('quotesDistribution')}</CardTitle>
          <CardDescription>{t('quotesDistributionDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pb-0">
          {quotesChartData.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">{t('noDataAvailable')}</p>
          ) : (
            <ChartContainer
              config={quotesChartConfig}
              className="mx-auto aspect-square max-h-[250px]"
            >
              <PieChart accessibilityLayer>
                <ChartTooltip cursor={false} content={<ChartTooltipContent nameKey="status" />} />
                <Pie
                  data={quotesChartData}
                  dataKey="value"
                  nameKey="status"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {quotesChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-2 text-sm">
          <div className="flex items-center gap-2 font-medium leading-none">
            {Object.values(quotesStats).reduce((a, b) => a + b, 0)} {tCommon('quotes')} {tCommon('total').toLowerCase()}
          </div>
        </CardFooter>
      </Card>
      )}

      {/* Invoices Distribution Pie Chart */}
      {visibility.invoicesDistribution && (
      <Card className="flex flex-col">
        <CardHeader className="pb-0">
          <CardTitle>{t('invoicesDistribution')}</CardTitle>
          <CardDescription>{t('invoicesDistributionDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pb-0">
          {invoicesChartData.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">{t('noDataAvailable')}</p>
          ) : (
            <ChartContainer
              config={invoicesChartConfig}
              className="mx-auto aspect-square max-h-[250px]"
            >
              <PieChart accessibilityLayer>
                <ChartTooltip cursor={false} content={<ChartTooltipContent nameKey="status" />} />
                <Pie
                  data={invoicesChartData}
                  dataKey="value"
                  nameKey="status"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {invoicesChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-2 text-sm">
          <div className="flex items-center gap-2 font-medium leading-none">
            {Object.values(invoicesStats).reduce((a, b) => a + b, 0)} {tCommon('invoices')} {tCommon('total').toLowerCase()}
          </div>
        </CardFooter>
      </Card>
      )}

      {/* Quotes vs Invoices Comparison Bar Chart */}
      {visibility.documentsComparison && (
      <Card className="col-span-full lg:col-span-2">
        <CardHeader>
          <CardTitle>{t('documentsComparison')}</CardTitle>
          <CardDescription>{t('documentsComparisonDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={comparisonChartConfig} className="h-[200px] w-full">
            <BarChart accessibilityLayer data={comparisonData} layout="vertical">
              <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
              <YAxis
                dataKey="category"
                type="category"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                width={100}
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <XAxis type="number" hide />
              <ChartTooltip cursor={false} content={<ChartTooltipContent nameKey="category" />} />
              <Bar dataKey="value" radius={8}>
                {comparisonData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
                <LabelList
                  dataKey="value"
                  position="right"
                  offset={8}
                  className="fill-foreground"
                  fontSize={12}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
        <CardFooter>
          <div className="flex w-full items-start gap-2 text-sm">
            <div className="grid gap-2">
              <div className="flex items-center gap-2 leading-none text-muted-foreground">
                {t('totalDocumentsCreated')}
              </div>
            </div>
          </div>
        </CardFooter>
      </Card>
      )}
    </div>
  )
}
