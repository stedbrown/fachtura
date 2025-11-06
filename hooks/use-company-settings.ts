import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface CompanySettingsStatus {
  hasSettings: boolean
  hasIBAN: boolean
  hasRequiredFields: boolean
  isLoading: boolean
  settings: any | null
}

export function useCompanySettings() {
  const [status, setStatus] = useState<CompanySettingsStatus>({
    hasSettings: false,
    hasIBAN: false,
    hasRequiredFields: false,
    isLoading: true,
    settings: null,
  })

  useEffect(() => {
    checkSettings()
  }, [])

  const checkSettings = async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setStatus({
          hasSettings: false,
          hasIBAN: false,
          hasRequiredFields: false,
          isLoading: false,
          settings: null,
        })
        return
      }

      const { data: settings } = await supabase
        .from('company_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (!settings) {
        setStatus({
          hasSettings: false,
          hasIBAN: false,
          hasRequiredFields: false,
          isLoading: false,
          settings: null,
        })
        return
      }

      // Check required fields for QR code
      const hasIBAN = Boolean(settings.iban && settings.iban.trim())
      const hasRequiredFields = Boolean(
        settings.company_name &&
        settings.address &&
        settings.city &&
        settings.postal_code &&
        settings.country &&
        hasIBAN
      )

      setStatus({
        hasSettings: true,
        hasIBAN,
        hasRequiredFields,
        isLoading: false,
        settings,
      })
    } catch (error) {
      console.error('Error checking company settings:', error)
      setStatus({
        hasSettings: false,
        hasIBAN: false,
        hasRequiredFields: false,
        isLoading: false,
        settings: null,
      })
    }
  }

  return { ...status, refetch: checkSettings }
}

