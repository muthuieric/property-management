-- =============================================================================
-- DELEGATION AUDIT TRAIL & ACCOUNTABILITY LOG
-- Fix: Automatic PostgreSQL Trigger, RLS Policies & Backfill for assignment_logs
-- Execute this script in your Supabase SQL Editor
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENSURE TABLE & COMPOSITE PERFORMANCE INDEXES EXIST
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assignment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    changed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    old_manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    new_manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignment_logs_agency_created 
    ON public.assignment_logs(agency_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_assignment_logs_property_id 
    ON public.assignment_logs(property_id);

CREATE INDEX IF NOT EXISTS idx_assignment_logs_changed_by 
    ON public.assignment_logs(changed_by);


-- -----------------------------------------------------------------------------
-- 2. ROW-LEVEL SECURITY (RLS) POLICIES
--    Guarantees authenticated users can query and record audit events.
-- -----------------------------------------------------------------------------
ALTER TABLE public.assignment_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assignment_logs_select_policy" ON public.assignment_logs;
CREATE POLICY "assignment_logs_select_policy" ON public.assignment_logs
    FOR SELECT
    TO authenticated
    USING (
        agency_id = public.get_auth_agency_id()
        AND (
            public.get_auth_role() = 'agency_owner'
            OR old_manager_id = auth.uid()
            OR new_manager_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "assignment_logs_insert_policy" ON public.assignment_logs;
CREATE POLICY "assignment_logs_insert_policy" ON public.assignment_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        agency_id = public.get_auth_agency_id()
    );


-- -----------------------------------------------------------------------------
-- 3. POSTGRESQL TRIGGER: AUTOMATIC MANAGER REASSIGNMENT AUDIT
--    Fires on every INSERT or UPDATE of manager_id on public.properties.
--    Works atomically across all mutations (Next.js forms, RPCs, direct SQL).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trig_log_property_delegation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_changed_by UUID;
BEGIN
    -- Only fire when manager_id is set on creation or actually changes on update
    IF (TG_OP = 'UPDATE' AND OLD.manager_id IS DISTINCT FROM NEW.manager_id)
       OR (TG_OP = 'INSERT' AND NEW.manager_id IS NOT NULL) THEN

        -- Identify the actor who performed the change:
        -- 1. auth.uid() from the authenticated session
        -- 2. Fallback to the primary Agency Owner for this agency
        -- 3. Fallback to the target manager profile
        v_changed_by := coalesce(
            auth.uid(),
            (SELECT id FROM public.profiles WHERE agency_id = NEW.agency_id AND role = 'agency_owner' LIMIT 1),
            NEW.manager_id,
            OLD.manager_id
        );

        IF v_changed_by IS NOT NULL THEN
            -- De-duplication check: prevent duplicate logs within 2 seconds
            IF NOT EXISTS (
                SELECT 1 FROM public.assignment_logs
                WHERE property_id = NEW.id
                  AND (new_manager_id IS NOT DISTINCT FROM NEW.manager_id)
                  AND created_at >= (now() - INTERVAL '2 seconds')
            ) THEN
                INSERT INTO public.assignment_logs (
                    agency_id,
                    property_id,
                    changed_by,
                    old_manager_id,
                    new_manager_id,
                    created_at
                ) VALUES (
                    NEW.agency_id,
                    NEW.id,
                    v_changed_by,
                    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.manager_id END,
                    NEW.manager_id,
                    now()
                );
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.trig_log_property_delegation() OWNER TO postgres;

DROP TRIGGER IF EXISTS tr_property_manager_assignment ON public.properties;
CREATE TRIGGER tr_property_manager_assignment
    AFTER INSERT OR UPDATE OF manager_id ON public.properties
    FOR EACH ROW
    EXECUTE FUNCTION public.trig_log_property_delegation();


-- -----------------------------------------------------------------------------
-- 4. RETROACTIVE BACKFILL (IDEMPOTENT)
--    Populates initial baseline log entries for properties that already have an
--    assigned manager but zero records in assignment_logs.
-- -----------------------------------------------------------------------------
INSERT INTO public.assignment_logs (agency_id, property_id, changed_by, old_manager_id, new_manager_id, created_at)
SELECT 
    p.agency_id,
    p.id,
    coalesce(
        (SELECT id FROM public.profiles WHERE agency_id = p.agency_id AND role = 'agency_owner' LIMIT 1),
        p.manager_id
    ),
    NULL,
    p.manager_id,
    now()
FROM public.properties p
WHERE p.manager_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.assignment_logs al WHERE al.property_id = p.id
  );

