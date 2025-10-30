-- Aggiunge soft delete alle tabelle principali
-- Copia e incolla questo nel SQL Editor di Supabase

-- Aggiungi campo deleted_at alle quotes
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Aggiungi campo deleted_at alle invoices
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Aggiungi campo deleted_at ai clients
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Crea indici per performance
CREATE INDEX IF NOT EXISTS quotes_deleted_at_idx ON quotes(deleted_at);
CREATE INDEX IF NOT EXISTS invoices_deleted_at_idx ON invoices(deleted_at);
CREATE INDEX IF NOT EXISTS clients_deleted_at_idx ON clients(deleted_at);

-- Commenti per documentazione
COMMENT ON COLUMN quotes.deleted_at IS 'Timestamp when the quote was soft deleted. NULL means not deleted.';
COMMENT ON COLUMN invoices.deleted_at IS 'Timestamp when the invoice was soft deleted. NULL means not deleted.';
COMMENT ON COLUMN clients.deleted_at IS 'Timestamp when the client was soft deleted. NULL means not deleted.';

