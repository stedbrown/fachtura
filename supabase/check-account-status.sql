-- ====================================================================
-- VERIFICA STATO ACCOUNT
-- Email: stefanovananti@gmail.com
-- ====================================================================

-- 1. Info User
SELECT 
  id as user_id,
  email,
  created_at as account_created
FROM auth.users 
WHERE email = 'stefanovananti@gmail.com';

-- 2. Piano e Limiti
SELECT 
  us.user_id,
  us.status as subscription_status,
  sp.name as plan_name,
  sp.max_clients,
  sp.max_invoices,
  sp.max_quotes,
  us.current_period_start,
  us.current_period_end
FROM user_subscriptions us
JOIN subscription_plans sp ON us.plan_id = sp.id
WHERE us.user_id = (SELECT id FROM auth.users WHERE email = 'stefanovananti@gmail.com');

-- 3. Conteggio Risorse Attuali
WITH user_data AS (
  SELECT id FROM auth.users WHERE email = 'stefanovananti@gmail.com'
)
SELECT 
  (SELECT COUNT(*) FROM clients WHERE user_id = (SELECT id FROM user_data) AND deleted_at IS NULL) as active_clients,
  (SELECT COUNT(*) FROM invoices WHERE user_id = (SELECT id FROM user_data) AND deleted_at IS NULL) as active_invoices,
  (SELECT COUNT(*) FROM quotes WHERE user_id = (SELECT id FROM user_data) AND deleted_at IS NULL) as active_quotes,
  (SELECT COUNT(*) FROM notifications WHERE user_id = (SELECT id FROM user_data)) as notifications;

-- 4. Lista Clienti Attuali
SELECT 
  id,
  name,
  email,
  city,
  created_at,
  deleted_at
FROM clients 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'stefanovananti@gmail.com')
ORDER BY created_at DESC;

-- 5. Lista Fatture Attuali
SELECT 
  id,
  invoice_number,
  status,
  total,
  date,
  created_at,
  deleted_at
FROM invoices 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'stefanovananti@gmail.com')
ORDER BY created_at DESC;

-- 6. Lista Preventivi Attuali
SELECT 
  id,
  quote_number,
  status,
  total,
  date,
  created_at,
  deleted_at
FROM quotes 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'stefanovananti@gmail.com')
ORDER BY created_at DESC;

