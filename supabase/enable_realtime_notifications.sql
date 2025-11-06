-- Abilita Realtime per la tabella notifications
-- Questo permette alle subscriptions di funzionare correttamente
-- SENZA questo, le notifiche non arrivano in real-time e serve refresh

-- Aggiungi la tabella notifications alla pubblicazione realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Verifica che sia stato aggiunto
-- SELECT * FROM pg_publication_tables 
-- WHERE pubname = 'supabase_realtime' 
-- AND tablename = 'notifications';

-- IMPORTANTE: Questa migration è già stata applicata tramite MCP Supabase
-- Non eseguire manualmente se già applicata

