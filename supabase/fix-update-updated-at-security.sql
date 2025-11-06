-- Fix security warning: Set immutable search_path for update_updated_at_column function
-- This prevents schema poisoning attacks
-- 
-- Security Issue: Function Search Path Mutable
-- Detects functions where the search_path parameter is not set.
-- 
-- Solution: Add SECURITY DEFINER and SET search_path = public, pg_temp
-- This prevents attackers from changing the search_path and injecting malicious code

-- Drop and recreate the function with secure settings
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

-- Recreate triggers that use this function
CREATE TRIGGER update_company_settings_updated_at
    BEFORE UPDATE ON company_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quotes_updated_at
    BEFORE UPDATE ON quotes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment explaining the security settings
COMMENT ON FUNCTION public.update_updated_at_column() IS 
'Automatically updates the updated_at column. SECURITY DEFINER with immutable search_path prevents schema poisoning attacks.';

-- Verification query (optional - run to verify)
-- SELECT 
--   p.proname as function_name,
--   p.prosecdef as is_security_definer,
--   p.proconfig as search_path_config
-- FROM pg_proc p
-- WHERE p.proname = 'update_updated_at_column'
-- AND p.pronamespace = 'public'::regnamespace;

