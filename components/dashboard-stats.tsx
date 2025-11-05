'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, AlertCircle, DollarSign, Users, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface Stat {
  title: string
  value: string | number
  icon: string
  description: string
  trend?: number
  trendLabel?: string
  variant?: 'default' | 'destructive'
  link?: string
}

// Icon mapping
const iconMap = {
  DollarSign,
  Users,
  Clock,
  AlertCircle,
}

interface DashboardStatsProps {
  stats: Stat[]
  locale: string
}

export function DashboardStats({ stats, locale }: DashboardStatsProps) {
  const router = useRouter()

  const handleCardClick = (link?: string) => {
    if (link) {
      router.push(`/${locale}${link}`)
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const IconComponent = iconMap[stat.icon as keyof typeof iconMap] || AlertCircle
        
        return (
          <Card 
            key={stat.title} 
            className={`${stat.variant === 'destructive' ? 'border-destructive' : ''} ${stat.link ? 'cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]' : ''}`}
            onClick={() => handleCardClick(stat.link)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <IconComponent className={`h-4 w-4 ${stat.variant === 'destructive' ? 'text-destructive' : 'text-muted-foreground'}`} />
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
        )
      })}
    </div>
  )
}

interface OverdueAlertProps {
  count: number
  amount: string
  locale: string
}

export function OverdueAlert({ count, amount, locale }: OverdueAlertProps) {
  const router = useRouter()
  const t = useTranslations('dashboard')

  const handleClick = () => {
    router.push(`/${locale}/dashboard/invoices?status=overdue`)
  }

  return (
    <Card 
      className="border-destructive bg-destructive/5 cursor-pointer transition-all hover:shadow-md hover:bg-destructive/10"
      onClick={handleClick}
    >
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-destructive mb-1">
              {t('overdueInvoices')}: {count}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('overdueAlert', { count, amount })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

