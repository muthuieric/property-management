-- =============================================================================
-- SUPABASE MIGRATION: DEPOSIT REFUND LIFECYCLE, UTILITIES & SITE OPERATIONS
-- High-End 2-Month Deposit Custody, Clearance Vouchers & Coordinator Job Duties
-- =============================================================================

-- 1. ENHANCE LEASES TABLE FOR HIGH-END DEPOSIT & SETTLEMENT LIFECYCLE
ALTER TABLE public.leases
    ADD COLUMN IF NOT EXISTS deposit_months INT DEFAULT 1,
    ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT 'held_in_escrow',
    ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS refund_deductions NUMERIC(12, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS refund_payout_method TEXT,
    ADD COLUMN IF NOT EXISTS refund_payout_ref TEXT,
    ADD COLUMN IF NOT EXISTS refund_payout_date DATE,
    ADD COLUMN IF NOT EXISTS refund_recipient_details TEXT,
    ADD COLUMN IF NOT EXISTS refund_disbursed_by UUID REFERENCES public.profiles(id);

-- Check constraints for leases refund lifecycle
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'leases_refund_status_check'
    ) THEN
        ALTER TABLE public.leases
            ADD CONSTRAINT leases_refund_status_check
            CHECK (refund_status IN ('held_in_escrow', 'clearance_pending', 'deductions_approved', 'refund_disbursed', 'deductions_exhausted'));
    END IF;
END $$;


-- 2. TABLE: deposit_settlements (Immutable Audit Log for Every Returned Deposit)
CREATE TABLE IF NOT EXISTS public.deposit_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    lease_id UUID NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
    property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    starting_deposit NUMERIC(12, 2) NOT NULL,
    rent_arrears_deduction NUMERIC(12, 2) DEFAULT 0,
    water_arrears_deduction NUMERIC(12, 2) DEFAULT 0,
    repairs_deduction NUMERIC(12, 2) DEFAULT 0,
    total_deductions NUMERIC(12, 2) NOT NULL,
    net_refund_amount NUMERIC(12, 2) NOT NULL,
    payout_status TEXT NOT NULL DEFAULT 'completed'
        CHECK (payout_status IN ('pending_approval', 'approved', 'completed', 'disputed')),
    payout_method TEXT NOT NULL,
    payout_reference TEXT NOT NULL,
    payout_date DATE NOT NULL DEFAULT CURRENT_DATE,
    recipient_name TEXT,
    recipient_phone_or_account TEXT,
    cleared_by UUID NOT NULL REFERENCES public.profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deposit_settlements_agency 
    ON public.deposit_settlements(agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposit_settlements_lease 
    ON public.deposit_settlements(lease_id);


-- 3. TABLE: water_meter_readings (Site-Specific Monthly Tabulation)
CREATE TABLE IF NOT EXISTS public.water_meter_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    billing_month DATE NOT NULL,
    previous_reading NUMERIC(10, 2) NOT NULL,
    current_reading NUMERIC(10, 2) NOT NULL,
    rate_per_unit NUMERIC(10, 2) NOT NULL DEFAULT 150.00,
    total_amount NUMERIC(12, 2) NOT NULL,
    recorded_by UUID REFERENCES public.profiles(id),
    billed_transaction_id UUID REFERENCES public.transactions(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_unit_month_reading UNIQUE (unit_id, billing_month)
);

CREATE INDEX IF NOT EXISTS idx_water_readings_property_month 
    ON public.water_meter_readings(property_id, billing_month DESC);


-- 4. TABLE: site_visit_reports (Coordinator Ground Inspection Accountability)
CREATE TABLE IF NOT EXISTS public.site_visit_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    coordinator_id UUID NOT NULL REFERENCES public.profiles(id),
    visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    cleanliness_rating TEXT NOT NULL CHECK (cleanliness_rating IN ('excellent', 'good', 'fair', 'poor')),
    garbage_collected BOOLEAN NOT NULL DEFAULT true,
    drainage_status TEXT NOT NULL CHECK (drainage_status IN ('clear_and_flowing', 'minor_debris', 'blocked_action_needed')),
    gardens_status TEXT NOT NULL CHECK (gardens_status IN ('well_maintained', 'needs_trimming', 'poor')),
    parking_compliance BOOLEAN NOT NULL DEFAULT true,
    kplc_status TEXT DEFAULT 'normal',
    caretaker_name TEXT,
    caretaker_feedback TEXT,
    issues_observed TEXT,
    action_items TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_visits_property 
    ON public.site_visit_reports(property_id, visit_date DESC);


-- 5. ENHANCE UNITS WITH KPLC & WATER METER IDENTIFIERS
ALTER TABLE public.units
    ADD COLUMN IF NOT EXISTS kplc_meter_number TEXT,
    ADD COLUMN IF NOT EXISTS water_meter_number TEXT;


-- 6. ENHANCE MAINTENANCE TICKETS WITH CONTRACTOR QUOTE APPROVAL LIFECYCLE
ALTER TABLE public.maintenance_tickets
    ADD COLUMN IF NOT EXISTS contractor_name TEXT,
    ADD COLUMN IF NOT EXISTS contractor_phone TEXT,
    ADD COLUMN IF NOT EXISTS quote_amount NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS quote_status TEXT DEFAULT 'no_quote_needed',
    ADD COLUMN IF NOT EXISTS target_completion_date DATE;


-- 7. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.deposit_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_meter_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visit_reports ENABLE ROW LEVEL SECURITY;

-- Deposit Settlements RLS
DROP POLICY IF EXISTS "Agency staff access deposit settlements" ON public.deposit_settlements;
CREATE POLICY "Agency staff access deposit settlements" ON public.deposit_settlements
    FOR ALL TO authenticated
    USING (agency_id = public.get_auth_agency_id())
    WITH CHECK (agency_id = public.get_auth_agency_id());

-- Water Readings RLS
DROP POLICY IF EXISTS "Agency staff access water readings" ON public.water_meter_readings;
CREATE POLICY "Agency staff access water readings" ON public.water_meter_readings
    FOR ALL TO authenticated
    USING (agency_id = public.get_auth_agency_id())
    WITH CHECK (agency_id = public.get_auth_agency_id());

-- Site Visit Reports RLS
DROP POLICY IF EXISTS "Agency staff access site visit reports" ON public.site_visit_reports;
CREATE POLICY "Agency staff access site visit reports" ON public.site_visit_reports
    FOR ALL TO authenticated
    USING (agency_id = public.get_auth_agency_id())
    WITH CHECK (agency_id = public.get_auth_agency_id());
