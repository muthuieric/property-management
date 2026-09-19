-- =============================================================================
-- ROLE-BASED ACCESS CONTROL (RBAC): ASSIGNED-ONLY FILTERING FOR PROPERTY MANAGERS
-- Execute this script in your Supabase SQL Editor
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SECURITY DEFINER HELPER FUNCTIONS (RECURSION-PROOF)
--    Executes with postgres permissions and clean search_path to prevent
--    infinite loops across profiles, properties, units, and leases.
-- -----------------------------------------------------------------------------

-- Helper: Fetch current authenticated user's agency_id
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


-- Helper: Fetch current authenticated user's role
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


-- Helper: Fetch current authenticated user's tenant_id (if tenant)
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


-- Helper: Returns all property IDs explicitly assigned to the caller
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


-- Helper: Returns tenant IDs who have a lease in units of the caller's assigned properties
CREATE OR REPLACE FUNCTION public.get_auth_assigned_tenant_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
    SELECT DISTINCT l.tenant_id 
    FROM public.leases l
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE p.manager_id = auth.uid() 
      AND p.agency_id = public.get_auth_agency_id()
      AND l.tenant_id IS NOT NULL;
$$;

ALTER FUNCTION public.get_auth_assigned_tenant_ids() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_auth_assigned_tenant_ids() TO authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 2. COMPOSITE INDEXES FOR LIGHTNING-FAST RLS EVALUATION
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_properties_manager_agency ON public.properties(manager_id, agency_id);
CREATE INDEX IF NOT EXISTS idx_units_property_id ON public.units(property_id);
CREATE INDEX IF NOT EXISTS idx_leases_unit_tenant ON public.leases(unit_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_tickets_unit_agency ON public.maintenance_tickets(unit_id, agency_id);


-- -----------------------------------------------------------------------------
-- 3. ROW-LEVEL SECURITY POLICIES FOR public.maintenance_tickets
-- -----------------------------------------------------------------------------
ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "maintenance_tickets_select_policy" ON public.maintenance_tickets;
DROP POLICY IF EXISTS "maintenance_tickets_insert_policy" ON public.maintenance_tickets;
DROP POLICY IF EXISTS "maintenance_tickets_update_policy" ON public.maintenance_tickets;

-- SELECT:
-- 1) Agency owners see all agency tickets
-- 2) Property managers see ONLY tickets for units belonging to their assigned properties
-- 3) Tenants see their own reported/assigned tickets
CREATE POLICY "maintenance_tickets_select_policy" ON public.maintenance_tickets
    FOR SELECT
    TO authenticated
    USING (
        (agency_id = public.get_auth_agency_id() AND public.get_auth_role() = 'agency_owner')
        OR (
            agency_id = public.get_auth_agency_id() 
            AND public.get_auth_role() = 'property_manager'
            AND unit_id IN (
                SELECT u.id FROM public.units u
                WHERE u.property_id IN (SELECT public.get_auth_assigned_property_ids())
            )
        )
        OR tenant_id = public.get_auth_tenant_id()
        OR reported_by = public.get_auth_tenant_id()
        OR reported_by = auth.uid()
    );

-- INSERT:
-- Agency staff can log tickets; tenants can log tickets for their unit
CREATE POLICY "maintenance_tickets_insert_policy" ON public.maintenance_tickets
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (
            agency_id = public.get_auth_agency_id() 
            AND public.get_auth_role() = 'agency_owner'
        )
        OR (
            agency_id = public.get_auth_agency_id() 
            AND public.get_auth_role() = 'property_manager'
            AND unit_id IN (
                SELECT u.id FROM public.units u
                WHERE u.property_id IN (SELECT public.get_auth_assigned_property_ids())
            )
        )
        OR tenant_id = public.get_auth_tenant_id()
        OR reported_by = public.get_auth_tenant_id()
        OR reported_by = auth.uid()
    );

-- UPDATE:
-- Owners can update any ticket; Coordinators can update tickets for assigned units
CREATE POLICY "maintenance_tickets_update_policy" ON public.maintenance_tickets
    FOR UPDATE
    TO authenticated
    USING (
        (agency_id = public.get_auth_agency_id() AND public.get_auth_role() = 'agency_owner')
        OR (
            agency_id = public.get_auth_agency_id() 
            AND public.get_auth_role() = 'property_manager'
            AND unit_id IN (
                SELECT u.id FROM public.units u
                WHERE u.property_id IN (SELECT public.get_auth_assigned_property_ids())
            )
        )
    )
    WITH CHECK (
        (agency_id = public.get_auth_agency_id() AND public.get_auth_role() = 'agency_owner')
        OR (
            agency_id = public.get_auth_agency_id() 
            AND public.get_auth_role() = 'property_manager'
            AND unit_id IN (
                SELECT u.id FROM public.units u
                WHERE u.property_id IN (SELECT public.get_auth_assigned_property_ids())
            )
        )
    );


-- -----------------------------------------------------------------------------
-- 4. ROW-LEVEL SECURITY POLICIES FOR public.tenants
-- -----------------------------------------------------------------------------
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenants_select_policy" ON public.tenants;

-- SELECT:
-- 1) Agency owners see all agency tenants
-- 2) Property managers see ONLY tenants with leases in their assigned properties
-- 3) Tenants see their own record
CREATE POLICY "tenants_select_policy" ON public.tenants
    FOR SELECT
    TO authenticated
    USING (
        (agency_id = public.get_auth_agency_id() AND public.get_auth_role() = 'agency_owner')
        OR (
            agency_id = public.get_auth_agency_id() 
            AND public.get_auth_role() = 'property_manager'
            AND id IN (SELECT public.get_auth_assigned_tenant_ids())
        )
        OR id = auth.uid()
        OR user_id = auth.uid()
    );
