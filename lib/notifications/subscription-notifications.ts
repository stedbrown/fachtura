/**
 * Utility functions for subscription-related notifications
 * These are called from the subscription hooks/API routes
 */

import { createClient } from '@/lib/supabase/client'

export interface SubscriptionLimitNotification {
  resourceType: 'invoice' | 'quote' | 'client' | 'product' | 'order' | 'supplier' | 'expense'
  currentCount: number
  maxCount: number
  planName: string
}

/**
 * Create notification when subscription limit is reached
 */
export async function notifySubscriptionLimitReached(
  userId: string,
  data: SubscriptionLimitNotification
) {
  const supabase = createClient()
  
  const resourceLabels: Record<string, string> = {
    invoice: 'fatture',
    quote: 'preventivi',
    client: 'clienti',
    product: 'prodotti',
    order: 'ordini',
    supplier: 'fornitori',
    expense: 'spese',
  }

  const resourceLabel = resourceLabels[data.resourceType] || data.resourceType

  // Call the enhanced create_notification function via RPC
  const { error } = await supabase.rpc('create_notification', {
    p_user_id: userId,
    p_type: 'subscription_limit_reached',
    p_title: 'Limite abbonamento raggiunto',
    p_message: `Hai raggiunto il limite di ${data.maxCount} ${resourceLabel} del piano ${data.planName}.`,
    p_entity_type: 'subscription',
    p_entity_id: null,
    p_priority: 'high',
    p_channels: ['in_app', 'email'],
    p_metadata: JSON.stringify({
      resource_type: data.resourceType,
      current_count: data.currentCount,
      max_count: data.maxCount,
      plan_name: data.planName,
    }),
    p_action_url: '/dashboard/subscription',
    p_action_label: 'Aggiorna abbonamento',
  })

  if (error) {
    console.error('Error creating subscription limit notification:', error)
  }
}

/**
 * Create notification when subscription limit is at 80% (warning)
 */
export async function notifySubscriptionLimitWarning(
  userId: string,
  data: SubscriptionLimitNotification
) {
  const supabase = createClient()
  
  const resourceLabels: Record<string, string> = {
    invoice: 'fatture',
    quote: 'preventivi',
    client: 'clienti',
    product: 'prodotti',
    order: 'ordini',
    supplier: 'fornitori',
    expense: 'spese',
  }

  const resourceLabel = resourceLabels[data.resourceType] || data.resourceType
  const percentage = Math.round((data.currentCount / data.maxCount) * 100)

  const { error } = await supabase.rpc('create_notification', {
    p_user_id: userId,
    p_type: 'subscription_limit_warning',
    p_title: 'Avviso limite abbonamento',
    p_message: `Hai utilizzato ${percentage}% del limite di ${resourceLabel} (${data.currentCount}/${data.maxCount}).`,
    p_entity_type: 'subscription',
    p_entity_id: null,
    p_priority: 'medium',
    p_channels: ['in_app'],
    p_metadata: JSON.stringify({
      resource_type: data.resourceType,
      current_count: data.currentCount,
      max_count: data.maxCount,
      percentage,
      plan_name: data.planName,
    }),
    p_action_url: '/dashboard/subscription',
    p_action_label: 'Visualizza abbonamento',
  })

  if (error) {
    console.error('Error creating subscription warning notification:', error)
  }
}

