-- =============================================================================
-- ENTERPRISE HARDENING & ROW-LEVEL SECURITY (RLS) POLICIES
-- B2B Property Management SaaS
-- =============================================================================

-- 0. USER SUSPENSION & ACTIVE STATUS COLUMNS
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;

-- 1. AUDIT LOGGING TABLE: assignment_logs
-- Tracks property delegation changes to guarantee SLA and operational accountability.
CREATE TABLE IF NOT EXISTS public.assignment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    changed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    old_manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    new_manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying audit logs by agency & time
CREATE INDEX IF NOT EXISTS idx_assignment_logs_agency_created 
    ON public.assignment_logs(agency_id, created_at DESC);


-- 2. COMPOSITE PERFORMANCE INDEXES
-- Optimizes queries for executive metrics and coordinator action centers.

-- Transactions: Filter by agency, transaction type, and date
CREATE INDEX IF NOT EXISTS idx_transactions_agency_type_date 
    ON public.transactions(agency_id, transaction_type, transaction_date DESC);

-- Leases: Fast active lease lookup per agency
CREATE INDEX IF NOT EXISTS idx_leases_agency_active 
    ON public.leases(agency_id, is_active);

-- Maintenance Tickets: Fast SLA breach calculation by status and creation time
CREATE INDEX IF NOT EXISTS idx_tickets_agency_status_created 
    ON public.maintenance_tickets(agency_id, status, created_at DESC);

-- Properties: Fast manager scoping per agency
CREATE INDEX IF NOT EXISTS idx_properties_agency_manager 
    ON public.properties(agency_id, manager_id);


-- 3. ROW-LEVEL SECURITY (RLS) HELPER FUNCTIONS
-- Securely extract caller's agency and role from auth.uid() without recursion.

CREATE OR REPLACE FUNCTION public.get_auth_agency_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT agency_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;


-- 4. ROW-LEVEL SECURITY POLICIES

-- ============================================================================
-- TABLE: properties
-- ============================================================================
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Agency Owners: Full access within their agency
DROP POLICY IF EXISTS "Agency owners full access to properties" ON public.properties;
CREATE POLICY "Agency owners full access to properties" ON public.properties
    FOR ALL
    TO authenticated
    USING (
        agency_id = public.get_auth_agency_id() 
        AND public.get_auth_role() = 'agency_owner'
    )
    WITH CHECK (
        agency_id = public.get_auth_agency_id() 
        AND public.get_auth_role() = 'agency_owner'
    );

-- Property Coordinators: Access ONLY assigned properties
DROP POLICY IF EXISTS "Coordinators access assigned properties" ON public.properties;
CREATE POLICY "Coordinators access assigned properties" ON public.properties
    FOR SELECT
    TO authenticated
    USING (
        agency_id = public.get_auth_agency_id() 
        AND (manager_id = auth.uid() OR public.get_auth_role() = 'agency_owner')
    );

-- ============================================================================
-- TABLE: maintenance_tickets
-- ============================================================================
ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;

-- Agency Owners: Full visibility
DROP POLICY IF EXISTS "Agency owners full access to tickets" ON public.maintenance_tickets;
CREATE POLICY "Agency owners full access to tickets" ON public.maintenance_tickets
    FOR ALL
    TO authenticated
    USING (
        agency_id = public.get_auth_agency_id() 
        AND public.get_auth_role() = 'agency_owner'
    )
    WITH CHECK (
        agency_id = public.get_auth_agency_id() 
        AND public.get_auth_role() = 'agency_owner'
    );

-- Property Coordinators: Access tickets for their assigned units/properties
DROP POLICY IF EXISTS "Coordinators access assigned property tickets" ON public.maintenance_tickets;
CREATE POLICY "Coordinators access assigned property tickets" ON public.maintenance_tickets
    FOR ALL
    TO authenticated
    USING (
        agency_id = public.get_auth_agency_id()
        AND (
            public.get_auth_role() = 'agency_owner'
            OR unit_id IN (
                SELECT u.id FROM public.units u
                JOIN public.properties p ON u.property_id = p.id
                WHERE p.manager_id = auth.uid()
            )
        )
    )
    WITH CHECK (
        agency_id = public.get_auth_agency_id()
        AND (
            public.get_auth_role() = 'agency_owner'
            OR unit_id IN (
                SELECT u.id FROM public.units u
                JOIN public.properties p ON u.property_id = p.id
                WHERE p.manager_id = auth.uid()
            )
        )
    );

-- ============================================================================
-- TABLE: transactions (Tenant Ledgers & Utility Expenses)
-- ============================================================================
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Agency Owners: Full visibility across all agency transactions
DROP POLICY IF EXISTS "Agency owners full access to transactions" ON public.transactions;
CREATE POLICY "Agency owners full access to transactions" ON public.transactions
    FOR ALL
    TO authenticated
    USING (
        agency_id = public.get_auth_agency_id()
        AND public.get_auth_role() = 'agency_owner'
    )
    WITH CHECK (
        agency_id = public.get_auth_agency_id()
        AND public.get_auth_role() = 'agency_owner'
    );

-- Property Coordinators: Read/Insert transactions for their assigned properties
DROP POLICY IF EXISTS "Coordinators access assigned property transactions" ON public.transactions;
CREATE POLICY "Coordinators access assigned property transactions" ON public.transactions
    FOR SELECT
    TO authenticated
    USING (
        agency_id = public.get_auth_agency_id()
        AND (
            public.get_auth_role() = 'agency_owner'
            OR property_id IN (
                SELECT id FROM public.properties WHERE manager_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Coordinators insert assigned property transactions" ON public.transactions;
CREATE POLICY "Coordinators insert assigned property transactions" ON public.transactions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        agency_id = public.get_auth_agency_id()
        AND (
            public.get_auth_role() = 'agency_owner'
            OR property_id IN (
                SELECT id FROM public.properties WHERE manager_id = auth.uid()
            )
        )
    );


-- 5. ATOMIC RPC: assign_properties_to_manager
-- Enforces double-sided tenancy verification, atomicity, and audit logging in a single ACID transaction.

CREATE OR REPLACE FUNCTION public.assign_properties_to_manager(
    p_agency_id UUID,
    p_manager_id UUID,
    p_property_ids UUID[],
    p_changed_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_manager_role TEXT;
    v_manager_agency UUID;
    v_invalid_props INT;
    v_prop RECORD;
BEGIN
    -- 1. Double-Sided Tenancy Check: Target Manager
    SELECT agency_id, role INTO v_manager_agency, v_manager_role
    FROM public.profiles
    WHERE id = p_manager_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target manager does not exist';
    END IF;

    IF v_manager_agency != p_agency_id OR v_manager_role != 'property_manager' THEN
        RAISE EXCEPTION 'Unauthorized: Target user does not belong to agency % or is not a property coordinator', p_agency_id;
    END IF;

    -- 2. Double-Sided Tenancy Check: Properties
    IF p_property_ids IS NOT NULL AND array_length(p_property_ids, 1) > 0 THEN
        SELECT COUNT(*) INTO v_invalid_props
        FROM unnest(p_property_ids) AS pid
        WHERE pid NOT IN (
            SELECT id FROM public.properties WHERE agency_id = p_agency_id
        );

        IF v_invalid_props > 0 THEN
            RAISE EXCEPTION 'Unauthorized: One or more properties do not belong to agency %', p_agency_id;
        END IF;
    END IF;

    -- 3. Audit & Disassociate properties previously assigned to this manager not in the new list
    FOR v_prop IN 
        SELECT id, manager_id FROM public.properties
        WHERE agency_id = p_agency_id 
          AND manager_id = p_manager_id
          AND (p_property_ids IS NULL OR id != ALL(p_property_ids))
    LOOP
        INSERT INTO public.assignment_logs (agency_id, changed_by, property_id, old_manager_id, new_manager_id)
        VALUES (p_agency_id, p_changed_by, v_prop.id, v_prop.manager_id, NULL);
    END LOOP;

    UPDATE public.properties
    SET manager_id = NULL
    WHERE agency_id = p_agency_id
      AND manager_id = p_manager_id
      AND (p_property_ids IS NULL OR id != ALL(p_property_ids));

    -- 4. Audit & Assign selected properties
    IF p_property_ids IS NOT NULL AND array_length(p_property_ids, 1) > 0 THEN
        FOR v_prop IN 
            SELECT id, manager_id FROM public.properties
            WHERE agency_id = p_agency_id 
              AND id = ANY(p_property_ids)
              AND (manager_id IS DISTINCT FROM p_manager_id)
        LOOP
            INSERT INTO public.assignment_logs (agency_id, changed_by, property_id, old_manager_id, new_manager_id)
            VALUES (p_agency_id, p_changed_by, v_prop.id, v_prop.manager_id, p_manager_id);
        END LOOP;

        UPDATE public.properties
        SET manager_id = p_manager_id
        WHERE agency_id = p_agency_id
          AND id = ANY(p_property_ids);
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'manager_id', p_manager_id,
        'assigned_count', coalesce(array_length(p_property_ids, 1), 0)
    );
END;
$$;


-- 6. DATABASE AGGREGATION RPC: get_agency_executive_metrics
-- Computes high-level macro financials directly in PostgreSQL to prevent Node.js memory bloat.

CREATE OR REPLACE FUNCTION public.get_agency_executive_metrics(p_agency_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_mtd_revenue NUMERIC(12, 2) := 0;
    v_total_arrears NUMERIC(12, 2) := 0;
    v_deposits_in_trust NUMERIC(12, 2) := 0;
    v_total_units INT := 0;
    v_occupied_units INT := 0;
    v_total_sites INT := 0;
    v_unassigned_sites INT := 0;
    v_unassigned_tickets INT := 0;
    v_unassigned_arrears NUMERIC(12, 2) := 0;
    v_sla_breaches INT := 0;
BEGIN
    -- 1. Sites counts
    SELECT COUNT(*), COUNT(*) FILTER (WHERE manager_id IS NULL)
    INTO v_total_sites, v_unassigned_sites
    FROM public.properties
    WHERE agency_id = p_agency_id;

    -- 2. Units counts & occupancy
    SELECT COUNT(*), COUNT(*) FILTER (WHERE is_occupied = true)
    INTO v_total_units, v_occupied_units
    FROM public.units u
    JOIN public.properties p ON u.property_id = p.id
    WHERE p.agency_id = p_agency_id;

    -- 3. Deposits in trust from active leases
    SELECT coalesce(SUM(deposit_amount), 0)
    INTO v_deposits_in_trust
    FROM public.leases
    WHERE agency_id = p_agency_id AND is_active = true;

    -- 4. MTD Revenue (income/payment transactions in current calendar month)
    SELECT coalesce(SUM(amount), 0)
    INTO v_mtd_revenue
    FROM public.transactions
    WHERE agency_id = p_agency_id
      AND transaction_type IN ('income', 'payment')
      AND transaction_date >= date_trunc('month', CURRENT_DATE)::date;

    -- 5. Global Arrears & Unassigned Site Arrears
    WITH tenant_totals AS (
        SELECT 
            t.tenant_id,
            t.property_id,
            p.manager_id,
            coalesce(SUM(CASE WHEN t.transaction_type IN ('expense', 'deduction', 'repair_cost') THEN t.amount ELSE 0 END), 0) AS debits,
            coalesce(SUM(CASE WHEN t.transaction_type IN ('income', 'payment') THEN t.amount ELSE 0 END), 0) AS credits
        FROM public.transactions t
        LEFT JOIN public.properties p ON t.property_id = p.id
        WHERE t.agency_id = p_agency_id AND t.tenant_id IS NOT NULL
        GROUP BY t.tenant_id, t.property_id, p.manager_id
    )
    SELECT 
        coalesce(SUM(GREATEST(0, debits - credits)), 0),
        coalesce(SUM(CASE WHEN manager_id IS NULL THEN GREATEST(0, debits - credits) ELSE 0 END), 0)
    INTO v_total_arrears, v_unassigned_arrears
    FROM tenant_totals;

    -- 6. Open Maintenance Tickets & 48h SLA breaches
    SELECT 
        COUNT(*) FILTER (WHERE (now() - created_at) >= INTERVAL '48 hours'),
        COUNT(*) FILTER (WHERE p.manager_id IS NULL)
    INTO v_sla_breaches, v_unassigned_tickets
    FROM public.maintenance_tickets mt
    JOIN public.units u ON mt.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE mt.agency_id = p_agency_id AND mt.status != 'Resolved';

    RETURN jsonb_build_object(
        'total_sites', v_total_sites,
        'unassigned_sites', v_unassigned_sites,
        'total_units', v_total_units,
        'occupied_units', v_occupied_units,
        'occupancy_rate', CASE WHEN v_total_units > 0 THEN round((v_occupied_units::numeric / v_total_units::numeric) * 100) ELSE 0 END,
        'deposits_in_trust', v_deposits_in_trust,
        'mtd_revenue', v_mtd_revenue,
        'total_arrears', v_total_arrears,
        'sla_breaches', v_sla_breaches,
        'unassigned_tickets', v_unassigned_tickets,
        'unassigned_arrears', v_unassigned_arrears
    );
END;
$$;


-- ============================================================================
-- 8. LEASE RENEWALS & EXPIRIES (COORDINATOR WORKFLOW)
-- ============================================================================
-- Allows coordinators to track expiration pipeline ('active', 'pending_renewal', 'renewed', 'vacating')
ALTER TABLE public.leases 
    ADD COLUMN IF NOT EXISTS renewal_status TEXT DEFAULT 'active' 
    CHECK (renewal_status IN ('active', 'pending_renewal', 'renewed', 'vacating'));

-- Fast lookup for leases nearing expiry within an agency
CREATE INDEX IF NOT EXISTS idx_leases_agency_active_end_date 
    ON public.leases(agency_id, is_active, end_date);

