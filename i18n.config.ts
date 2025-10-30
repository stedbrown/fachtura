export type Locale = 'de' | 'fr' | 'it' | 'rm' | 'en'

export const locales: Locale[] = ['de', 'fr', 'it', 'rm', 'en']

export const defaultLocale: Locale = 'it'

export const localeNames: Record<Locale, string> = {
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
  rm: 'Rumantsch',
  en: 'English',
}

export const localeFlags: Record<Locale, string> = {
  de: '🇩🇪',
  fr: '🇫🇷',
  it: '🇮🇹',
  rm: '🇨🇭',
  en: '🇬🇧',
}

