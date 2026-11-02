-- =============================================================================
-- MIGRATION: PROPERTY FOUNDATION + FINANCIAL ENGINE SCHEMA
-- Bespoke Enterprise Property Management (Next.js + Supabase)
--
-- Adds mandatory property/unit fields and ensures Leases, Tenants, Invoices
-- tables carry the columns required by the financial escalation engine.
-- Safe to re-run, non-destructive (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PREREQUISITE CORE TABLES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subscription_status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    agency_id UUID,
    role TEXT DEFAULT 'property_manager',
    first_name TEXT,
    last_name TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone_number TEXT NOT NULL,
    agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT,
    agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
    manager_id UUID,
    property_type TEXT DEFAULT 'Apartment',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_number TEXT NOT NULL,
    base_rent NUMERIC(12, 2) DEFAULT 0,
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
    is_occupied BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2. TASK 1: MANDATORY PROPERTY / UNIT FIELDS
-- -----------------------------------------------------------------------------
-- property_code (e.g. KH/1) on properties
ALTER TABLE public.properties
    ADD COLUMN IF NOT EXISTS property_code TEXT;

-- portfolio_entity strictly separated between Karan Holdings Ltd and Kenply Ltd
ALTER TABLE public.properties
    ADD COLUMN IF NOT EXISTS portfolio_entity TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'properties_portfolio_entity_check'
    ) THEN
        ALTER TABLE public.properties
            ADD CONSTRAINT properties_portfolio_entity_check
            CHECK (portfolio_entity IS NULL OR portfolio_entity IN ('Karan Holdings Ltd', 'Kenply Ltd'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_properties_property_code ON public.properties(property_code);
CREATE INDEX IF NOT EXISTS idx_properties_portfolio_entity ON public.properties(portfolio_entity);

-- square_footage on units (crucial for dynamic service charge calculations)
ALTER TABLE public.units
    ADD COLUMN IF NOT EXISTS square_footage NUMERIC(10, 2);

CREATE INDEX IF NOT EXISTS idx_units_square_footage ON public.units(square_footage);

-- -----------------------------------------------------------------------------
-- 3. TASK 2: LEASES TABLE (escalation + financial fields)
-- -----------------------------------------------------------------------------
ALTER TABLE public.leases
    ADD COLUMN IF NOT EXISTS escalation_percentage NUMERIC(5, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS lease_status TEXT DEFAULT 'active';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'leases_lease_status_check'
    ) THEN
        ALTER TABLE public.leases
            ADD CONSTRAINT leases_lease_status_check
            CHECK (lease_status IN ('pending_signature', 'active', 'expired', 'terminated'));
    END IF;
END $$;

UPDATE public.leases SET escalation_percentage = 0.00 WHERE escalation_percentage IS NULL;
UPDATE public.leases SET lease_status = 'active' WHERE lease_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_leases_escalation ON public.leases(escalation_percentage);
CREATE INDEX IF NOT EXISTS idx_leases_end_date ON public.leases(end_date);
CREATE INDEX IF NOT EXISTS idx_leases_tenant_status ON public.leases(tenant_id, lease_status);

-- -----------------------------------------------------------------------------
-- 4. TASK 2: INVOICES TABLE (VAT, service charge, interest, PDF, sequencing)
-- -----------------------------------------------------------------------------
ALTER TABLE public.invoices
    ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5, 2) DEFAULT 16.00,
    ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(10, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS service_charge_amount NUMERIC(10, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS service_charge_rate NUMERIC(10, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS interest_penalty_amount NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS escalation_applied BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS years_elapsed INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS pdf_url TEXT,
    ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS invoice_number TEXT;

UPDATE public.invoices SET vat_rate = 16.00 WHERE vat_rate IS NULL;
UPDATE public.invoices SET vat_amount = 0.00 WHERE vat_amount IS NULL;
UPDATE public.invoices SET service_charge_amount = 0.00 WHERE service_charge_amount IS NULL;
UPDATE public.invoices SET service_charge_rate = 0.00 WHERE service_charge_rate IS NULL;
UPDATE public.invoices SET interest_penalty_amount = 0.00 WHERE interest_penalty_amount IS NULL;
UPDATE public.invoices SET escalation_applied = false WHERE escalation_applied IS NULL;
UPDATE public.invoices SET years_elapsed = 0 WHERE years_elapsed IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoices_status'
    ) THEN
        ALTER TABLE public.invoices
            ADD CONSTRAINT chk_invoices_status
            CHECK (status IN ('unpaid', 'partial', 'paid'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_vat ON public.invoices(vat_amount);
CREATE INDEX IF NOT EXISTS idx_invoices_service_charge ON public.invoices(service_charge_amount);
CREATE INDEX IF NOT EXISTS idx_invoices_billing_month_status ON public.invoices(billing_month, status);
CREATE INDEX IF NOT EXISTS idx_invoices_interest_penalty ON public.invoices(interest_penalty_amount);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON public.invoices(invoice_number);

-- -----------------------------------------------------------------------------
-- 5. SUPPORTING TABLES FOR FINANCIAL ENGINE
-- -----------------------------------------------------------------------------
-- Service charge rate table (temporal: effective/expiry dates)
CREATE TABLE IF NOT EXISTS public.service_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    rate_per_sqft NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    effective_date DATE NOT NULL,
    expiry_date DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_rates_agency ON public.service_rates(agency_id);
CREATE INDEX IF NOT EXISTS idx_service_rates_effective ON public.service_rates(effective_date);

-- Auto-incrementing invoice number sequence per agency (e.g. KHL/1118)
CREATE TABLE IF NOT EXISTS public.invoice_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    prefix TEXT NOT NULL DEFAULT 'INV',
    last_number INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (agency_id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_sequences_agency ON public.invoice_sequences(agency_id);

-- Agency billing identity (KRA PIN / VAT number + bank details for PDF)
CREATE TABLE IF NOT EXISTS public.agency_billing_identity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    company_name TEXT,
    vat_pin TEXT,
    tax_pin TEXT,
    email TEXT,
    phone TEXT,
    bank_name TEXT,
    bank_account_name TEXT,
    bank_account_number TEXT,
    bank_branch TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (agency_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_billing_identity_agency ON public.agency_billing_identity(agency_id);

-- Double-entry tenant ledger
CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    debit_account TEXT NOT NULL,
    credit_account TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reference TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_tenant ON public.ledger_entries(tenant_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_agency ON public.ledger_entries(agency_id, entry_date);

-- Arrears interest (2% monthly on outstanding arrears)
CREATE TABLE IF NOT EXISTS public.arrears_interest (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
    period_month DATE NOT NULL,
    interest_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    applied_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (invoice_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_arrears_interest_tenant_period ON public.arrears_interest(tenant_id, period_month);
CREATE INDEX IF NOT EXISTS idx_arrears_interest_agency ON public.arrears_interest(agency_id, period_month);

-- Credit notes (VAT reversal for disputes/overpayments)
CREATE TABLE IF NOT EXISTS public.credit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    original_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    credit_number TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    vat_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'issued',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_agency ON public.credit_notes(agency_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_original_invoice ON public.credit_notes(original_invoice_id);

-- Transactions (single-source for payments / M-Pesa / bank)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    status TEXT DEFAULT 'pending',
    payment_method TEXT DEFAULT 'MPESA',
    external_reference TEXT,
    receipt_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_agency ON public.transactions(agency_id);

-- -----------------------------------------------------------------------------
-- 6. ROW-LEVEL SECURITY (mirrors existing agency-scoped patterns)
-- -----------------------------------------------------------------------------
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Properties RLS" ON public.properties;
CREATE POLICY "Properties RLS" ON public.properties FOR ALL TO authenticated
    USING (agency_id = public.get_auth_agency_id());

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Units RLS" ON public.units;
CREATE POLICY "Units RLS" ON public.units FOR ALL TO authenticated
    USING (property_id IN (SELECT id FROM public.properties WHERE agency_id = public.get_auth_agency_id()));

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenants RLS" ON public.tenants;
CREATE POLICY "Tenants RLS" ON public.tenants FOR ALL TO authenticated
    USING (agency_id = public.get_auth_agency_id() OR user_id = auth.uid());

ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Leases RLS" ON public.leases;
CREATE POLICY "Leases RLS" ON public.leases FOR ALL TO authenticated
    USING (agency_id = public.get_auth_agency_id() OR tenant_id = public.get_auth_tenant_id());

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Invoices RLS" ON public.invoices;
CREATE POLICY "Invoices RLS" ON public.invoices FOR ALL TO authenticated
    USING (agency_id = public.get_auth_agency_id() OR tenant_id = public.get_auth_tenant_id());

ALTER TABLE public.service_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service rates RLS" ON public.service_rates;
CREATE POLICY "Service rates RLS" ON public.service_rates FOR ALL TO authenticated
    USING (agency_id = public.get_auth_agency_id());

ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Invoice sequences RLS" ON public.invoice_sequences;
CREATE POLICY "Invoice sequences RLS" ON public.invoice_sequences FOR ALL TO authenticated
    USING (agency_id = public.get_auth_agency_id());

ALTER TABLE public.agency_billing_identity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agency billing identity RLS" ON public.agency_billing_identity;
CREATE POLICY "Agency billing identity RLS" ON public.agency_billing_identity FOR ALL TO authenticated
    USING (agency_id = public.get_auth_agency_id());

ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ledger entries RLS" ON public.ledger_entries;
CREATE POLICY "Ledger entries RLS" ON public.ledger_entries FOR ALL TO authenticated
    USING (agency_id = public.get_auth_agency_id() OR tenant_id = public.get_auth_tenant_id());

ALTER TABLE public.arrears_interest ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Arrears interest RLS" ON public.arrears_interest;
CREATE POLICY "Arrears interest RLS" ON public.arrears_interest FOR ALL TO authenticated
    USING (agency_id = public.get_auth_agency_id() OR tenant_id = public.get_auth_tenant_id());

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Credit notes RLS" ON public.credit_notes;
CREATE POLICY "Credit notes RLS" ON public.credit_notes FOR ALL TO authenticated
    USING (agency_id = public.get_auth_agency_id());

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Transactions RLS" ON public.transactions;
CREATE POLICY "Transactions RLS" ON public.transactions FOR ALL TO authenticated
    USING (agency_id = public.get_auth_agency_id() OR tenant_id = public.get_auth_tenant_id());

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
