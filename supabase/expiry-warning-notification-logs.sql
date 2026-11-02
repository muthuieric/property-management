-- =============================================================================
-- MIGRATION: EXPIRY WARNING NOTIFICATION LOGS
-- Tracks automated lease expiry warning emails/SMS sent to property managers
-- so the 180/90/30-day cron never double-sends for the same lease/window.
-- Safe to re-run, non-destructive.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    lease_id UUID NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    window_days INT NOT NULL CHECK (window_days IN (180, 90, 30)),
    channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms')),
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
    sent_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_lease_window ON public.notification_logs(lease_id, window_days);
CREATE INDEX IF NOT EXISTS idx_notification_logs_agency ON public.notification_logs(agency_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON public.notification_logs(sent_at);

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agency staff can view notification logs" ON public.notification_logs;
DROP POLICY IF EXISTS "Agency staff can manage notification logs" ON public.notification_logs;
CREATE POLICY "Agency staff can view notification logs"
    ON public.notification_logs FOR SELECT TO authenticated
    USING (agency_id = public.get_auth_agency_id());
CREATE POLICY "Agency staff can manage notification logs"
    ON public.notification_logs FOR ALL TO authenticated
    USING (agency_id = public.get_auth_agency_id() AND public.get_auth_role() = 'agency_owner')
    WITH CHECK (agency_id = public.get_auth_agency_id() AND public.get_auth_role() = 'agency_owner');

-- Service role can insert logs from cron
GRANT ALL ON public.notification_logs TO service_role;
