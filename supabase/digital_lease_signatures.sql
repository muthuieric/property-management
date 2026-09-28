-- =============================================================================
-- DIGITAL LEASE SIGNATURES MIGRATION
-- Enhances public.leases with cryptographic signature audit trail & status
-- Production-Ready, Safe to re-run, Non-destructive
-- DIGITAL LEASE SIGNATURES & SECURITY INTEGRITY MIGRATION
-- Enhances public.leases with cryptographic signatures, IP audit trail & RLS
-- Safe to re-run, non-destructive
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENSURE PREREQUISITE TABLE EXISTS (Safeguard)
-- 1. SAFELY ADD DIGITAL SIGNATURE AUDIT TRAIL COLUMNS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID,
    tenant_id UUID,
    agency_id UUID,
    start_date DATE NOT NULL,
    end_date DATE,
    deposit_amount NUMERIC(12, 2) DEFAULT 0,
    deposit_months INT DEFAULT 1,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2. ALTER LEASES TABLE: ADD DIGITAL SIGNATURE & STATUS COLUMNS
-- -----------------------------------------------------------------------------
ALTER TABLE public.leases
    ADD COLUMN IF NOT EXISTS signature_hash TEXT,
    ADD COLUMN IF NOT EXISTS signed_by_ip TEXT,
    ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS lease_status TEXT DEFAULT 'pending_signature';

-- -----------------------------------------------------------------------------
-- 3. SAFELY ATTACH CHECK CONSTRAINT FOR LEASE STATUS LIFECYCLE
-- 2. ATTACH LIFECYCLE STATUS CONSTRAINT
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'leases_lease_status_check'
    ) THEN
        ALTER TABLE public.leases
            ADD CONSTRAINT leases_lease_status_check
            CHECK (lease_status IN ('pending_signature', 'active', 'expired', 'terminated'));
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. SYNCHRONIZE EXISTING ACTIVE LEASES
-- 3. SYNCHRONIZE EXISTING ACTIVE LEASES
-- Existing active tenancies remain 'active' without requiring retroactive signing
-- -----------------------------------------------------------------------------
UPDATE public.leases
SET lease_status = 'active'
WHERE is_active = true 
  AND (lease_status IS NULL OR lease_status = 'pending_signature');

-- -----------------------------------------------------------------------------
-- 5. PERFORMANCE INDEXES FOR FAST LOOKUP & STATUS FILTERING
-- 4. FAST LOOKUP & PERFORMANCE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_leases_status 
    ON public.leases(lease_status);

CREATE INDEX IF NOT EXISTS idx_leases_tenant_status 
    ON public.leases(tenant_id, lease_status);

CREATE INDEX IF NOT EXISTS idx_leases_signature_hash 
    ON public.leases(signature_hash);

-- -----------------------------------------------------------------------------
-- 5. ENABLE ROW-LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 6. POLICY: TENANTS CAN VIEW THEIR OWN LEASES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Tenants can view own leases" ON public.leases;
CREATE POLICY "Tenants can view own leases"
ON public.leases
FOR SELECT
TO authenticated
USING (
    tenant_id IN (
        SELECT id FROM public.tenants WHERE user_id = auth.uid() OR id = auth.uid()
    ) OR tenant_id = auth.uid()
);

-- -----------------------------------------------------------------------------
-- 7. POLICY: TENANTS CAN DIGITALLY SIGN (UPDATE) THEIR OWN LEASE
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Tenants can digitally sign own lease" ON public.leases;
CREATE POLICY "Tenants can digitally sign own lease"
ON public.leases
FOR UPDATE
TO authenticated
USING (
    tenant_id IN (
        SELECT id FROM public.tenants WHERE user_id = auth.uid() OR id = auth.uid()
    ) OR tenant_id = auth.uid()
)
WITH CHECK (
    (
        tenant_id IN (
            SELECT id FROM public.tenants WHERE user_id = auth.uid() OR id = auth.uid()
        ) OR tenant_id = auth.uid()
    )
    AND signature_hash IS NOT NULL
);

-- -----------------------------------------------------------------------------
-- 8. TRIGGER: PREVENT TENANTS FROM MODIFYING SENSITIVE LEASE TERMS
-- Restricts tenants from altering rent, deposit, start_date, end_date, unit_id
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_lease_signature_integrity()
RETURNS TRIGGER AS $$
DECLARE
    is_agency_staff BOOLEAN := false;
BEGIN
    -- Check if user is staff/admin
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() 
          AND role IN ('agency_owner', 'property_coordinator', 'property_manager', 'super_admin')
    ) INTO is_agency_staff;

    -- If executed by a tenant:
    IF NOT is_agency_staff AND auth.role() = 'authenticated' THEN
        -- Prevent tampering with contractual rent, deposits, dates, unit, or tenant ownership
        IF NEW.deposit_amount IS DISTINCT FROM OLD.deposit_amount OR
           NEW.deposit_months IS DISTINCT FROM OLD.deposit_months OR
           NEW.start_date IS DISTINCT FROM OLD.start_date OR
           NEW.end_date IS DISTINCT FROM OLD.end_date OR
           NEW.unit_id IS DISTINCT FROM OLD.unit_id OR
           NEW.agency_id IS DISTINCT FROM OLD.agency_id OR
           NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
            RAISE EXCEPTION 'Tenants cannot modify lease terms, rent, deposit amount, or unit allocation during signing.';
        END IF;

        -- Require signature_hash when activating the lease
        IF NEW.lease_status = 'active' AND (NEW.signature_hash IS NULL OR NEW.signature_hash = '') THEN
            RAISE EXCEPTION 'A valid cryptographic signature hash is required to activate a tenancy agreement.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_lease_signature_integrity ON public.leases;
CREATE TRIGGER trg_enforce_lease_signature_integrity
    BEFORE UPDATE ON public.leases
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_lease_signature_integrity();
