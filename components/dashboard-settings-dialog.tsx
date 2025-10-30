'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Settings2 } from 'lucide-react'
import { toast } from 'sonner'

export interface DashboardChartVisibility {
  revenueChart: boolean
  acceptanceRate: boolean
  topClients: boolean
  quotesDistribution: boolean
  invoicesDistribution: boolean
  documentsComparison: boolean
}

interface DashboardSettingsDialogProps {
  visibility: DashboardChartVisibility
  onSave: (visibility: DashboardChartVisibility) => void
}

export function DashboardSettingsDialog({ visibility, onSave }: DashboardSettingsDialogProps) {
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [localVisibility, setLocalVisibility] = useState<DashboardChartVisibility>(visibility)

  // Sync localVisibility with visibility prop when dialog opens
  useEffect(() => {
    if (open) {
      setLocalVisibility(visibility)
    }
  }, [open, visibility])

  const handleSave = () => {
    onSave(localVisibility)
    setOpen(false)
    toast.success(t('settingsSaved'))
  }

  const handleReset = () => {
    const defaultVisibility: DashboardChartVisibility = {
      revenueChart: true,
      acceptanceRate: true,
      topClients: true,
      quotesDistribution: true,
      invoicesDistribution: true,
      documentsComparison: true,
    }
    setLocalVisibility(defaultVisibility)
  }

  const charts = [
    { key: 'revenueChart' as const, label: t('revenueChart') },
    { key: 'acceptanceRate' as const, label: t('acceptanceRate') },
    { key: 'topClients' as const, label: t('topClients') },
    { key: 'quotesDistribution' as const, label: t('quotesDistribution') },
    { key: 'invoicesDistribution' as const, label: t('invoicesDistribution') },
    { key: 'documentsComparison' as const, label: t('documentsComparison') },
  ]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-2" />
          {t('customizeDashboard')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('customizeDashboard')}</DialogTitle>
          <DialogDescription>{t('customizeDashboardDescription')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {charts.map((chart) => (
            <div key={chart.key} className="flex items-center space-x-2">
              <Checkbox
                id={chart.key}
                checked={localVisibility[chart.key]}
                onCheckedChange={(checked) => {
                  setLocalVisibility((prev) => ({
                    ...prev,
                    [chart.key]: checked === true,
                  }))
                }}
              />
              <Label
                htmlFor={chart.key}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {chart.label}
              </Label>
            </div>
          ))}
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="outline" onClick={handleReset}>
            {t('resetToDefault')}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleSave}>{tCommon('save')}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

