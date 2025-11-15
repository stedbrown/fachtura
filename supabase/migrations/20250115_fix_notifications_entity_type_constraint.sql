-- Fix notifications entity_type constraint to include all entity types
-- This fixes the error when creating suppliers (and other entities)
-- Date: 2025-01-15

-- Drop the old constraint
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_entity_type_check;

-- Add new constraint with all entity types
ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_entity_type_check 
CHECK (entity_type IS NULL OR entity_type IN (
  'client',
  'quote', 
  'invoice',
  'settings',
  'supplier',
  'order',
  'product',
  'expense',
  'subscription'
));

COMMENT ON CONSTRAINT notifications_entity_type_check ON public.notifications IS 
  'Ensures entity_type is one of the valid entity types or NULL';

