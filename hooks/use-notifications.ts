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
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const loadNotifications = useCallback(async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setNotifications([])
        setUnreadCount(0)
        setLoading(false)
        return
      }

      // Load notifications (limit 50 for UI)
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      // Get accurate unread count (all notifications, not just loaded ones)
      const { count: unreadCountTotal, error: countError } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

      if (countError) {
        logger.error('Error counting unread notifications', countError)
        // Fallback to counting loaded notifications
        if (data) {
          setNotifications(data)
          setUnreadCount(data.filter((n) => !n.is_read).length)
        }
      } else {
        if (data) {
          setNotifications(data)
          setUnreadCount(unreadCountTotal || 0)
        }
      }
    } catch (error) {
      logger.error('Error loading notifications', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadNotifications()
    
    // Subscribe to real-time changes
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    
    // Get user ID for filtering
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
            filter: `user_id=eq.${user.id}`, // Filter by user_id for real-time
          },
          (payload) => {
            logger.debug('Real-time notification change', { payload })
            loadNotifications()
          }
        )
        .subscribe((status) => {
          logger.debug('Subscription status', { status })
          if (status === 'SUBSCRIBED') {
            logger.debug('Successfully subscribed to notifications')
          }
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
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)

      if (error) throw error

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n
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
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false)

      if (error) throw error

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
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

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refetch: loadNotifications,
  }
}

