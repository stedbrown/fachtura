-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Company Settings Table (one per user)
CREATE TABLE company_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'Switzerland',
  vat_number TEXT,
  iban TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Clients Table
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quotes Table
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  quote_number TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
  subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, quote_number)
);

-- Quote Items Table
CREATE TABLE quote_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL,
  tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 8.1,
  line_total NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoices Table
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid', 'overdue')),
  subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, invoice_number)
);

-- Invoice Items Table
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL,
  tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 8.1,
  line_total NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- Company Settings Policies
CREATE POLICY "Users can view their own company settings" 
  ON company_settings FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own company settings" 
  ON company_settings FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own company settings" 
  ON company_settings FOR UPDATE 
  USING (auth.uid() = user_id);

-- Clients Policies
CREATE POLICY "Users can view their own clients" 
  ON clients FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own clients" 
  ON clients FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clients" 
  ON clients FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clients" 
  ON clients FOR DELETE 
  USING (auth.uid() = user_id);

-- Quotes Policies
CREATE POLICY "Users can view their own quotes" 
  ON quotes FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quotes" 
  ON quotes FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own quotes" 
  ON quotes FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own quotes" 
  ON quotes FOR DELETE 
  USING (auth.uid() = user_id);

-- Quote Items Policies
CREATE POLICY "Users can view quote items" 
  ON quote_items FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM quotes 
    WHERE quotes.id = quote_items.quote_id 
    AND quotes.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert quote items" 
  ON quote_items FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM quotes 
    WHERE quotes.id = quote_items.quote_id 
    AND quotes.user_id = auth.uid()
  ));

CREATE POLICY "Users can update quote items" 
  ON quote_items FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM quotes 
    WHERE quotes.id = quote_items.quote_id 
    AND quotes.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete quote items" 
  ON quote_items FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM quotes 
    WHERE quotes.id = quote_items.quote_id 
    AND quotes.user_id = auth.uid()
  ));

-- Invoices Policies
CREATE POLICY "Users can view their own invoices" 
  ON invoices FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own invoices" 
  ON invoices FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own invoices" 
  ON invoices FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own invoices" 
  ON invoices FOR DELETE 
  USING (auth.uid() = user_id);

-- Invoice Items Policies
CREATE POLICY "Users can view invoice items" 
  ON invoice_items FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM invoices 
    WHERE invoices.id = invoice_items.invoice_id 
    AND invoices.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert invoice items" 
  ON invoice_items FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM invoices 
    WHERE invoices.id = invoice_items.invoice_id 
    AND invoices.user_id = auth.uid()
  ));

CREATE POLICY "Users can update invoice items" 
  ON invoice_items FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM invoices 
    WHERE invoices.id = invoice_items.invoice_id 
    AND invoices.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete invoice items" 
  ON invoice_items FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM invoices 
    WHERE invoices.id = invoice_items.invoice_id 
    AND invoices.user_id = auth.uid()
  ));

-- Indexes for better performance
CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE INDEX idx_quotes_user_id ON quotes(user_id);
CREATE INDEX idx_quotes_client_id ON quotes(client_id);
CREATE INDEX idx_quote_items_quote_id ON quote_items(quote_id);
CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_client_id ON invoices(client_id);
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);

