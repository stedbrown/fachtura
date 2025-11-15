-- ============================================
-- ADD STRIPE CONNECT SUPPORT TO INVOICES
-- Date: 2025-01-16
-- ============================================
-- 
-- Adds columns to support Stripe Connect payments
-- and automatic payment status updates via webhooks

-- Add Stripe Connect account ID (for connected accounts)
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_account_id 
ON public.invoices(stripe_account_id) 
WHERE stripe_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_stripe_payment_intent_id 
ON public.invoices(stripe_payment_intent_id) 
WHERE stripe_payment_intent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_stripe_checkout_session_id 
ON public.invoices(stripe_checkout_session_id) 
WHERE stripe_checkout_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_payment_status 
ON public.invoices(payment_status) 
WHERE payment_status IS NOT NULL;

-- Add comments
COMMENT ON COLUMN public.invoices.stripe_account_id IS 
  'Stripe Connect account ID of the user who owns this invoice';
COMMENT ON COLUMN public.invoices.stripe_payment_intent_id IS 
  'Stripe Payment Intent ID for tracking payments';
COMMENT ON COLUMN public.invoices.stripe_checkout_session_id IS 
  'Stripe Checkout Session ID for payment links';
COMMENT ON COLUMN public.invoices.payment_status IS 
  'Payment status: pending, paid, failed, refunded';
COMMENT ON COLUMN public.invoices.paid_at IS 
  'Timestamp when invoice was paid';

-- ============================================
-- ADD STRIPE ACCOUNT TABLE FOR USERS
-- ============================================

-- Create table to store Stripe Connect account information
CREATE TABLE IF NOT EXISTS public.stripe_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  stripe_account_id TEXT NOT NULL UNIQUE,
  stripe_account_type TEXT NOT NULL CHECK (stripe_account_type IN ('express', 'standard', 'custom')),
  is_active BOOLEAN DEFAULT true,
  charges_enabled BOOLEAN DEFAULT false,
  payouts_enabled BOOLEAN DEFAULT false,
  details_submitted BOOLEAN DEFAULT false,
  email TEXT,
  country TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_stripe_accounts_user_id ON public.stripe_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_accounts_stripe_account_id ON public.stripe_accounts(stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_stripe_accounts_is_active ON public.stripe_accounts(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.stripe_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stripe_accounts
CREATE POLICY "Users can view their own Stripe account"
  ON public.stripe_accounts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Stripe account"
  ON public.stripe_accounts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Stripe account"
  ON public.stripe_accounts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Stripe account"
  ON public.stripe_accounts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE public.stripe_accounts IS 
  'Stores Stripe Connect account information for users';

