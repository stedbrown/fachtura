# 📝 Istruzioni per le Migration del Database

## Aggiunta Campi Contatto Azienda

Per aggiungere i campi di contatto (telefono, email, sito web) alla tabella `company_settings`, esegui questa query SQL in Supabase:

### Opzione 1: Da Supabase Dashboard

1. Vai su **Supabase Dashboard** → Il tuo progetto
2. Clicca su **SQL Editor** nella sidebar
3. Copia e incolla il contenuto del file `add-company-contact-fields.sql`
4. Clicca su **Run** per eseguire la query

### Opzione 2: Query Diretta

```sql
-- Add contact fields to company_settings table
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS website TEXT;
```

### Verifica

Per verificare che i campi siano stati aggiunti correttamente:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'company_settings';
```

Dovresti vedere i nuovi campi: `phone`, `email`, `website`.

## Note

- Questa migration è **retrocompatibile** - non richiede modifiche ai dati esistenti
- I campi sono tutti **opzionali** (nullable)
- Se i campi esistono già, `IF NOT EXISTS` previene errori

