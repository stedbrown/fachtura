import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/server'
import { logger } from '@/lib/logger'
import { safeAsync } from '@/lib/error-handler'

/**
 * GET /api/stripe/connect
 * Inizia il processo OAuth per Stripe Connect
 */
export async function GET(request: NextRequest) {
  const result = await safeAsync(async () => {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { searchParams } = new URL(request.url)
    const returnUrl = searchParams.get('return_url') || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings`

    // For Express accounts, we need to create the account first
    // Then create the account link
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'CH', // Default to Switzerland, can be made configurable
      email: user.email || undefined,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        user_id: user.id,
      },
    })

    // Create account link with the new account ID
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/stripe/connect/refresh?account_id=${account.id}`,
      return_url: `${returnUrl}?account_id=${account.id}`,
      type: 'account_onboarding',
    })

    logger.debug('Stripe Connect OAuth initiated', {
      userId: user.id,
      accountId: account.id,
    })

    return {
      url: accountLink.url,
      accountId: account.id,
    }
  }, 'Error initiating Stripe Connect')

  if (result.success) {
    return NextResponse.json(result.data)
  } else {
    logger.error('Error initiating Stripe Connect', result.details)
    return NextResponse.json(
      { error: result.error },
      { status: 500 }
    )
  }
}

/**
 * POST /api/stripe/connect
 * Salva l'account Stripe Connect dopo onboarding completato
 */
export async function POST(request: NextRequest) {
  const result = await safeAsync(async () => {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      throw new Error('Unauthorized')
    }

    const { accountId } = await request.json()

    if (!accountId) {
      throw new Error('accountId is required')
    }

    // Retrieve account details from Stripe
    const account = await stripe.accounts.retrieve(accountId)

    // Check if account belongs to this user (via metadata)
    if (account.metadata?.user_id !== user.id) {
      throw new Error('Account does not belong to this user')
    }

    // Save or update Stripe account in database
    const { error: upsertError } = await supabase
      .from('stripe_accounts')
      .upsert({
        user_id: user.id,
        stripe_account_id: account.id,
        stripe_account_type: account.type === 'express' ? 'express' : account.type === 'standard' ? 'standard' : 'custom',
        is_active: account.details_submitted && account.charges_enabled,
        charges_enabled: account.charges_enabled || false,
        payouts_enabled: account.payouts_enabled || false,
        details_submitted: account.details_submitted || false,
        email: account.email || null,
        country: account.country || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })

    if (upsertError) {
      throw upsertError
    }

    logger.debug('Stripe account saved', {
      userId: user.id,
      accountId: account.id,
    })

    return {
      success: true,
      accountId: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    }
  }, 'Error saving Stripe Connect account')

  if (result.success) {
    return NextResponse.json(result.data)
  } else {
    logger.error('Error saving Stripe Connect account', result.details)
    return NextResponse.json(
      { error: result.error },
      { status: 500 }
    )
  }
}

