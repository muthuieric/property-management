-- =============================================================================
-- GLOBAL MONTHLY INVOICE GENERATOR MIGRATION ("BILL ALL")
-- Creates public.invoices table for monthly tenant billing runs
-- Configures Row-Level Security (RLS) for agency owners, managers & tenants
-- Safe to re-run, non-destructive
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CREATE INVOICES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    lease_id UUID NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
    billing_month DATE NOT NULL,
    base_rent_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    utilities_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'unpaid',
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Check constraints
    CONSTRAINT chk_invoices_status CHECK (status IN ('unpaid', 'partial', 'paid')),
    CONSTRAINT chk_invoices_amounts CHECK (total_amount >= 0 AND base_rent_amount >= 0 AND utilities_amount >= 0),
    CONSTRAINT uq_invoices_lease_month UNIQUE (lease_id, billing_month)
);

-- -----------------------------------------------------------------------------
-- 2. PERFORMANCE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id 
    ON public.invoices(tenant_id);

CREATE INDEX IF NOT EXISTS idx_invoices_lease_id 
    ON public.invoices(lease_id);

CREATE INDEX IF NOT EXISTS idx_invoices_property_id 
    ON public.invoices(property_id);

CREATE INDEX IF NOT EXISTS idx_invoices_agency_id 
    ON public.invoices(agency_id);

CREATE INDEX IF NOT EXISTS idx_invoices_billing_month 
    ON public.invoices(billing_month);

CREATE INDEX IF NOT EXISTS idx_invoices_status 
    ON public.invoices(status);

-- -----------------------------------------------------------------------------
-- 3. ENABLE ROW-LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 4. RLS POLICIES FOR INVOICES
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Agency staff can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Agency staff can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Agency staff can update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Agency staff can delete invoices" ON public.invoices;
DROP POLICY IF EXISTS "Tenants can view own invoices" ON public.invoices;

-- Staff SELECT policy: Agency owners see all agency invoices; managers see assigned properties
CREATE POLICY "Agency staff can view invoices"
ON public.invoices
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.properties p
        JOIN public.profiles pr ON pr.agency_id = p.agency_id
        WHERE p.id = invoices.property_id
          AND pr.id = auth.uid()
          AND (pr.role = 'agency_owner' OR p.manager_id = auth.uid())
    )
);

-- Staff INSERT policy
CREATE POLICY "Agency staff can insert invoices"
ON public.invoices
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.properties p
        JOIN public.profiles pr ON pr.agency_id = p.agency_id
        WHERE p.id = invoices.property_id
          AND pr.id = auth.uid()
          AND (pr.role = 'agency_owner' OR p.manager_id = auth.uid())
    )
);

-- Staff UPDATE policy
CREATE POLICY "Agency staff can update invoices"
ON public.invoices
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.properties p
        JOIN public.profiles pr ON pr.agency_id = p.agency_id
        WHERE p.id = invoices.property_id
          AND pr.id = auth.uid()
          AND (pr.role = 'agency_owner' OR p.manager_id = auth.uid())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.properties p
        JOIN public.profiles pr ON pr.agency_id = p.agency_id
        WHERE p.id = invoices.property_id
          AND pr.id = auth.uid()
          AND (pr.role = 'agency_owner' OR p.manager_id = auth.uid())
    )
);

-- Staff DELETE policy: Agency owners only
CREATE POLICY "Agency staff can delete invoices"
ON public.invoices
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.properties p
        JOIN public.profiles pr ON pr.agency_id = p.agency_id
        WHERE p.id = invoices.property_id
          AND pr.id = auth.uid()
          AND pr.role = 'agency_owner'
    )
);

-- Tenants SELECT policy: can view own invoices
CREATE POLICY "Tenants can view own invoices"
ON public.invoices
FOR SELECT
TO authenticated
USING (
    tenant_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.id = invoices.tenant_id
          AND t.user_id = auth.uid()
    )
);

