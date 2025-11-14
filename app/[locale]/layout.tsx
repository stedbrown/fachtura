import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { locales } from '@/i18n.config'
import { QueryProvider } from '@/components/query-provider'

type AppLocale = (typeof locales)[number]

const isSupportedLocale = (value: string): value is AppLocale =>
  locales.includes(value as AppLocale)

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  
  // Ensure that the incoming locale is valid
  if (!isSupportedLocale(locale)) {
    notFound()
  }

  // Provide all messages to the client side
  const messages = await getMessages()

  return (
    <QueryProvider>
      <NextIntlClientProvider messages={messages}>
        {children}
      </NextIntlClientProvider>
    </QueryProvider>
  )
}

