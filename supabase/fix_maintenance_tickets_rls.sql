-- =============================================================================
-- FIX ROW-LEVEL SECURITY (RLS) POLICIES FOR public.maintenance_tickets
-- B2B Property Management SaaS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SAFELY DROP ALL EXISTING POLICIES ON maintenance_tickets
--    Dynamically removes any obsolete, restrictive, or broken policies.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'maintenance_tickets'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. SECURITY DEFINER HELPER FUNCTIONS
--    Executes with postgres privileges to bypass recursive RLS loops.
-- -----------------------------------------------------------------------------

-- Helper: Current user's agency_id from profiles
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

-- Helper: Current user's role from profiles
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

-- Helper: Current user's tenant_id from tenants table
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
    SELECT id FROM public.tenants WHERE user_id = auth.uid() OR id = auth.uid() LIMIT 1;
$$;

ALTER FUNCTION public.get_auth_tenant_id() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_auth_tenant_id() TO authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 3. ENABLE ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- 4. CLEAN, PRODUCTION-READY RLS POLICIES FOR maintenance_tickets
-- -----------------------------------------------------------------------------

-- SELECT: Agency staff see all tickets in their agency; tenants see their own tickets
CREATE POLICY "maintenance_tickets_select_policy" ON public.maintenance_tickets
    FOR SELECT
    TO authenticated
    USING (
        agency_id = public.get_auth_agency_id()
        OR tenant_id = public.get_auth_tenant_id()
        OR reported_by = public.get_auth_tenant_id()
        OR reported_by = auth.uid()
    );

-- INSERT: Agency staff can log tickets; tenants can submit requests for their unit/account
CREATE POLICY "maintenance_tickets_insert_policy" ON public.maintenance_tickets
    FOR INSERT
    TO authenticated
    WITH CHECK (
        agency_id = public.get_auth_agency_id()
        OR tenant_id = public.get_auth_tenant_id()
        OR reported_by = public.get_auth_tenant_id()
        OR reported_by = auth.uid()
    );

-- UPDATE: Agency staff can dispatch/update/resolve tickets; tenants can update their open tickets
CREATE POLICY "maintenance_tickets_update_policy" ON public.maintenance_tickets
    FOR UPDATE
    TO authenticated
    USING (
        agency_id = public.get_auth_agency_id()
        OR tenant_id = public.get_auth_tenant_id()
        OR reported_by = public.get_auth_tenant_id()
        OR reported_by = auth.uid()
    )
    WITH CHECK (
        agency_id = public.get_auth_agency_id()
        OR tenant_id = public.get_auth_tenant_id()
        OR reported_by = public.get_auth_tenant_id()
        OR reported_by = auth.uid()
    );

-- DELETE: Agency owners can remove tickets; tenants can delete their own reported tickets
CREATE POLICY "maintenance_tickets_delete_policy" ON public.maintenance_tickets
    FOR DELETE
    TO authenticated
    USING (
        (agency_id = public.get_auth_agency_id() AND public.get_auth_role() = 'agency_owner')
        OR tenant_id = public.get_auth_tenant_id()
        OR reported_by = public.get_auth_tenant_id()
        OR reported_by = auth.uid()
    );


-- -----------------------------------------------------------------------------
-- 5. PERFORMANCE INDEXES
--    Ensures instant index lookups during RLS evaluation.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_maintenance_tickets_agency_id 
    ON public.maintenance_tickets(agency_id);

CREATE INDEX IF NOT EXISTS idx_maintenance_tickets_tenant_id 
    ON public.maintenance_tickets(tenant_id);

CREATE INDEX IF NOT EXISTS idx_maintenance_tickets_reported_by 
    ON public.maintenance_tickets(reported_by);

CREATE INDEX IF NOT EXISTS idx_maintenance_tickets_unit_id 
    ON public.maintenance_tickets(unit_id);
