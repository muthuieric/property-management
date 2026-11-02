-- =============================================================================
-- MIGRATION: LEASE DOCUMENT URLS
-- Adds a document_url column to public.leases so signed lease agreement PDFs
-- can be stored and downloaded by tenants through the tenant portal.
-- Safe to re-run, non-destructive.
-- =============================================================================

ALTER TABLE public.leases
    ADD COLUMN IF NOT EXISTS document_url TEXT;

CREATE INDEX IF NOT EXISTS idx_leases_document_url ON public.leases(document_url) WHERE document_url IS NOT NULL;

-- RLS: tenants can read their own lease document URL (already covered by existing
-- "Tenants can view own leases" SELECT policy on public.leases)
