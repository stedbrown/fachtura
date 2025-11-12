'use client'

import type { InvoiceWithClient } from '@/lib/types/database'
import { DocumentDialog } from '@/components/documents/document-dialog'

interface InvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  invoice?: InvoiceWithClient | null
}

export function InvoiceDialog({ open, onOpenChange, onSuccess, invoice }: InvoiceDialogProps) {
  return (
    <DocumentDialog
      type="invoice"
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      document={invoice ?? null}
    />
  )
}
