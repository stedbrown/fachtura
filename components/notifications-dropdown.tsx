'use client'

import { Bell, Check, CheckCheck, Trash2, FileText, Receipt, Users, Settings, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useNotifications } from '@/hooks/use-notifications'
import { formatDistanceToNow } from 'date-fns'
import { it, de, fr, enUS } from 'date-fns/locale'
import { useParams, useRouter } from 'next/navigation'
import { ScrollArea } from '@/components/ui/scroll-area'

const localeMap: Record<string, Locale> = {
  it,
  de,
  fr,
  en: enUS,
  rm: it,
}

const typeIcons: Record<string, any> = {
  client_added: Users,
  quote_sent: FileText,
  quote_accepted: FileText,
  quote_rejected: FileText,
  invoice_issued: Receipt,
  invoice_paid: Receipt,
  invoice_overdue: Receipt,
  settings_updated: Settings,
}

const typeColors: Record<string, string> = {
  client_added: 'text-blue-500',
  quote_sent: 'text-purple-500',
  quote_accepted: 'text-green-500',
  quote_rejected: 'text-red-500',
  invoice_issued: 'text-orange-500',
  invoice_paid: 'text-green-500',
  invoice_overdue: 'text-red-500',
  settings_updated: 'text-gray-500',
}

export function NotificationsDropdown() {
  const params = useParams()
  const router = useRouter()
  const locale = (params.locale as string) || 'it'
  const dateLocale = localeMap[locale] || it
  
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications()

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id)
    
    // Navigate based on entity type
    if (notification.entity_type && notification.entity_id) {
      const paths: Record<string, string> = {
        client: `/${locale}/dashboard/clients/${notification.entity_id}`,
        quote: `/${locale}/dashboard/quotes/${notification.entity_id}`,
        invoice: `/${locale}/dashboard/invoices/${notification.entity_id}`,
        settings: `/${locale}/dashboard/settings`,
      }
      
      const path = paths[notification.entity_type]
      if (path) {
        router.push(path)
      }
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative shrink-0">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifiche</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-auto p-1 text-xs"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Segna tutte lette
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Caricamento...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">
              Nessuna notifica
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            {notifications.map((notification) => {
              const Icon = typeIcons[notification.type] || Bell
              const iconColor = typeColors[notification.type] || 'text-gray-500'
              
              return (
                <DropdownMenuItem
                  key={notification.id}
                  className={`flex items-start gap-3 p-3 cursor-pointer ${
                    !notification.is_read ? 'bg-primary/5' : ''
                  }`}
                  onSelect={(e) => {
                    e.preventDefault()
                    handleNotificationClick(notification)
                  }}
                >
                  <div className={`mt-0.5 ${iconColor}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight">
                        {notification.title}
                      </p>
                      {!notification.is_read && (
                        <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: dateLocale,
                        })}
                      </p>
                      <div className="flex gap-1">
                        {!notification.is_read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation()
                              markAsRead(notification.id)
                            }}
                            title="Segna come letto"
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteNotification(notification.id)
                          }}
                          title="Elimina"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </DropdownMenuItem>
              )
            })}
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

