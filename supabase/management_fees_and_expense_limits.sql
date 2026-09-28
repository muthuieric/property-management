-- =============================================================================
-- FINANCIAL CONTROLS MIGRATION: MANAGEMENT FEES & EXPENSE LIMITS
-- Automates agency revenue tracking & restricts coordinator maintenance spending
-- Production-Ready, Safe to re-run, Non-destructive
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENSURE PREREQUISITE TABLES EXIST (Safeguard)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subscription_status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT,
    agency_id UUID,
    manager_id UUID,
    property_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.maintenance_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID,
    agency_id UUID,
    reported_by UUID,
    assigned_to UUID,
    issue_description TEXT,
    status TEXT DEFAULT 'Pending',
    cost NUMERIC(12, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2. ALTER public.properties: ADD MANAGEMENT FEE PERCENTAGE
-- -----------------------------------------------------------------------------
ALTER TABLE public.properties
    ADD COLUMN IF NOT EXISTS management_fee_percentage NUMERIC(5, 2) DEFAULT 0.00;

-- -----------------------------------------------------------------------------
-- 3. ALTER public.agencies: ADD COORDINATOR EXPENSE AUTO-APPROVE THRESHOLD
-- -----------------------------------------------------------------------------
ALTER TABLE public.agencies
    ADD COLUMN IF NOT EXISTS maintenance_auto_approve_limit NUMERIC(12, 2) DEFAULT 5000.00;

-- -----------------------------------------------------------------------------
-- 4. ENHANCE public.maintenance_tickets WITH QUOTE WORKFLOW COLUMNS
-- -----------------------------------------------------------------------------
ALTER TABLE public.maintenance_tickets
    ADD COLUMN IF NOT EXISTS quote_amount NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS quote_status TEXT DEFAULT 'no_quote_needed',
    ADD COLUMN IF NOT EXISTS approved_by UUID,
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- -----------------------------------------------------------------------------
-- 5. PERFORMANCE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_properties_mgmt_fee 
    ON public.properties(management_fee_percentage);

CREATE INDEX IF NOT EXISTS idx_tickets_quote_status 
    ON public.maintenance_tickets(quote_status);

