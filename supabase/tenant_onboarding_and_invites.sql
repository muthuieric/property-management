-- =============================================================================
-- TENANT ONBOARDING SUITE: KYC FIELDS & SELF-SERVE INVITES MIGRATION
-- Adds granular KYC fields to public.tenants and creates public.tenant_invites
-- Safe to re-run, non-destructive
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ALTER PUBLIC.TENANTS: ADD GRANULAR KYC & EMERGENCY FIELDS
-- -----------------------------------------------------------------------------
ALTER TABLE public.tenants
    ADD COLUMN IF NOT EXISTS id_number TEXT,
    ADD COLUMN IF NOT EXISTS vehicle_registration TEXT,
    ADD COLUMN IF NOT EXISTS next_of_kin_name TEXT,
    ADD COLUMN IF NOT EXISTS next_of_kin_phone TEXT,
    ADD COLUMN IF NOT EXISTS next_of_kin_relation TEXT;

-- -----------------------------------------------------------------------------
-- 2. CREATE PUBLIC.TENANT_INVITES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    tenant_phone TEXT NOT NULL,
    invite_token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 3. PERFORMANCE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tenant_invites_token 
    ON public.tenant_invites(invite_token);

CREATE INDEX IF NOT EXISTS idx_tenant_invites_unit 
    ON public.tenant_invites(unit_id);

CREATE INDEX IF NOT EXISTS idx_tenant_invites_status 
    ON public.tenant_invites(status);

CREATE INDEX IF NOT EXISTS idx_tenants_id_number 
    ON public.tenants(id_number);

-- -----------------------------------------------------------------------------
-- 4. ENABLE ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.tenant_invites ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 5. RLS POLICIES FOR TENANT INVITES
-- -----------------------------------------------------------------------------

-- Agency staff can manage invites for properties belonging to their agency
DROP POLICY IF EXISTS "Agency staff can manage tenant invites" ON public.tenant_invites;
CREATE POLICY "Agency staff can manage tenant invites"
ON public.tenant_invites
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.properties p
        JOIN public.profiles pr ON pr.agency_id = p.agency_id
        WHERE p.id = tenant_invites.property_id
          AND pr.id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.properties p
        JOIN public.profiles pr ON pr.agency_id = p.agency_id
        WHERE p.id = tenant_invites.property_id
          AND pr.id = auth.uid()
    )
);

-- Public/anonymous applicants can read valid, unexpired invites by token
DROP POLICY IF EXISTS "Public can view valid invite by token" ON public.tenant_invites;
CREATE POLICY "Public can view valid invite by token"
ON public.tenant_invites
FOR SELECT
TO anon, authenticated
USING (
    expires_at > now()
);

