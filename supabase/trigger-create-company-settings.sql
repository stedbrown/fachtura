-- Optional: Database Trigger per creare automaticamente company_settings
-- Questo è un approccio alternativo più elegante

-- Function per creare company settings
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.company_settings (user_id, company_name, country)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'company_name', 'Nuova Azienda'),
    'Switzerland'
  );
  RETURN new;
END;
$$;

-- Trigger che esegue la function quando un utente si registra
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Con questo trigger, non serve più creare manualmente le company_settings nel codice!

