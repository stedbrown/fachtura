import { getRequestConfig } from 'next-intl/server'
import { locales, type Locale } from '../i18n.config'

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale

  // Ensure that the incoming locale is valid
  if (!locale || !locales.includes(locale as Locale)) {
    locale = 'it'
  }

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  }
})

