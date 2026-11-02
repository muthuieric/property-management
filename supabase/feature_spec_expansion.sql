-- =============================================================================
-- MIGRATION: FEATURE SPEC EXPANSION
-- Luffi Tech Enterprise B2B SaaS
--
-- Implements the spec from DESIGN.md:
--   * units.square_footage (service charge basis)
--   * leases.escalation_percentage (annual rent escalation)
--   * invoices: vat_amount, service_charge_amount, service_charge_rate, pdf_url, emailed_at
--   * agency_billing_identity: company PIN / VAT numbers for invoices
--   * ledger_entries: double-entry tenant ledger
--   * arrears_interest: 2% flat monthly interest on outstanding arrears
--
-- Safe to re-run, non-destructive. Mirrors existing RLS patterns.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENSURE PREREQUISITE TABLES EXIST
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
    manager_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_number TEXT NOT NULL,
    base_rent NUMERIC(12, 2) DEFAULT 0,
    square_footage NUMERIC(10, 2),
    is_occupied BOOLEAN DEFAULT false,
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    parent_unit_id UUID REFERENCES public.units(id),
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

CREATE TABLE IF NOT EXISTS public.leases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE,
    deposit_amount NUMERIC(12, 2) DEFAULT 0,
    deposit_months INT DEFAULT 1,
    is_active BOOLEAN DEFAULT false,
    escalation_percentage NUMERIC(5, 2) DEFAULT 0.00,
    lease_status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    lease_id UUID NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
    billing_month DATE NOT NULL,
    base_rent_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    utilities_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    service_charge_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    service_charge_rate NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    interest_penalty_amount NUMERIC(12, 2) DEFAULT 0.00,
    escalation_applied BOOLEAN DEFAULT false,
    years_elapsed INT DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'unpaid',
    vat_rate NUMERIC(5, 2) DEFAULT 16.00,
    vat_amount NUMERIC(10, 2) DEFAULT 0.00,
    pdf_url TEXT,
    emailed_at TIMESTAMPTZ,
    invoice_number TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT chk_invoices_status CHECK (status IN ('unpaid', 'partial', 'paid')),
    CONSTRAINT chk_invoices_amounts CHECK (total_amount >= 0 AND base_rent_amount >= 0 AND utilities_amount >= 0),
    CONSTRAINT uq_invoices_lease_month UNIQUE (lease_id, billing_month)
);

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

-- -----------------------------------------------------------------------------
-- 2. agency_billing_identity: company PIN / VAT numbers + bank details
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 3. ledger_entries: double-entry tenant ledger
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 4. arrears_interest: 2% flat monthly interest on outstanding arrears
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 5. invoice_sequences: auto-incrementing unbroken invoice number sequence per agency
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    prefix TEXT NOT NULL DEFAULT 'INV',
    last_number INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (agency_id)
);

-- -----------------------------------------------------------------------------
-- 6. credit_notes: negative double-entry bookkeeping for VAT reversals
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 7. ledger_entries: double-entry tenant ledger
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_units_square_footage ON public.units(square_footage);
CREATE INDEX IF NOT EXISTS idx_leases_escalation ON public.leases(escalation_percentage);
CREATE INDEX IF NOT EXISTS idx_leases_end_date ON public.leases(end_date);
CREATE INDEX IF NOT EXISTS idx_leases_tenant_status ON public.leases(tenant_id, lease_status);
CREATE INDEX IF NOT EXISTS idx_invoices_vat ON public.invoices(vat_amount);
CREATE INDEX IF NOT EXISTS idx_invoices_service_charge ON public.invoices(service_charge_amount);
CREATE INDEX IF NOT EXISTS idx_invoices_billing_month_status ON public.invoices(billing_month, status);
CREATE INDEX IF NOT EXISTS idx_invoices_interest_penalty ON public.invoices(interest_penalty_amount);
CREATE INDEX IF NOT EXISTS idx_agency_billing_identity_agency ON public.agency_billing_identity(agency_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_tenant ON public.ledger_entries(tenant_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_agency ON public.ledger_entries(agency_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_arrears_interest_tenant_period ON public.arrears_interest(tenant_id, period_month);
CREATE INDEX IF NOT EXISTS idx_arrears_interest_agency ON public.arrears_interest(agency_id, period_month);
CREATE INDEX IF NOT EXISTS idx_units_parent ON public.units(parent_unit_id);
CREATE INDEX IF NOT EXISTS idx_invoice_sequences_agency ON public.invoice_sequences(agency_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_agency ON public.credit_notes(agency_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_original_invoice ON public.credit_notes(original_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON public.invoices(invoice_number);

-- -----------------------------------------------------------------------------
-- 6. ROW-LEVEL SECURITY
-- -----------------------------------------------------------------------------

-- 6a. agency_billing_identity
ALTER TABLE public.agency_billing_identity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agency staff can view billing identity" ON public.agency_billing_identity;
DROP POLICY IF EXISTS "Agency staff can manage billing identity" ON public.agency_billing_identity;
CREATE POLICY "Agency staff can view billing identity"
    ON public.agency_billing_identity FOR SELECT TO authenticated
    USING (
        agency_id = public.get_auth_agency_id()
    );
CREATE POLICY "Agency staff can manage billing identity"
    ON public.agency_billing_identity FOR ALL TO authenticated
    USING (
        agency_id = public.get_auth_agency_id()
        AND public.get_auth_role() = 'agency_owner'
    )
    WITH CHECK (
        agency_id = public.get_auth_agency_id()
        AND public.get_auth_role() = 'agency_owner'
    );

-- 6b. ledger_entries
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agency staff can view ledger entries" ON public.ledger_entries;
DROP POLICY IF EXISTS "Agency staff can manage ledger entries" ON public.ledger_entries;
DROP POLICY IF EXISTS "Tenants can view own ledger entries" ON public.ledger_entries;
CREATE POLICY "Agency staff can view ledger entries"
    ON public.ledger_entries FOR SELECT TO authenticated
    USING (
        agency_id = public.get_auth_agency_id()
    );
CREATE POLICY "Agency staff can manage ledger entries"
    ON public.ledger_entries FOR ALL TO authenticated
    USING (
        agency_id = public.get_auth_agency_id()
        AND public.get_auth_role() = 'agency_owner'
    )
    WITH CHECK (
        agency_id = public.get_auth_agency_id()
        AND public.get_auth_role() = 'agency_owner'
    );
CREATE POLICY "Tenants can view own ledger entries"
    ON public.ledger_entries FOR SELECT TO authenticated
    USING (
        tenant_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = ledger_entries.tenant_id
              AND t.user_id = auth.uid()
        )
    );

-- 6c. arrears_interest
ALTER TABLE public.arrears_interest ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agency staff can view arrears interest" ON public.arrears_interest;
DROP POLICY IF EXISTS "Agency staff can manage arrears interest" ON public.arrears_interest;
DROP POLICY IF EXISTS "Tenants can view own arrears interest" ON public.arrears_interest;
CREATE POLICY "Agency staff can view arrears interest"
    ON public.arrears_interest FOR SELECT TO authenticated
    USING (
        agency_id = public.get_auth_agency_id()
    );
CREATE POLICY "Agency staff can manage arrears interest"
    ON public.arrears_interest FOR ALL TO authenticated
    USING (
        agency_id = public.get_auth_agency_id()
        AND public.get_auth_role() = 'agency_owner'
    )
    WITH CHECK (
        agency_id = public.get_auth_agency_id()
        AND public.get_auth_role() = 'agency_owner'
    );
CREATE POLICY "Tenants can view own arrears interest"
    ON public.arrears_interest FOR SELECT TO authenticated
    USING (
        tenant_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = arrears_interest.tenant_id
              AND t.user_id = auth.uid()
        )
    );

-- 6d. credit_notes
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agency staff can view credit notes" ON public.credit_notes;
DROP POLICY IF EXISTS "Agency staff can manage credit notes" ON public.credit_notes;
CREATE POLICY "Agency staff can view credit notes"
    ON public.credit_notes FOR SELECT TO authenticated
    USING (
        agency_id = public.get_auth_agency_id()
    );
CREATE POLICY "Agency staff can manage credit notes"
    ON public.credit_notes FOR ALL TO authenticated
    USING (
        agency_id = public.get_auth_agency_id()
        AND public.get_auth_role() = 'agency_owner'
    )
    WITH CHECK (
        agency_id = public.get_auth_agency_id()
        AND public.get_auth_role() = 'agency_owner'
    );

-- 6e. invoice_sequences
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agency staff can view invoice sequences" ON public.invoice_sequences;
DROP POLICY IF EXISTS "Agency staff can manage invoice sequences" ON public.invoice_sequences;
CREATE POLICY "Agency staff can view invoice sequences"
    ON public.invoice_sequences FOR SELECT TO authenticated
    USING (
        agency_id = public.get_auth_agency_id()
    );
CREATE POLICY "Agency staff can manage invoice sequences"
    ON public.invoice_sequences FOR ALL TO authenticated
    USING (
        agency_id = public.get_auth_agency_id()
        AND public.get_auth_role() = 'agency_owner'
    )
    WITH CHECK (
        agency_id = public.get_auth_agency_id()
        AND public.get_auth_role() = 'agency_owner'
    );

-- -----------------------------------------------------------------------------
-- 7. BACKFILL DEFAULTS
-- -----------------------------------------------------------------------------
UPDATE public.leases SET escalation_percentage = 0.00 WHERE escalation_percentage IS NULL;
UPDATE public.leases SET lease_status = 'active' WHERE lease_status IS NULL;
UPDATE public.invoices SET vat_rate = 16.00 WHERE vat_rate IS NULL;
UPDATE public.invoices SET vat_amount = 0.00 WHERE vat_amount IS NULL;
UPDATE public.invoices SET service_charge_amount = 0.00 WHERE service_charge_amount IS NULL;
UPDATE public.invoices SET service_charge_rate = 0.00 WHERE service_charge_rate IS NULL;
UPDATE public.invoices SET interest_penalty_amount = 0.00 WHERE interest_penalty_amount IS NULL;
UPDATE public.invoices SET escalation_applied = false WHERE escalation_applied IS NULL;
UPDATE public.invoices SET years_elapsed = 0 WHERE years_elapsed IS NULL;

-- -----------------------------------------------------------------------------
-- 8. SECURITY DEFINER HELPER: agency billing identity lookup
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_auth_agency_billing_identity()
RETURNS TABLE (
    id UUID,
    agency_id UUID,
    company_name TEXT,
    vat_pin TEXT,
    tax_pin TEXT,
    email TEXT,
    phone TEXT,
    bank_name TEXT,
    bank_account_name TEXT,
    bank_account_number TEXT,
    bank_branch TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
    SELECT abi.id, abi.agency_id, abi.company_name, abi.vat_pin, abi.tax_pin,
           abi.email, abi.phone, abi.bank_name, abi.bank_account_name,
           abi.bank_account_number, abi.bank_branch
    FROM public.agency_billing_identity abi
    WHERE abi.agency_id = public.get_auth_agency_id();
$$;

ALTER FUNCTION public.get_auth_agency_billing_identity() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_auth_agency_billing_identity() TO authenticated, service_role;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
