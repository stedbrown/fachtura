-- Script per inizializzare gli abbonamenti per gli utenti esistenti
-- Esegui questo script DOPO aver applicato la migrazione create_subscription_system

-- 1. Assegna il piano Free a tutti gli utenti esistenti che non hanno un abbonamento
INSERT INTO user_subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
SELECT 
  u.id as user_id,
  sp.id as plan_id,
  'active' as status,
  NOW() as current_period_start,
  NOW() + INTERVAL '1 year' as current_period_end
FROM auth.users u
CROSS JOIN subscription_plans sp
WHERE sp.name = 'Free'
  AND NOT EXISTS (
    SELECT 1 FROM user_subscriptions us WHERE us.user_id = u.id
  );

-- 2. Inizializza l'uso corrente per tutti gli utenti esistenti
INSERT INTO usage_tracking (user_id, period_start, period_end, invoices_count, quotes_count, clients_count)
SELECT 
  u.id as user_id,
  DATE_TRUNC('month', NOW()) as period_start,
  DATE_TRUNC('month', NOW()) + INTERVAL '1 month' as period_end,
  COALESCE(inv_count.total, 0) as invoices_count,
  COALESCE(quote_count.total, 0) as quotes_count,
  COALESCE(client_count.total, 0) as clients_count
FROM auth.users u
LEFT JOIN (
  SELECT user_id, COUNT(*) as total 
  FROM invoices 
  WHERE deleted_at IS NULL 
    AND created_at >= DATE_TRUNC('month', NOW())
  GROUP BY user_id
) inv_count ON u.id = inv_count.user_id
LEFT JOIN (
  SELECT user_id, COUNT(*) as total 
  FROM quotes 
  WHERE deleted_at IS NULL 
    AND created_at >= DATE_TRUNC('month', NOW())
  GROUP BY user_id
) quote_count ON u.id = quote_count.user_id
LEFT JOIN (
  SELECT user_id, COUNT(*) as total 
  FROM clients 
  WHERE deleted_at IS NULL
  GROUP BY user_id
) client_count ON u.id = client_count.user_id
ON CONFLICT (user_id, period_start) DO UPDATE
SET 
  invoices_count = EXCLUDED.invoices_count,
  quotes_count = EXCLUDED.quotes_count,
  clients_count = EXCLUDED.clients_count,
  updated_at = NOW();

-- 3. Verifica i risultati
SELECT 
  u.email,
  sp.name as plan_name,
  us.status,
  ut.invoices_count,
  ut.quotes_count,
  ut.clients_count
FROM auth.users u
LEFT JOIN user_subscriptions us ON u.id = us.user_id
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
LEFT JOIN usage_tracking ut ON u.id = ut.user_id AND ut.period_start = DATE_TRUNC('month', NOW())
ORDER BY u.created_at;

