-- =============================================================================
-- SEQUENTIAL ONBOARDING WIZARD: PROPERTIES SCHEMA EXPANSION
-- Adds comprehensive onboarding & configuration fields to public.properties
-- Production-Ready, Safe to re-run, Non-destructive
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENSURE PREREQUISITE TABLES EXIST (Safeguard)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subscription_status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT,
    agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
    manager_id UUID,
    property_type TEXT DEFAULT 'Apartment',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2. ALTER public.properties: ADD WIZARD ONBOARDING COLUMNS
-- -----------------------------------------------------------------------------
ALTER TABLE public.properties
    ADD COLUMN IF NOT EXISTS property_type TEXT DEFAULT 'Apartment',
    ADD COLUMN IF NOT EXISTS purpose TEXT DEFAULT 'Rent',
    ADD COLUMN IF NOT EXISTS floors INT DEFAULT 1,
    ADD COLUMN IF NOT EXISTS owner_mobile TEXT,
    ADD COLUMN IF NOT EXISTS logo_url TEXT,
    ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'KES',
    ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Africa/Nairobi',
    ADD COLUMN IF NOT EXISTS require_digital_lease_signatures BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS standard_base_rent NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS standard_water_rate NUMERIC(10, 2) DEFAULT 150.00;

-- Update defaults for existing rows if null
UPDATE public.properties
SET 
    property_type = COALESCE(property_type, 'Apartment'),
    purpose = COALESCE(purpose, 'Rent'),
    floors = COALESCE(floors, 1),
    currency = COALESCE(currency, 'KES'),
    timezone = COALESCE(timezone, 'Africa/Nairobi'),
    require_digital_lease_signatures = COALESCE(require_digital_lease_signatures, true),
    standard_base_rent = COALESCE(standard_base_rent, 0.00),
    standard_water_rate = COALESCE(standard_water_rate, 150.00);

-- -----------------------------------------------------------------------------
-- 3. CHECK CONSTRAINTS
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'properties_purpose_check'
    ) THEN
        ALTER TABLE public.properties
            ADD CONSTRAINT properties_purpose_check
            CHECK (purpose IN ('Rent', 'Sale'));
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. PERFORMANCE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_properties_type 
    ON public.properties(property_type);

CREATE INDEX IF NOT EXISTS idx_properties_purpose 
    ON public.properties(purpose);

-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) FOR AGENCY OWNERS
-- -----------------------------------------------------------------------------
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agency owners full access to properties" ON public.properties;
CREATE POLICY "Agency owners full access to properties" ON public.properties
    FOR ALL
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

