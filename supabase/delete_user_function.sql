-- ========================================
-- Funzione per eliminare il proprio account
-- ========================================
-- Permette a un utente autenticato di eliminare il proprio account
-- Il trigger archive_account_on_delete salverà uno snapshot prima dell'eliminazione

CREATE OR REPLACE FUNCTION delete_user()
RETURNS void AS $$
BEGIN
  -- Verifica che l'utente sia autenticato
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Non autenticato';
  END IF;

  -- Elimina l'utente dalla tabella auth.users
  -- Il trigger archive_account_on_delete salverà uno snapshot
  -- Il CASCADE eliminerà automaticamente tutti i dati correlati
  DELETE FROM auth.users
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Concedi permesso di esecuzione agli utenti autenticati
GRANT EXECUTE ON FUNCTION delete_user() TO authenticated;

COMMENT ON FUNCTION delete_user IS 
'Permette a un utente autenticato di eliminare il proprio account. Tutti i dati vengono eliminati (CASCADE) e viene salvato uno snapshot in deleted_accounts.';

