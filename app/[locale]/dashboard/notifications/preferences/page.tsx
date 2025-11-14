'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'

interface NotificationPreference {
  id?: string
  notification_type: string
  enabled_in_app: boolean
  enabled_email: boolean
  enabled_push: boolean
  priority: 'urgent' | 'high' | 'medium' | 'low'
}

const notificationTypes = [
  { value: 'client_added', label: 'Nuovo cliente aggiunto', category: 'clienti' },
  { value: 'quote_sent', label: 'Preventivo inviato', category: 'preventivi' },
  { value: 'quote_accepted', label: 'Preventivo accettato', category: 'preventivi' },
  { value: 'quote_rejected', label: 'Preventivo rifiutato', category: 'preventivi' },
  { value: 'invoice_issued', label: 'Fattura emessa', category: 'fatture' },
  { value: 'invoice_paid', label: 'Fattura pagata', category: 'fatture' },
  { value: 'invoice_overdue', label: 'Fattura scaduta', category: 'fatture' },
  { value: 'subscription_limit_reached', label: 'Limite abbonamento raggiunto', category: 'sistema' },
  { value: 'subscription_limit_warning', label: 'Avviso limite abbonamento', category: 'sistema' },
  { value: 'product_low_stock', label: 'Prodotto in esaurimento', category: 'prodotti' },
  { value: 'product_out_of_stock', label: 'Prodotto esaurito', category: 'prodotti' },
  { value: 'order_created', label: 'Ordine creato', category: 'ordini' },
  { value: 'order_status_changed', label: 'Stato ordine cambiato', category: 'ordini' },
  { value: 'expense_added', label: 'Spesa aggiunta', category: 'spese' },
  { value: 'settings_updated', label: 'Impostazioni aggiornate', category: 'sistema' },
]

const categories = [
  { value: 'clienti', label: 'Clienti' },
  { value: 'preventivi', label: 'Preventivi' },
  { value: 'fatture', label: 'Fatture' },
  { value: 'prodotti', label: 'Prodotti' },
  { value: 'ordini', label: 'Ordini' },
  { value: 'spese', label: 'Spese' },
  { value: 'sistema', label: 'Sistema' },
]

export default function NotificationPreferencesPage() {
  const router = useRouter()
  const t = useTranslations('notifications')
  const tCommon = useTranslations('common')
  
  const [preferences, setPreferences] = useState<Record<string, NotificationPreference>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return

      const { data, error } = await supabase
        .from('user_notification_preferences')
        .select('*')
        .eq('user_id', user.id)

      if (error) throw error

      // Convert array to object keyed by notification_type
      const prefsObj: Record<string, NotificationPreference> = {}
      if (data) {
        data.forEach((pref) => {
          prefsObj[pref.notification_type] = pref
        })
      }

      // Initialize missing preferences with defaults
      notificationTypes.forEach((type) => {
        if (!prefsObj[type.value]) {
          prefsObj[type.value] = {
            notification_type: type.value,
            enabled_in_app: true,
            enabled_email: false,
            enabled_push: false,
            priority: type.value.includes('overdue') || type.value.includes('limit_reached') 
              ? 'urgent' 
              : type.value.includes('paid') || type.value.includes('accepted')
              ? 'high'
              : 'medium',
          }
        }
      })

      setPreferences(prefsObj)
    } catch (error) {
      console.error('Error loading preferences:', error)
      toast.error(tCommon('error'), {
        description: 'Errore nel caricamento delle preferenze',
      })
    } finally {
      setLoading(false)
    }
  }

  const updatePreference = (
    type: string,
    field: keyof NotificationPreference,
    value: any
  ) => {
    setPreferences((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value,
      },
    }))
  }

  const savePreferences = async () => {
    try {
      setSaving(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return

      // Upsert all preferences
      const prefsArray = Object.values(preferences).map((pref) => ({
        user_id: user.id,
        notification_type: pref.notification_type,
        enabled_in_app: pref.enabled_in_app,
        enabled_email: pref.enabled_email,
        enabled_push: pref.enabled_push,
        priority: pref.priority,
        updated_at: new Date().toISOString(),
      }))

      for (const pref of prefsArray) {
        const { error } = await supabase
          .from('user_notification_preferences')
          .upsert(pref, { onConflict: 'user_id,notification_type' })

        if (error) throw error
      }

      toast.success(tCommon('success'), {
        description: 'Preferenze salvate con successo',
      })
    } catch (error) {
      console.error('Error saving preferences:', error)
      toast.error(tCommon('error'), {
        description: 'Errore nel salvataggio delle preferenze',
      })
    } finally {
      setSaving(false)
    }
  }

  const filteredTypes = selectedCategory === 'all'
    ? notificationTypes
    : notificationTypes.filter((t) => {
        const category = categories.find((c) => c.value === selectedCategory)
        return category && t.category === category.value
      })

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-12 text-muted-foreground">
          Caricamento preferenze...
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Indietro
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Preferenze Notifiche</h1>
          <p className="text-muted-foreground mt-1">
            Personalizza quali notifiche ricevere e come riceverle
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Impostazioni Notifiche</CardTitle>
              <CardDescription>
                Scegli quali notifiche ricevere e attraverso quali canali
              </CardDescription>
            </div>
            <Button onClick={savePreferences} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Salvataggio...' : 'Salva'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <Label className="mb-2 block">Filtra per categoria</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le categorie</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-6">
            {filteredTypes.map((type) => {
              const pref = preferences[type.value]
              if (!pref) return null

              return (
                <div key={type.value} className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Label className="text-base font-semibold">
                        {type.label}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {type.category}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pl-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`${type.value}-in-app`} className="text-sm">
                        In App
                      </Label>
                      <Switch
                        id={`${type.value}-in-app`}
                        checked={pref.enabled_in_app}
                        onCheckedChange={(checked) =>
                          updatePreference(type.value, 'enabled_in_app', checked)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor={`${type.value}-email`} className="text-sm">
                        Email
                      </Label>
                      <Switch
                        id={`${type.value}-email`}
                        checked={pref.enabled_email}
                        onCheckedChange={(checked) =>
                          updatePreference(type.value, 'enabled_email', checked)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor={`${type.value}-push`} className="text-sm">
                        Push
                      </Label>
                      <Switch
                        id={`${type.value}-push`}
                        checked={pref.enabled_push}
                        onCheckedChange={(checked) =>
                          updatePreference(type.value, 'enabled_push', checked)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor={`${type.value}-priority`} className="text-sm">
                        Priorità
                      </Label>
                      <Select
                        value={pref.priority}
                        onValueChange={(value) =>
                          updatePreference(type.value, 'priority', value)
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="urgent">Urgent</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

