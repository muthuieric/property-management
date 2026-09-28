-- =============================================================================
-- ESCROW VAULT: SECURE DATA-MASKED BENEFICIARIES MIGRATION
-- Prevents financial account data leakage during deposit refund disbursements
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
-- 2. CREATE TABLE: public.payout_beneficiaries
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payout_beneficiaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    beneficiary_name TEXT NOT NULL,
    account_type TEXT NOT NULL,
    account_details_raw TEXT NOT NULL,
    account_masked TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT payout_beneficiaries_account_type_check 
        CHECK (account_type IN ('MPESA_PAYBILL', 'MPESA_TILL', 'BANK_ACCOUNT', 'MOBILE_NUMBER'))
);

-- -----------------------------------------------------------------------------
-- 3. PERFORMANCE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_payout_beneficiaries_agency 
    ON public.payout_beneficiaries(agency_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payout_beneficiaries_type 
    ON public.payout_beneficiaries(account_type);

-- -----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
--    Ensures ONLY agency_owner can view, insert, update, or delete beneficiaries
-- -----------------------------------------------------------------------------
ALTER TABLE public.payout_beneficiaries ENABLE ROW LEVEL SECURITY;

-- Select Policy: Only agency owners can view beneficiaries for their agency
DROP POLICY IF EXISTS "Agency owners can select payout beneficiaries" ON public.payout_beneficiaries;
CREATE POLICY "Agency owners can select payout beneficiaries"
    ON public.payout_beneficiaries
    FOR SELECT
    TO authenticated
    USING (
        agency_id IN (
            SELECT p.agency_id FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'agency_owner'
        )
    );

-- Insert Policy: Only agency owners can add beneficiaries to their agency
DROP POLICY IF EXISTS "Agency owners can insert payout beneficiaries" ON public.payout_beneficiaries;
CREATE POLICY "Agency owners can insert payout beneficiaries"
    ON public.payout_beneficiaries
    FOR INSERT
    TO authenticated
    WITH CHECK (
        agency_id IN (
            SELECT p.agency_id FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'agency_owner'
        )
    );

-- Update Policy: Only agency owners can update beneficiaries for their agency
DROP POLICY IF EXISTS "Agency owners can update payout beneficiaries" ON public.payout_beneficiaries;
CREATE POLICY "Agency owners can update payout beneficiaries"
    ON public.payout_beneficiaries
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

-- Delete Policy: Only agency owners can delete beneficiaries for their agency
DROP POLICY IF EXISTS "Agency owners can delete payout beneficiaries" ON public.payout_beneficiaries;
CREATE POLICY "Agency owners can delete payout beneficiaries"
    ON public.payout_beneficiaries
    FOR DELETE
    TO authenticated
    USING (
        agency_id IN (
            SELECT p.agency_id FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'agency_owner'
        )
    );

