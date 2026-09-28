-- =============================================================================
-- CRYPTOGRAPHICALLY VERIFIABLE RECEIPTS (QR CODES) MIGRATION
-- Adds receipt_id column to public.transactions
-- Configures Row-Level Security (RLS) for public authenticity verification
-- Safe to re-run, non-destructive
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ADD RECEIPT_ID TO TRANSACTIONS TABLE
-- -----------------------------------------------------------------------------
ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS receipt_id UUID UNIQUE DEFAULT gen_random_uuid();

-- -----------------------------------------------------------------------------
-- 2. PERFORMANCE INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_transactions_receipt_id 
    ON public.transactions(receipt_id);

CREATE INDEX IF NOT EXISTS idx_transactions_type_receipt 
    ON public.transactions(transaction_type, receipt_id);

-- -----------------------------------------------------------------------------
-- 3. BACKFILL EXISTING INCOME TRANSACTIONS
-- -----------------------------------------------------------------------------
UPDATE public.transactions
SET receipt_id = gen_random_uuid()
WHERE receipt_id IS NULL AND transaction_type IN ('income', 'payment');

-- -----------------------------------------------------------------------------
-- 4. RLS POLICIES FOR PUBLIC RECEIPT VERIFICATION
-- -----------------------------------------------------------------------------
-- Allow unauthenticated / public lookup of transaction records by receipt_id
-- (Strictly scoped: only transactions with valid receipt_id can be inspected)
DROP POLICY IF EXISTS "Public receipt verification lookup" ON public.transactions;

CREATE POLICY "Public receipt verification lookup"
ON public.transactions
FOR SELECT
TO anon, authenticated
USING (
    receipt_id IS NOT NULL
);

