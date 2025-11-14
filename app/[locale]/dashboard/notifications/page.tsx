'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useNotificationsEnhanced, type Notification, type NotificationFilters } from '@/hooks/use-notifications-enhanced'
import { formatDistanceToNow } from 'date-fns'
import { it, de, fr, enUS, type Locale } from 'date-fns/locale'
import { useParams, useRouter } from 'next/navigation'
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  Archive, 
  Filter,
  Search,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

const localeMap: Record<string, Locale> = {
  it,
  de,
  fr,
  en: enUS,
  rm: it,
}

const priorityIcons = {
  urgent: AlertCircle,
  high: AlertTriangle,
  medium: Info,
  low: CheckCircle,
}

const priorityColors = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-blue-500',
  low: 'bg-gray-500',
}

export default function NotificationsPage() {
  const params = useParams()
  const locale = (params.locale as string) || 'it'
  const router = useRouter()
  const t = useTranslations('notifications')
  const tCommon = useTranslations('common')

  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'archived'>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Build filters based on active tab and filters
  const filters: NotificationFilters = {
    is_archived: activeTab === 'archived' ? true : false,
    is_read: activeTab === 'unread' ? false : undefined,
    priority: priorityFilter !== 'all' ? priorityFilter : undefined,
    type: typeFilter !== 'all' ? typeFilter : undefined,
  }

  const {
    notifications,
    unreadCount,
    totalCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    archiveNotification,
    archiveOld,
  } = useNotificationsEnhanced(filters)

  // Filter by search query
  const filteredNotifications = notifications.filter((n) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      n.title.toLowerCase().includes(query) ||
      n.message.toLowerCase().includes(query) ||
      n.type.toLowerCase().includes(query)
    )
  })

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id)
    }
    if (notification.action_url) {
      router.push(`/${locale}${notification.action_url}`)
    }
  }

  const handleArchiveOld = async () => {
    const count = await archiveOld(90)
    if (count > 0) {
      toast.success(tCommon('success'), {
        description: `${count} notifiche archiviate`,
      })
    } else {
      toast.info(tCommon('info'), {
        description: 'Nessuna notifica da archiviare',
      })
    }
  }

  const PriorityBadge = ({ priority }: { priority?: string }) => {
    if (!priority || priority === 'medium') return null
    const Icon = priorityIcons[priority as keyof typeof priorityIcons] || Info
    const color = priorityColors[priority as keyof typeof priorityColors] || 'bg-gray-500'
    return (
      <Badge variant="outline" className={`${color} text-white border-0`}>
        <Icon className="h-3 w-3 mr-1" />
        {priority}
      </Badge>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title') || 'Notifiche'}</h1>
          <p className="text-muted-foreground mt-1">
            {t('description') || 'Gestisci tutte le tue notifiche'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleArchiveOld}
            disabled={loading}
          >
            <Archive className="h-4 w-4 mr-2" />
            {t('archiveOld') || 'Archivia vecchie'}
          </Button>
          {activeTab !== 'archived' && (
            <Button
              variant="outline"
              onClick={markAllAsRead}
              disabled={loading || unreadCount === 0}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              {t('markAllRead') || 'Segna tutte lette'}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('notifications') || 'Notifiche'}</CardTitle>
              <CardDescription>
                {totalCount} {tCommon('items')} • {unreadCount} {t('unread') || 'non lette'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="all">
                  {t('all') || 'Tutte'} ({totalCount})
                </TabsTrigger>
                <TabsTrigger value="unread">
                  {t('unread') || 'Non lette'} ({unreadCount})
                </TabsTrigger>
                <TabsTrigger value="archived">
                  {t('archived') || 'Archiviate'}
                </TabsTrigger>
              </TabsList>

              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('search') || 'Cerca...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 w-64"
                  />
                </div>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder={t('priority') || 'Priorità'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all') || 'Tutte'}</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder={t('type') || 'Tipo'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all') || 'Tutti'}</SelectItem>
                    <SelectItem value="invoice_paid">Fatture pagate</SelectItem>
                    <SelectItem value="invoice_overdue">Fatture scadute</SelectItem>
                    <SelectItem value="quote_accepted">Preventivi accettati</SelectItem>
                    <SelectItem value="subscription_limit_warning">Limiti abbonamento</SelectItem>
                    <SelectItem value="product_low_stock">Prodotti in esaurimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <TabsContent value={activeTab} className="mt-0">
              {loading ? (
                <div className="text-center py-12 text-muted-foreground">
                  {t('loading') || 'Caricamento...'}
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t('noNotifications') || 'Nessuna notifica'}</p>
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-2">
                    {filteredNotifications.map((notification) => (
                      <Card
                        key={notification.id}
                        className={`cursor-pointer transition-colors ${
                          !notification.is_read
                            ? 'bg-muted/50 border-l-4 border-l-primary'
                            : ''
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold">{notification.title}</h3>
                                <PriorityBadge priority={notification.priority} />
                                {!notification.is_read && (
                                  <Badge variant="secondary" className="text-xs">
                                    {t('new') || 'Nuova'}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {notification.message}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>
                                  {formatDistanceToNow(new Date(notification.created_at), {
                                    addSuffix: true,
                                    locale: localeMap[locale],
                                  })}
                                </span>
                                {notification.action_label && (
                                  <span className="text-primary font-medium">
                                    {notification.action_label} →
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              {!notification.is_read && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    markAsRead(notification.id)
                                  }}
                                >
                                  <CheckCheck className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (activeTab === 'archived') {
                                    deleteNotification(notification.id)
                                  } else {
                                    archiveNotification(notification.id)
                                  }
                                }}
                              >
                                {activeTab === 'archived' ? (
                                  <Trash2 className="h-4 w-4" />
                                ) : (
                                  <Archive className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

