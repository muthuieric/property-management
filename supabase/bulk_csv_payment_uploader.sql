-- ============================================================================
-- MIGRATION: BULK CSV PAYMENT UPLOADER & RECONCILIATION
-- Luffi Tech Enterprise B2B SaaS
-- ============================================================================

-- 1. Alter public.transactions to support bulk reconciliation workflows
ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' 
        CHECK (status IN ('pending', 'verified', 'bounced')),
    ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'MPESA',
    ADD COLUMN IF NOT EXISTS external_reference TEXT;

-- 2. Backfill existing historical transactions to 'verified'
UPDATE public.transactions
SET status = 'verified'
WHERE status IS NULL OR status = 'pending';

-- 3. Composite performance indexes for status filtering and duplicate reference checking
CREATE INDEX IF NOT EXISTS idx_transactions_agency_status 
    ON public.transactions(agency_id, status);

CREATE INDEX IF NOT EXISTS idx_transactions_external_ref 
    ON public.transactions(agency_id, external_reference)
    WHERE external_reference IS NOT NULL;

-- 4. RLS POLICIES FOR TRANSACTIONS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 4a. Property Coordinators & Agency Owners: Insert pending transactions
DROP POLICY IF EXISTS "Coordinators insert assigned property transactions" ON public.transactions;
CREATE POLICY "Coordinators insert assigned property transactions" ON public.transactions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        agency_id = public.get_auth_agency_id()
        AND (
            public.get_auth_role() = 'agency_owner'
            OR (
                public.get_auth_role() = 'property_manager'
                AND property_id IN (
                    SELECT id FROM public.properties WHERE manager_id = auth.uid()
                )
                AND (status IS NULL OR status = 'pending')
            )
        )
    );

-- 4b. Agency Owners: Update transactions (reconcile/verify pending payments)
DROP POLICY IF EXISTS "Agency owners update transactions" ON public.transactions;
CREATE POLICY "Agency owners update transactions" ON public.transactions
    FOR UPDATE
    TO authenticated
    USING (
        agency_id = public.get_auth_agency_id()
        AND public.get_auth_role() = 'agency_owner'
    )
    WITH CHECK (
        agency_id = public.get_auth_agency_id()
        AND public.get_auth_role() = 'agency_owner'
    );

