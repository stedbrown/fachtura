/**
 * Helper function to translate notification titles and messages
 * Since notifications are stored in the database with Italian text,
 * we translate them in the frontend based on the notification type and metadata
 */

import type { Notification } from '@/hooks/use-notifications-enhanced'

interface TranslationParams {
  [key: string]: string | number | undefined
}

/**
 * Translates a notification title and message based on type and metadata
 * @param notification - The notification object from database
 * @param t - Translation function from next-intl (useTranslations('notifications'))
 */
export function translateNotification(
  notification: Notification,
  t: (key: string, params?: TranslationParams) => string
): { title: string; message: string } {
  const typeKey = `types.${notification.type}`
  
  // Try to get translation
  let title: string
  let message: string
  
  try {
    title = t(`${typeKey}.title`)
    message = t(`${typeKey}.message`)
    
    // If translation returns the key itself, it means translation doesn't exist
    if (title === `${typeKey}.title`) {
      title = notification.title
    }
    if (message === `${typeKey}.message`) {
      message = notification.message
    }
  } catch {
    // Fallback to database values if translation fails
    title = notification.title
    message = notification.message
  }
  
  // Extract parameters from metadata
  const metadata = notification.metadata || {}
  const params: TranslationParams = {}
  
  // Common parameters from metadata
  if (metadata.invoice_number) params.number = String(metadata.invoice_number)
  if (metadata.quote_number) params.number = String(metadata.quote_number)
  if (metadata.order_number) params.number = String(metadata.order_number)
  if (metadata.client_name) params.name = String(metadata.client_name)
  if (metadata.product_name) params.name = String(metadata.product_name)
  if (metadata.supplier_name) params.name = String(metadata.supplier_name)
  if (metadata.total) params.total = String(metadata.total)
  if (metadata.amount) params.amount = String(metadata.amount)
  if (metadata.currency) params.currency = String(metadata.currency)
  if (metadata.quantity) params.quantity = String(metadata.quantity)
  if (metadata.max) params.max = String(metadata.max)
  if (metadata.current) params.current = String(metadata.current)
  if (metadata.current_count) params.current = String(metadata.current_count)
  if (metadata.max_count) params.max = String(metadata.max_count)
  if (metadata.percentage) params.percentage = String(metadata.percentage)
  if (metadata.plan_name) params.plan = String(metadata.plan_name)
  if (metadata.status) params.status = String(metadata.status)
  if (metadata.date) params.date = String(metadata.date)
  if (metadata.time) params.time = String(metadata.time)
  
  // Try to extract from message if metadata is empty
  if (Object.keys(params).length === 0 && notification.message) {
    // Extract invoice/quote number from message
    const numberMatch = notification.message.match(/(INV|QT|ORD)-\d+-\d+/)
    if (numberMatch) params.number = numberMatch[0]
    
    // Extract amount from message
    const amountMatch = notification.message.match(/(\d+\.?\d*)\s*CHF/)
    if (amountMatch) {
      params.total = amountMatch[1]
      params.currency = 'CHF'
    }
    
    // Extract client/product name from message
    const nameMatch = notification.message.match(/"([^"]+)"/)
    if (nameMatch) params.name = nameMatch[1]
  }
  
  // Get resource label for subscription notifications
  if (notification.type.includes('subscription') && metadata.resource_type) {
    try {
      const resourceKey = `subscription.resources.${metadata.resource_type}`
      params.resource = t(resourceKey as any)
    } catch {
      // Fallback to Italian labels
      const resourceLabels: Record<string, string> = {
        invoice: 'fatture',
        quote: 'preventivi',
        client: 'clienti',
        product: 'prodotti',
        order: 'ordini',
        supplier: 'fornitori',
        expense: 'spese',
      }
      params.resource = resourceLabels[metadata.resource_type as string] || String(metadata.resource_type)
    }
  }
  
  // Replace parameters in translated strings
  if (Object.keys(params).length > 0) {
    title = title.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key]?.toString() || match
    })
    message = message.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key]?.toString() || match
    })
  }
  
  return { title, message }
}

