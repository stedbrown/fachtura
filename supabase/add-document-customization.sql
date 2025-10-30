-- Add document customization fields to company_settings table

ALTER TABLE company_settings 
-- Quote (Preventivi) customization
ADD COLUMN IF NOT EXISTS quote_default_notes TEXT,
ADD COLUMN IF NOT EXISTS quote_terms_conditions TEXT,
ADD COLUMN IF NOT EXISTS quote_default_validity_days INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS quote_footer_text TEXT,

-- Invoice (Fatture) customization
ADD COLUMN IF NOT EXISTS invoice_default_notes TEXT,
ADD COLUMN IF NOT EXISTS invoice_payment_terms TEXT,
ADD COLUMN IF NOT EXISTS invoice_default_due_days INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS invoice_footer_text TEXT,

-- Payment information
ADD COLUMN IF NOT EXISTS payment_methods TEXT, -- es: "Bonifico bancario, Carta di credito"
ADD COLUMN IF NOT EXISTS late_payment_fee TEXT; -- es: "2% per mese di ritardo"

-- Update timestamp when modified
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Ensure trigger exists
DROP TRIGGER IF EXISTS update_company_settings_updated_at ON company_settings;
CREATE TRIGGER update_company_settings_updated_at
    BEFORE UPDATE ON company_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

