-- =============================================================================
-- SINGLE UNIT ONBOARDING WIZARD & ASSET INVENTORY LEDGER MIGRATION
-- Creates public.unit_inventory and enhances public.units with Cloudflare galleries
-- Configures Row-Level Security (RLS) for agency owners & property coordinators
-- Safe to re-run, non-destructive
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CREATE ASSET INVENTORY LEDGER TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.unit_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    condition_at_move_in TEXT DEFAULT 'Good' CHECK (condition_at_move_in IN ('New', 'Good', 'Fair', 'Damaged')),
    estimated_value NUMERIC(10, 2),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2. ALTER PUBLIC.UNITS: PHOTO GALLERIES & ENTERPRISE SPECIFICATIONS
-- -----------------------------------------------------------------------------
ALTER TABLE public.units
    ADD COLUMN IF NOT EXISTS gallery_urls JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS floor_level TEXT,
    ADD COLUMN IF NOT EXISTS is_furnished BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS fixed_service_charge NUMERIC(10, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS amenities JSONB DEFAULT '[]'::jsonb;

-- -----------------------------------------------------------------------------
-- 3. PERFORMANCE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_unit_inventory_unit_id 
    ON public.unit_inventory(unit_id);

CREATE INDEX IF NOT EXISTS idx_units_gallery_urls 
    ON public.units USING gin(gallery_urls);

CREATE INDEX IF NOT EXISTS idx_units_property_floor 
    ON public.units(property_id, floor_level);

-- -----------------------------------------------------------------------------
-- 4. ENABLE ROW-LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.unit_inventory ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 5. RLS POLICIES FOR UNIT INVENTORY
-- -----------------------------------------------------------------------------

-- Agency staff can manage inventory for units belonging to their properties
DROP POLICY IF EXISTS "Agency staff can manage unit inventory" ON public.unit_inventory;
CREATE POLICY "Agency staff can manage unit inventory"
ON public.unit_inventory
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.units u
        JOIN public.properties p ON p.id = u.property_id
        JOIN public.profiles pr ON pr.agency_id = p.agency_id
        WHERE u.id = unit_inventory.unit_id
          AND pr.id = auth.uid()
          AND (pr.role IN ('agency_owner', 'super_admin') OR p.manager_id = auth.uid())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.units u
        JOIN public.properties p ON p.id = u.property_id
        JOIN public.profiles pr ON pr.agency_id = p.agency_id
        WHERE u.id = unit_inventory.unit_id
          AND pr.id = auth.uid()
          AND (pr.role IN ('agency_owner', 'super_admin') OR p.manager_id = auth.uid())
    )
);

-- Tenants can view inventory records for their active leased unit
DROP POLICY IF EXISTS "Tenants can view inventory for their unit" ON public.unit_inventory;
CREATE POLICY "Tenants can view inventory for their unit"
ON public.unit_inventory
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.leases l
        WHERE l.unit_id = unit_inventory.unit_id
          AND (
              l.tenant_id IN (
                  SELECT id FROM public.tenants WHERE user_id = auth.uid() OR id = auth.uid()
              ) OR l.tenant_id = auth.uid()
          )
          AND l.is_active = true
    )
);

