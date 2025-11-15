-- ============================================
-- ADD STRIPE PAYMENT LINK COLUMNS TO INVOICES
-- Date: 2025-01-16
-- ============================================
-- 
-- Adds columns to store Stripe payment link information
-- for enabling online payments on invoices

-- Add Stripe payment link columns
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS stripe_payment_link_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_payment_link_url TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_payment_link_id 
ON public.invoices(stripe_payment_link_id) 
WHERE stripe_payment_link_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.invoices.stripe_payment_link_id IS 
  'Stripe Payment Link ID for online payment processing';
COMMENT ON COLUMN public.invoices.stripe_payment_link_url IS 
  'Stripe Payment Link URL for customer payment page';

