import { createClient } from '@/lib/supabase/server'

/**
 * Automatically updates invoices status to 'overdue' if they meet the criteria:
 * - Status is 'issued' (not draft, not paid, not already overdue)
 * - due_date has passed
 * - deleted_at is null
 */
export async function updateOverdueInvoices() {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { updated: 0, error: 'Not authenticated' }

  const now = new Date().toISOString()

  // Find all invoices that should be marked as overdue
  const { data: overdueInvoices, error: selectError } = await supabase
    .from('invoices')
    .select('id, invoice_number, due_date')
    .eq('user_id', user.id)
    .eq('status', 'issued') // Only update issued invoices
    .lt('due_date', now) // Due date has passed
    .is('deleted_at', null)

  if (selectError) {
    console.error('Error finding overdue invoices:', selectError)
    return { updated: 0, error: selectError.message }
  }

  if (!overdueInvoices || overdueInvoices.length === 0) {
    return { updated: 0, error: null }
  }

  // Update all found invoices to 'overdue' status
  const { error: updateError, count } = await supabase
    .from('invoices')
    .update({ status: 'overdue', updated_at: now })
    .in('id', overdueInvoices.map(inv => inv.id))

  if (updateError) {
    console.error('Error updating overdue invoices:', updateError)
    return { updated: 0, error: updateError.message }
  }

  console.log(`✓ Marked ${count || 0} invoices as overdue`)
  
  return { 
    updated: count || 0, 
    error: null,
    invoices: overdueInvoices.map(inv => inv.invoice_number)
  }
}

