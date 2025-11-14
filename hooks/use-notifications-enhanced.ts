import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  entity_type?: string
  entity_id?: string
  is_read: boolean
  created_at: string
  priority?: 'urgent' | 'high' | 'medium' | 'low'
  channels?: string[]
  metadata?: Record<string, any>
  action_url?: string
  action_label?: string
  expires_at?: string
  is_archived?: boolean
  read_at?: string
}

export interface NotificationFilters {
  is_read?: boolean
  priority?: string
  type?: string
  entity_type?: string
  is_archived?: boolean
}

export function useNotificationsEnhanced(filters?: NotificationFilters) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)

  const loadNotifications = useCallback(async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setNotifications([])
        setUnreadCount(0)
        setTotalCount(0)
        setLoading(false)
        return
      }

      // Build query with filters
      let query = supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      // Apply filters
      if (filters?.is_read !== undefined) {
        query = query.eq('is_read', filters.is_read)
      }
      if (filters?.priority) {
        query = query.eq('priority', filters.priority)
      }
      if (filters?.type) {
        query = query.eq('type', filters.type)
      }
      if (filters?.entity_type) {
        query = query.eq('entity_type', filters.entity_type)
      }
      if (filters?.is_archived !== undefined) {
        query = query.eq('is_archived', filters.is_archived)
      } else {
        // Default: exclude archived
        query = query.eq('is_archived', false)
      }

      // Limit for UI (can be made configurable)
      query = query.limit(100)

      const { data, error, count } = await query

      if (error) throw error

      // Get accurate unread count (all notifications, not just loaded ones)
      const { count: unreadCountTotal, error: countError } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .eq('is_archived', false)

      if (countError) {
        logger.error('Error counting unread notifications', countError)
        if (data) {
          setNotifications(data)
          setUnreadCount(data.filter((n) => !n.is_read).length)
          setTotalCount(count || 0)
        }
      } else {
        if (data) {
          setNotifications(data)
          setUnreadCount(unreadCountTotal || 0)
          setTotalCount(count || 0)
        }
      }
    } catch (error) {
      logger.error('Error loading notifications', error)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadNotifications()
    
    // Subscribe to real-time changes
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return

      channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            logger.debug('Real-time notification change', { payload })
            loadNotifications()
          }
        )
        .subscribe((status) => {
          logger.debug('Subscription status', { status })
        })
    })

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [loadNotifications])

  const markAsRead = async (notificationId: string) => {
    try {
      const supabase = createClient()
      
      // Use the enhanced function with timestamp
      const { error } = await supabase.rpc('mark_notification_read', {
        p_notification_id: notificationId,
      })

      if (error) throw error

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
        )
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (error) {
      logger.error('Error marking notification as read', error, { notificationId })
    }
  }

  const markAllAsRead = async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .eq('is_archived', false)

      if (error) throw error

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() })))
      setUnreadCount(0)
    } catch (error) {
      logger.error('Error marking all as read', error)
    }
  }

  const deleteNotification = async (notificationId: string) => {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)

      if (error) throw error

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
      setUnreadCount((prev) => {
        const notification = notifications.find((n) => n.id === notificationId)
        return notification && !notification.is_read ? prev - 1 : prev
      })
    } catch (error) {
      logger.error('Error deleting notification', error, { notificationId })
    }
  }

  const archiveNotification = async (notificationId: string) => {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('notifications')
        .update({ is_archived: true })
        .eq('id', notificationId)

      if (error) throw error

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
    } catch (error) {
      logger.error('Error archiving notification', error, { notificationId })
    }
  }

  const archiveOld = async (daysOld: number = 90) => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data, error } = await supabase.rpc('archive_old_notifications', {
        p_user_id: user.id,
        p_days_old: daysOld,
      })

      if (error) throw error

      // Reload notifications
      await loadNotifications()
      
      return data
    } catch (error) {
      logger.error('Error archiving old notifications', error)
      return 0
    }
  }

  return {
    notifications,
    unreadCount,
    totalCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    archiveNotification,
    archiveOld,
    refetch: loadNotifications,
  }
}

