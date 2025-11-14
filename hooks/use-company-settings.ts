'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface CompanySettingsStatus {
  hasSettings: boolean
  hasIBAN: boolean
  hasRequiredFields: boolean
  isLoading: boolean
  settings: any | null
}

export function useCompanySettings() {
  const queryClient = useQueryClient()

  const {
    data: status,
    isLoading,
  } = useQuery({
    queryKey: ['company-settings'],
    queryFn: async (): Promise<CompanySettingsStatus> => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          return {
            hasSettings: false,
            hasIBAN: false,
            hasRequiredFields: false,
            isLoading: false,
            settings: null,
          }
        }

        const { data: settings } = await supabase
          .from('company_settings')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (!settings) {
          return {
            hasSettings: false,
            hasIBAN: false,
            hasRequiredFields: false,
            isLoading: false,
            settings: null,
          }
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

        return {
          hasSettings: true,
          hasIBAN,
          hasRequiredFields,
          isLoading: false,
          settings,
        }
      } catch (error) {
        console.error('Error checking company settings:', error)
        return {
          hasSettings: false,
          hasIBAN: false,
          hasRequiredFields: false,
          isLoading: false,
          settings: null,
        }
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ['company-settings'] })
  }

  return {
    ...(status ?? {
      hasSettings: false,
      hasIBAN: false,
      hasRequiredFields: false,
      isLoading: true,
      settings: null,
    }),
    isLoading,
    refetch,
  }
}

