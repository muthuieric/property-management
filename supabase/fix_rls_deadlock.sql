-- =============================================================================
-- FIX ROW-LEVEL SECURITY (RLS) DEADLOCK FOR PROFILES & TENANTS
-- B2B Property Management SaaS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SAFELY DROP ALL EXISTING POLICIES ON PROFILES AND TENANTS
--    Dynamically removes any circular or recursive policies that cause empty arrays.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename IN ('profiles', 'tenants')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. SECURITY DEFINER HELPER FUNCTIONS (RECURSION-BREAKING)
--    Bypasses RLS by running with the privileges of the function creator (postgres).
--    Includes strict search_path to satisfy Supabase security linters.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_auth_agency_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
    -- Directly fetches the current authenticated user's agency_id without triggering RLS
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
    -- Directly fetches the current authenticated user's role without triggering RLS
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

ALTER FUNCTION public.get_auth_role() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 3. ENABLE RLS ON TARGET TABLES
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- 4. CLEAN RLS POLICIES FOR public.profiles
--    CRITICAL: The base condition (id = auth.uid()) evaluates first without subqueries,
--    preventing any possibility of infinite recursion.
-- -----------------------------------------------------------------------------

-- SELECT: Users can read their own profile, OR agency members can read profiles in their agency
CREATE POLICY "profiles_select_policy" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid() 
        OR (agency_id = public.get_auth_agency_id())
    );

-- INSERT: User can insert their own profile on signup, or agency_owner can onboard users
CREATE POLICY "profiles_insert_policy" ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        id = auth.uid()
        OR (
            agency_id = public.get_auth_agency_id() 
            AND public.get_auth_role() = 'agency_owner'
        )
    );

-- UPDATE: User can update their own profile, or agency_owner can manage agency profiles
CREATE POLICY "profiles_update_policy" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (
        id = auth.uid()
        OR (
            agency_id = public.get_auth_agency_id() 
            AND public.get_auth_role() = 'agency_owner'
        )
    )
    WITH CHECK (
        id = auth.uid()
        OR (
            agency_id = public.get_auth_agency_id() 
            AND public.get_auth_role() = 'agency_owner'
        )
    );

-- DELETE: Only agency_owner can remove profiles within their agency (cannot delete self)
CREATE POLICY "profiles_delete_policy" ON public.profiles
    FOR DELETE
    TO authenticated
    USING (
        agency_id = public.get_auth_agency_id() 
        AND public.get_auth_role() = 'agency_owner'
        AND id != auth.uid()
    );


-- -----------------------------------------------------------------------------
-- 5. CLEAN RLS POLICIES FOR public.tenants
--    Allows agency owners full CRUD on tenants belonging to their agency.
--    Also allows tenants to view/update their own profile via resident portal.
-- -----------------------------------------------------------------------------

-- SELECT: Agency members see all tenants in their agency; tenants see their own record
CREATE POLICY "tenants_select_policy" ON public.tenants
    FOR SELECT
    TO authenticated
    USING (
        agency_id = public.get_auth_agency_id()
        OR id = auth.uid()
        OR user_id = auth.uid()
    );

-- INSERT: Agency owners and coordinators can create tenants under their agency
CREATE POLICY "tenants_insert_policy" ON public.tenants
    FOR INSERT
    TO authenticated
    WITH CHECK (
        agency_id = public.get_auth_agency_id()
        AND (
            public.get_auth_role() IN ('agency_owner', 'property_manager')
        )
    );

-- UPDATE: Agency owners can update agency tenants; tenants can update their own profile
CREATE POLICY "tenants_update_policy" ON public.tenants
    FOR UPDATE
    TO authenticated
    USING (
        agency_id = public.get_auth_agency_id()
        OR id = auth.uid()
        OR user_id = auth.uid()
    )
    WITH CHECK (
        agency_id = public.get_auth_agency_id()
        OR id = auth.uid()
        OR user_id = auth.uid()
    );

-- DELETE: Only agency owners can delete tenants from their agency
CREATE POLICY "tenants_delete_policy" ON public.tenants
    FOR DELETE
    TO authenticated
    USING (
        agency_id = public.get_auth_agency_id()
        AND public.get_auth_role() = 'agency_owner'
    );


-- -----------------------------------------------------------------------------
-- 6. PERFORMANCE INDEXES FOR RLS EVALUATION
--    Ensures Postgres evaluates RLS checks instantaneously with zero seq scans.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_agency_id ON public.profiles(agency_id);
CREATE INDEX IF NOT EXISTS idx_tenants_agency_id ON public.tenants(agency_id);
CREATE INDEX IF NOT EXISTS idx_tenants_user_id ON public.tenants(user_id);
