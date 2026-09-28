-- =============================================================================
-- AGENCY SETTINGS & OPERATIONAL PROTOCOLS MIGRATION
-- Global approval policies & operational protocol toggles (Silqu-grade)
-- Production-Ready, Safe to re-run, Non-destructive
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENSURE PREREQUISITE TABLES EXIST (Safeguard against 42P01)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subscription_status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2. CREATE TABLE: public.agency_settings
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agency_settings (
    agency_id UUID PRIMARY KEY REFERENCES public.agencies(id) ON DELETE CASCADE,
    require_expense_approval BOOLEAN NOT NULL DEFAULT true,
    require_invoice_cancellation_approval BOOLEAN NOT NULL DEFAULT true,
    enable_automated_billing BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 3. SEED SETTINGS FOR EXISTING AGENCIES
-- -----------------------------------------------------------------------------
INSERT INTO public.agency_settings (agency_id, require_expense_approval, require_invoice_cancellation_approval, enable_automated_billing)
SELECT id, true, true, false
FROM public.agencies
ON CONFLICT (agency_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
--    Ensures ONLY agency_owner can view and manage these settings
-- -----------------------------------------------------------------------------
ALTER TABLE public.agency_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agency owners can select agency settings" ON public.agency_settings;
CREATE POLICY "Agency owners can select agency settings"
    ON public.agency_settings
    FOR SELECT
    TO authenticated
    USING (
        agency_id IN (
            SELECT p.agency_id FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'agency_owner'
        )
    );

DROP POLICY IF EXISTS "Agency owners can insert agency settings" ON public.agency_settings;
CREATE POLICY "Agency owners can insert agency settings"
    ON public.agency_settings
    FOR INSERT
    TO authenticated
    WITH CHECK (
        agency_id IN (
            SELECT p.agency_id FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'agency_owner'
        )
    );

DROP POLICY IF EXISTS "Agency owners can update agency settings" ON public.agency_settings;
CREATE POLICY "Agency owners can update agency settings"
    ON public.agency_settings
    FOR UPDATE
    TO authenticated
    USING (
        agency_id IN (
            SELECT p.agency_id FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'agency_owner'
        )
    )
    WITH CHECK (
        agency_id IN (
            SELECT p.agency_id FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'agency_owner'
        )
    );

DROP POLICY IF EXISTS "Agency owners can delete agency settings" ON public.agency_settings;
CREATE POLICY "Agency owners can delete agency settings"
    ON public.agency_settings
    FOR DELETE
    TO authenticated
    USING (
        agency_id IN (
            SELECT p.agency_id FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'agency_owner'
        )
    );

