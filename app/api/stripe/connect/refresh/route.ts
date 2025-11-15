import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/server'
import { logger } from '@/lib/logger'
import { safeAsync } from '@/lib/error-handler'

/**
 * GET /api/stripe/connect/refresh
 * Refresh Stripe Connect onboarding if incomplete
 */
export async function GET(request: NextRequest) {
  const result = await safeAsync(async () => {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`)
    }

    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('account_id')

    if (!accountId) {
      throw new Error('account_id is required')
    }

    // Retrieve account to check status
    const account = await stripe.accounts.retrieve(accountId)

    // Create new account link for continued onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/stripe/connect/refresh?account_id=${accountId}`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?account_id=${accountId}`,
      type: 'account_onboarding',
    })

    logger.debug('Stripe Connect refresh link created', {
      userId: user.id,
      accountId,
    })

    // Redirect to Stripe onboarding
    return NextResponse.redirect(accountLink.url)
  }, 'Error refreshing Stripe Connect')

  if (result.success && result.data) {
    return result.data as NextResponse
  } else {
    logger.error('Error refreshing Stripe Connect', result.details)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=stripe_connect_failed`)
  }
}

