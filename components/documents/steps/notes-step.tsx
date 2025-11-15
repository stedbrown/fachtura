'use client'

import * as React from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'

interface NotesStepProps {
  notes: string
  onNotesChange: (notes: string) => void
  placeholder?: string
  t: (key: string) => string
}

export function NotesStep({ notes, onNotesChange, placeholder, t }: NotesStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Note Aggiuntive</h2>
        <p className="text-sm text-muted-foreground">
          Aggiungi note o condizioni particolari al documento
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">
              {t('notes')}
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={6}
              className="resize-none text-sm"
              placeholder={placeholder || 'Aggiungi note, condizioni di pagamento, termini...'}
            />
            <p className="text-xs text-muted-foreground">
              Queste note appariranno sul documento finale
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

