-- =============================================================================
-- PRE-LEASING CRM PIPELINE MIGRATION: public.leads & RLS POLICIES
-- Self-Contained, Enterprise-Grade, Production-Ready Script
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENSURE PREREQUISITE TABLES EXIST (Prevents 42P01 undefined relation errors)
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

CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT,
    agency_id UUID,
    manager_id UUID,
    property_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone_number TEXT NOT NULL,
    agency_id UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2. CREATE LEADS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL,
    property_id UUID NULL,
    assigned_coordinator_id UUID NULL,
    full_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    email TEXT NULL,
    lead_source TEXT NOT NULL DEFAULT 'Walk-in',
    stage TEXT NOT NULL DEFAULT 'lead_entry' CHECK (stage IN ('lead_entry', 'negotiating', 'pre_qualification', 'converted', 'lost')),
    budget_max NUMERIC(12, 2) NULL,
    preferred_bedrooms INT NULL,
    notes TEXT NULL,
    converted_tenant_id UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 3. SAFELY ATTACH FOREIGN KEY CONSTRAINTS (IF NOT ALREADY PRESENT)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    -- Foreign key: agency_id -> public.agencies(id)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_leads_agency' AND table_name = 'leads'
    ) THEN
        ALTER TABLE public.leads 
        ADD CONSTRAINT fk_leads_agency 
        FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;
    END IF;

    -- Foreign key: property_id -> public.properties(id)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_leads_property' AND table_name = 'leads'
    ) THEN
        ALTER TABLE public.leads 
        ADD CONSTRAINT fk_leads_property 
        FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;
    END IF;

    -- Foreign key: assigned_coordinator_id -> public.profiles(id)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_leads_coordinator' AND table_name = 'leads'
    ) THEN
        ALTER TABLE public.leads 
        ADD CONSTRAINT fk_leads_coordinator 
        FOREIGN KEY (assigned_coordinator_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    -- Foreign key: converted_tenant_id -> public.tenants(id)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_leads_tenant' AND table_name = 'leads'
    ) THEN
        ALTER TABLE public.leads 
        ADD CONSTRAINT fk_leads_tenant 
        FOREIGN KEY (converted_tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. CREATE PERFORMANCE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_leads_agency_stage 
    ON public.leads(agency_id, stage);

CREATE INDEX IF NOT EXISTS idx_leads_assigned_coordinator 
    ON public.leads(assigned_coordinator_id);

CREATE INDEX IF NOT EXISTS idx_leads_property_id 
    ON public.leads(property_id);

CREATE INDEX IF NOT EXISTS idx_leads_converted_tenant 
    ON public.leads(converted_tenant_id);

-- -----------------------------------------------------------------------------
-- 5. AUTOMATIC UPDATED_AT TRIGGER
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_leads_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_updated_at ON public.leads;
CREATE TRIGGER trg_leads_updated_at
    BEFORE UPDATE ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_leads_updated_at();

-- -----------------------------------------------------------------------------
-- 6. SECURITY DEFINER HELPER FUNCTIONS (RECURSION-PROOF)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_auth_agency_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
    SELECT agency_id FROM public.profiles WHERE id = auth.uid();
$$;

ALTER FUNCTION public.get_auth_agency_id() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_auth_agency_id() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

ALTER FUNCTION public.get_auth_role() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_auth_assigned_property_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
    SELECT id FROM public.properties 
    WHERE manager_id = auth.uid() 
      AND agency_id = public.get_auth_agency_id();
$$;

ALTER FUNCTION public.get_auth_assigned_property_ids() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_auth_assigned_property_ids() TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7. ROW-LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Clean up any prior policies
DROP POLICY IF EXISTS "leads_owner_all_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_manager_select_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_manager_insert_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_manager_update_policy" ON public.leads;
DROP POLICY IF EXISTS "leads_service_role_policy" ON public.leads;

-- Agency Owner: Full SELECT, INSERT, UPDATE, DELETE within their agency
CREATE POLICY "leads_owner_all_policy" ON public.leads
    FOR ALL
    TO authenticated
    USING (
        agency_id = public.get_auth_agency_id()
        AND public.get_auth_role() = 'agency_owner'
    )
    WITH CHECK (
        agency_id = public.get_auth_agency_id()
        AND public.get_auth_role() = 'agency_owner'
    );

-- Property Manager: SELECT scoped to assigned coordinator, assigned properties, or unassigned pool
CREATE POLICY "leads_manager_select_policy" ON public.leads
    FOR SELECT
    TO authenticated
    USING (
        agency_id = public.get_auth_agency_id()
        AND public.get_auth_role() = 'property_manager'
        AND (
            assigned_coordinator_id = auth.uid()
            OR (property_id IS NOT NULL AND property_id IN (SELECT public.get_auth_assigned_property_ids()))
            OR (property_id IS NULL AND assigned_coordinator_id IS NULL)
        )
    );

-- Property Manager: INSERT leads within their agency and assigned properties
CREATE POLICY "leads_manager_insert_policy" ON public.leads
    FOR INSERT
    TO authenticated
    WITH CHECK (
        agency_id = public.get_auth_agency_id()
        AND public.get_auth_role() = 'property_manager'
        AND (
            property_id IS NULL
            OR property_id IN (SELECT public.get_auth_assigned_property_ids())
        )
    );

-- Property Manager: UPDATE leads assigned to them or within their assigned properties
CREATE POLICY "leads_manager_update_policy" ON public.leads
    FOR UPDATE
    TO authenticated
    USING (
        agency_id = public.get_auth_agency_id()
        AND public.get_auth_role() = 'property_manager'
        AND (
            assigned_coordinator_id = auth.uid()
            OR (property_id IS NOT NULL AND property_id IN (SELECT public.get_auth_assigned_property_ids()))
        )
    )
    WITH CHECK (
        agency_id = public.get_auth_agency_id()
        AND public.get_auth_role() = 'property_manager'
    );

-- Service Role Policy: Full Access
CREATE POLICY "leads_service_role_policy" ON public.leads
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
