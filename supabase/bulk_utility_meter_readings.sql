-- =============================================================================
-- BULK CSV UTILITY METER READINGS MIGRATION
-- Creates public.utility_readings table for multi-unit meter capture
-- Configures Row-Level Security (RLS) for agency owners & property coordinators
-- Safe to re-run, non-destructive
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CREATE UTILITY READINGS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.utility_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
    utility_type TEXT NOT NULL DEFAULT 'WATER',
    previous_reading NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    current_reading NUMERIC(10, 2) NOT NULL,
    consumption NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    rate_per_unit NUMERIC(10, 2) NOT NULL DEFAULT 150.00,
    total_charge NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'draft',
    reading_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Check constraints
    CONSTRAINT chk_utility_readings_status CHECK (status IN ('draft', 'invoiced', 'bundled')),
    CONSTRAINT chk_utility_readings_consumption CHECK (consumption >= 0)
);

-- -----------------------------------------------------------------------------
-- 2. PERFORMANCE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_utility_readings_property_id 
    ON public.utility_readings(property_id);

CREATE INDEX IF NOT EXISTS idx_utility_readings_unit_id 
    ON public.utility_readings(unit_id);

CREATE INDEX IF NOT EXISTS idx_utility_readings_agency_id 
    ON public.utility_readings(agency_id);

CREATE INDEX IF NOT EXISTS idx_utility_readings_status 
    ON public.utility_readings(status);

CREATE INDEX IF NOT EXISTS idx_utility_readings_unit_date_desc 
    ON public.utility_readings(unit_id, reading_date DESC, created_at DESC);

-- -----------------------------------------------------------------------------
-- 3. ENABLE ROW-LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.utility_readings ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 4. RLS POLICIES FOR UTILITY READINGS
-- -----------------------------------------------------------------------------

-- Drop previous policies if re-running
DROP POLICY IF EXISTS "Agency staff can view utility readings" ON public.utility_readings;
DROP POLICY IF EXISTS "Agency staff can insert utility readings" ON public.utility_readings;
DROP POLICY IF EXISTS "Agency staff can update utility readings" ON public.utility_readings;
DROP POLICY IF EXISTS "Agency staff can delete draft utility readings" ON public.utility_readings;

-- SELECT policy: Agency owners see all agency readings; coordinators see assigned properties
CREATE POLICY "Agency staff can view utility readings"
ON public.utility_readings
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.properties p
        JOIN public.profiles pr ON pr.agency_id = p.agency_id
        WHERE p.id = utility_readings.property_id
          AND pr.id = auth.uid()
          AND (pr.role = 'agency_owner' OR p.manager_id = auth.uid())
    )
);

-- INSERT policy: Agency owners and coordinators can insert readings for their properties
CREATE POLICY "Agency staff can insert utility readings"
ON public.utility_readings
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.properties p
        JOIN public.profiles pr ON pr.agency_id = p.agency_id
        WHERE p.id = utility_readings.property_id
          AND pr.id = auth.uid()
          AND (pr.role = 'agency_owner' OR p.manager_id = auth.uid())
    )
);

-- UPDATE policy: Can update draft readings for their properties
CREATE POLICY "Agency staff can update utility readings"
ON public.utility_readings
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.properties p
        JOIN public.profiles pr ON pr.agency_id = p.agency_id
        WHERE p.id = utility_readings.property_id
          AND pr.id = auth.uid()
          AND (pr.role = 'agency_owner' OR p.manager_id = auth.uid())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.properties p
        JOIN public.profiles pr ON pr.agency_id = p.agency_id
        WHERE p.id = utility_readings.property_id
          AND pr.id = auth.uid()
          AND (pr.role = 'agency_owner' OR p.manager_id = auth.uid())
    )
);

-- DELETE policy: Owners can delete draft readings
CREATE POLICY "Agency staff can delete draft utility readings"
ON public.utility_readings
FOR DELETE
TO authenticated
USING (
    status = 'draft' AND
    EXISTS (
        SELECT 1 FROM public.properties p
        JOIN public.profiles pr ON pr.agency_id = p.agency_id
        WHERE p.id = utility_readings.property_id
          AND pr.id = auth.uid()
          AND pr.role = 'agency_owner'
    )
);
