-- =====================================================
-- FACHTURA - PRODUCTS & ORDERS MANAGEMENT SYSTEM
-- Migration: Add products, orders, and order_items tables
-- Date: 2025-01-08
-- =====================================================

-- =====================================================
-- 1. PRODUCTS TABLE (Articoli / Catalogo Prodotti)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Product Information
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT, -- Stock Keeping Unit (Codice articolo)
    category TEXT, -- Categoria prodotto (es. "Consulenza", "Hardware", "Software")
    
    -- Pricing
    unit_price NUMERIC NOT NULL DEFAULT 0,
    tax_rate NUMERIC NOT NULL DEFAULT 8.1, -- IVA Svizzera default
    
    -- Stock Management (optional)
    track_inventory BOOLEAN DEFAULT false,
    stock_quantity INTEGER DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 10,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ, -- Soft delete
    
    CONSTRAINT products_unit_price_positive CHECK (unit_price >= 0),
    CONSTRAINT products_tax_rate_valid CHECK (tax_rate >= 0 AND tax_rate <= 100)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON public.products(deleted_at);

COMMENT ON TABLE public.products IS 'Product catalog for invoices, quotes, and orders';

-- =====================================================
-- 2. ORDERS TABLE (Ordini Clienti)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    
    -- Order Information
    order_number TEXT NOT NULL UNIQUE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    
    -- Status: draft | confirmed | processing | shipped | delivered | cancelled
    status TEXT NOT NULL DEFAULT 'draft',
    
    -- Amounts
    subtotal NUMERIC NOT NULL DEFAULT 0,
    tax_amount NUMERIC NOT NULL DEFAULT 0,
    total NUMERIC NOT NULL DEFAULT 0,
    
    -- Additional Info
    notes TEXT,
    internal_notes TEXT, -- Note private (non visibili al cliente)
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ, -- Soft delete
    
    CONSTRAINT orders_status_check CHECK (status IN ('draft', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
    CONSTRAINT orders_subtotal_positive CHECK (subtotal >= 0),
    CONSTRAINT orders_tax_amount_positive CHECK (tax_amount >= 0),
    CONSTRAINT orders_total_positive CHECK (total >= 0)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON public.orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON public.orders(date);
CREATE INDEX IF NOT EXISTS idx_orders_deleted_at ON public.orders(deleted_at);

COMMENT ON TABLE public.orders IS 'Customer orders tracking and management';

-- =====================================================
-- 3. ORDER_ITEMS TABLE (Articoli Ordine)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL, -- Optional link to product catalog
    
    -- Item Details (può essere copiato da product o inserito manualmente)
    description TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL,
    tax_rate NUMERIC NOT NULL DEFAULT 8.1,
    line_total NUMERIC NOT NULL,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    
    CONSTRAINT order_items_quantity_positive CHECK (quantity > 0),
    CONSTRAINT order_items_unit_price_positive CHECK (unit_price >= 0),
    CONSTRAINT order_items_line_total_positive CHECK (line_total >= 0)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id) WHERE product_id IS NOT NULL;

COMMENT ON TABLE public.order_items IS 'Line items for customer orders';

-- =====================================================
-- 4. ADD PRODUCT_ID TO INVOICE_ITEMS
-- =====================================================
ALTER TABLE public.invoice_items 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoice_items_product_id ON public.invoice_items(product_id) WHERE product_id IS NOT NULL;

COMMENT ON COLUMN public.invoice_items.product_id IS 'Optional link to product catalog for tracking and analytics';

-- =====================================================
-- 5. ADD PRODUCT_ID TO QUOTE_ITEMS
-- =====================================================
ALTER TABLE public.quote_items 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quote_items_product_id ON public.quote_items(product_id) WHERE product_id IS NOT NULL;

COMMENT ON COLUMN public.quote_items.product_id IS 'Optional link to product catalog for tracking and analytics';

-- =====================================================
-- 6. UPDATE SUBSCRIPTION_PLANS - ADD LIMITS FOR PRODUCTS & ORDERS
-- =====================================================
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS max_products INTEGER,
ADD COLUMN IF NOT EXISTS max_orders INTEGER;

COMMENT ON COLUMN public.subscription_plans.max_products IS 'Maximum number of products allowed in catalog (NULL = unlimited)';
COMMENT ON COLUMN public.subscription_plans.max_orders IS 'Maximum number of orders allowed per month (NULL = unlimited)';

-- Update existing plans with reasonable defaults
UPDATE public.subscription_plans 
SET 
    max_products = CASE 
        WHEN name = 'Free' THEN 20
        WHEN name = 'Pro' THEN 100
        WHEN name = 'Enterprise' THEN NULL -- Unlimited
    END,
    max_orders = CASE 
        WHEN name = 'Free' THEN 10
        WHEN name = 'Pro' THEN 50
        WHEN name = 'Enterprise' THEN NULL -- Unlimited
    END
WHERE max_products IS NULL OR max_orders IS NULL;

-- =====================================================
-- 7. UPDATE USAGE_TRACKING - ADD PRODUCTS & ORDERS COUNT
-- =====================================================
ALTER TABLE public.usage_tracking 
ADD COLUMN IF NOT EXISTS products_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS orders_count INTEGER DEFAULT 0;

COMMENT ON COLUMN public.usage_tracking.products_count IS 'Total products in catalog for the period';
COMMENT ON COLUMN public.usage_tracking.orders_count IS 'Total orders created in the period';

-- =====================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all new tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- PRODUCTS POLICIES
CREATE POLICY "Users can view their own products"
    ON public.products FOR SELECT
    USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert their own products"
    ON public.products FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own products"
    ON public.products FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own products"
    ON public.products FOR DELETE
    USING (auth.uid() = user_id);

-- ORDERS POLICIES
CREATE POLICY "Users can view their own orders"
    ON public.orders FOR SELECT
    USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert their own orders"
    ON public.orders FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own orders"
    ON public.orders FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own orders"
    ON public.orders FOR DELETE
    USING (auth.uid() = user_id);

-- ORDER_ITEMS POLICIES
CREATE POLICY "Users can view order items for their orders"
    ON public.order_items FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.orders 
        WHERE orders.id = order_items.order_id 
        AND orders.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert order items for their orders"
    ON public.order_items FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.orders 
        WHERE orders.id = order_items.order_id 
        AND orders.user_id = auth.uid()
    ));

CREATE POLICY "Users can update order items for their orders"
    ON public.order_items FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.orders 
        WHERE orders.id = order_items.order_id 
        AND orders.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete order items for their orders"
    ON public.order_items FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM public.orders 
        WHERE orders.id = order_items.order_id 
        AND orders.user_id = auth.uid()
    ));

-- =====================================================
-- 9. FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for products.updated_at
DROP TRIGGER IF EXISTS set_products_updated_at ON public.products;
CREATE TRIGGER set_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for orders.updated_at
DROP TRIGGER IF EXISTS set_orders_updated_at ON public.orders;
CREATE TRIGGER set_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 10. HELPER VIEWS (Optional - for analytics)
-- =====================================================

-- View: Active Products Count per User
CREATE OR REPLACE VIEW v_user_active_products AS
SELECT 
    user_id,
    COUNT(*) as active_products_count,
    COUNT(*) FILTER (WHERE track_inventory = true) as tracked_products_count,
    SUM(stock_quantity) FILTER (WHERE track_inventory = true) as total_stock
FROM public.products
WHERE is_active = true AND deleted_at IS NULL
GROUP BY user_id;

-- View: Orders Summary per User
CREATE OR REPLACE VIEW v_user_orders_summary AS
SELECT 
    user_id,
    COUNT(*) as total_orders,
    COUNT(*) FILTER (WHERE status = 'draft') as draft_orders,
    COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_orders,
    COUNT(*) FILTER (WHERE status = 'delivered') as delivered_orders,
    SUM(total) as total_revenue,
    SUM(total) FILTER (WHERE status = 'delivered') as delivered_revenue
FROM public.orders
WHERE deleted_at IS NULL
GROUP BY user_id;

-- =====================================================
-- 11. GRANT PERMISSIONS
-- =====================================================

-- Grant authenticated users access to new tables
GRANT ALL ON public.products TO authenticated;
GRANT ALL ON public.orders TO authenticated;
GRANT ALL ON public.order_items TO authenticated;

-- Grant access to views
GRANT SELECT ON v_user_active_products TO authenticated;
GRANT SELECT ON v_user_orders_summary TO authenticated;

-- =====================================================
-- ✅ MIGRATION COMPLETE
-- =====================================================

COMMENT ON SCHEMA public IS 'Fachtura Products & Orders Management System - v2.0';

