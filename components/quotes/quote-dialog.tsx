'use client'

import type { QuoteWithClient } from '@/lib/types/database'
import { DocumentDialog } from '@/components/documents/document-dialog'

interface QuoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  quote?: QuoteWithClient | null
}

export function QuoteDialog({ open, onOpenChange, onSuccess, quote }: QuoteDialogProps) {
  return (
    <DocumentDialog
      type="quote"
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      document={quote ?? null}
    />
  )
}
