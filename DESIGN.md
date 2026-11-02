# DESIGN.md — Luffi Tech Property Management

> Canonical design + requirements document for the property-management SaaS.
> This file is the source of truth for scope. Implementation is tracked per
> milestone below; do not build anything not listed here without updating this
> doc first.

## 1. Current state (already built)

| Area | Status | Location |
|------|--------|----------|
| Next.js 16 App Router + Tailwind v4 | Built | `app/`, `next.config.ts`, `globals.css` |
| Supabase Auth (SSR + client) | Built | `utils/supabase/server.ts`, `@supabase/ssr` |
| Admin dashboard (owner + coordinator) | Built | `app/dashboard/` |
| Tenant portal (leases, receipts, maintenance, clearance) | Built | `app/portal/` |
| Properties / units / tenants / profiles / agencies | Built (Supabase) | `supabase/pre_leasing_crm_pipeline.sql`, `sequential_property_wizard.sql` |
| Leases (start/end date, deposit, digital signature) | Built | `supabase/digital_lease_signatures.sql` |
| Transactions ledger (income/expense, MPESA, receipt_id) | Built | `supabase/bulk_csv_payment_uploader.sql` |
| Invoices (base rent, utilities, total, status) | Built | `supabase/global_monthly_invoices.sql` |
| Utility meter readings | Built | `supabase/bulk_utility_meter_readings.sql` |
| TanStack Table v8 + react-virtual + Zustand | Just added | `app/components/data-table/`, `app/lib/store/dashboard-store.ts` |
| Income Schedules page (virtualized, sortable, filterable, paginated) | Just added | `app/dashboard/income-schedules/` |

### Existing schema notes (relevant to new work)
- `units`: `unit_number`, `base_rent`, `is_occupied`, `bedrooms`, `bathrooms`, `property_id` — **no square footage column**.
- `leases`: `start_date`, `end_date`, `deposit_amount`, `deposit_months`, `is_active`, `lease_status` — **no escalation percentage column**.
- `invoices`: `base_rent_amount`, `utilities_amount`, `total_amount`, `status`, `billing_month` — **no VAT column, no PIN/VAT company fields, no service-charge breakdown**.
- `transactions`: single-entry (type + amount) — **no double-entry debit/credit pairs**.
- `properties`: `currency` (default KES), `standard_base_rent`, `standard_water_rate` — **no company PIN/VAT number fields**.

---

## 2. Requirement map & gap analysis

### Domain 1 — Core Property & Lease Management

| # | Requirement | Existing? | Gap / what to add |
|---|-------------|-----------|-------------------|
| 1.1 | Database: properties, leasable units (incl. square footage), tenant profiles | Partial | `units` needs `square_footage` (NUMERIC). `properties`/`tenants` exist. |
| 1.2 | Lease contract: start date, base rent, annual escalation % | Partial | `leases` exists; add `escalation_percentage` NUMERIC. |
| 1.3 | Predictive dashboard: lease expiry tracking + alerts N months before end | Missing | New page + server action; query leases where `end_date` between now and now+N months; expiry alert widget. |

### Domain 2 — Financial Automation & Accounts

| # | Requirement | Existing? | Gap / what to add |
|---|-------------|-----------|-------------------|
| 2.1 | Double-entry accounting ledger per tenant (balances) | Partial | `transactions` is single-entry. Add `ledger_entries` table (debit/credit account pairs per transaction) OR compute tenant balance from `invoices` + `transactions`. |
| 2.2 | Automated billing engine: base rent + service charges (per sq ft) + 16% VAT | Partial | `invoices` exists but no VAT/service-charge logic. Add `vat_amount`, `service_charge_amount`, `service_charge_rate` to invoices; VAT fixed at 16%; billing engine function. |
| 2.3 | Debt control: 2% monthly interest on outstanding arrears | Missing | New table `arrears_interest`. 2% flat per month on outstanding arrears (non-compounding), applied by monthly cron job. |

### Domain 3 — Invoicing & Document Management

| # | Requirement | Existing? | Gap / what to add |
|---|-------------|-----------|-------------------|
| 3.1 | PDF generator: professional invoices with company PIN + VAT numbers; auto-email on schedule | Missing | PDF library (pdfkit / @react-pdf), company profile fields (`vat_pin`, `tax_pin`), email provider (Resend/SendGrid/SMSS), scheduled cron (Neon Functions / Vercel Cron). |
| 3.2 | Secure document management on Supabase Storage: signed leases, compliance certificates | Missing | Supabase Storage buckets (`leases`, `certificates`), RLS on objects, upload/download pages, link from lease/invoice records. |

### Domain 4 — Integrations & Portals

| # | Requirement | Existing? | Gap / what to add |
|---|-------------|-----------|-------------------|
| 4.1 | M-Pesa + direct bank real-time payment reconciliation | Partial | `transactions.payment_method` = 'MPESA' exists; needs webhook endpoint (`/api/mpesa`, `/api/bank`) to mark transactions `verified` + auto-create ledger entries. |
| 4.2 | Admin dashboard + Tenant portal | Built | Both exist (`app/dashboard`, `app/portal`). No new work unless new features added to them. |
| 4.3 | Bulk SMS + email: receipts + rent reminders | Missing | SMS provider (Africa's Talking / Twilio), email provider, notification service + templates, triggered on payment/invoice events. |

---

## 3. Database additions needed

Create a new migration `supabase/feature_spec_expansion.sql` containing:

```sql
-- units: square footage
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS square_footage NUMERIC(10, 2);

-- leases: annual escalation percentage
ALTER TABLE public.leases
  ADD COLUMN IF NOT EXISTS escalation_percentage NUMERIC(5, 2) DEFAULT 0.00;

-- invoices: VAT + service charge breakdown
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5, 2) DEFAULT 16.00,
  ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS service_charge_amount NUMERIC(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS service_charge_rate NUMERIC(10, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ;

-- companies / agency billing identity (PIN + VAT numbers)
CREATE TABLE IF NOT EXISTS public.agency_billing_identity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  company_name TEXT,
  vat_pin TEXT,
  tax_pin TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (agency_id)
);

-- double-entry ledger (per tenant balance)
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id),
  tenant_id UUID REFERENCES public.tenants(id),
  invoice_id UUID REFERENCES public.invoices(id),
  transaction_id UUID REFERENCES public.transactions(id),
  debit_account TEXT NOT NULL,
  credit_account TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- arrears interest accrual log
CREATE TABLE IF NOT EXISTS public.arrears_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  invoice_id UUID REFERENCES public.invoices(id),
  period_month DATE NOT NULL,
  interest_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  applied_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (invoice_id, period_month)
);
```

RLS policies mirror existing patterns (agency-scoped, owner/manager, tenant-own-data).

---

## 4. Integrations & environment variables needed

| Integration | Purpose | Env vars needed |
|-------------|---------|-----------------|
| PDF generation | Invoice PDFs | pdfkit (server-side), no client bundle |
| Email (Resend) | Invoice delivery, receipts, reminders | `RESEND_API_KEY`, `EMAIL_FROM` | Web UI: `/dashboard/notifications` |
| SMS (Africa's Talking) | Receipt SMS, rent reminders | `AFRICASTALKING_API_KEY`, `AFRICASTALKING_USERNAME`, `AFRICASTALKING_FROM` | Web UI: `/dashboard/notifications` |
| PayHero | M-Pesa / mobile money webhook (configured) | `PAYHERO_WEBHOOK_SECRET` | Webhook: `/api/payhero` |
| Direct bank | Bank statement parsing / webhook | CSV-upload based (`bulk_csv_payment_uploader.sql`); API/webhook later |
| Supabase Storage | Signed leases, certificates | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (already present) |
| Scheduled billing / interest | Monthly billing run + 2% interest | Cron provider (Neon Functions / Vercel Cron / GitHub Actions) |

---

## 5. Pages to build (admin dashboard + tenant portal)

**Admin dashboard** (`app/dashboard/`):
- `/dashboard/billing-engine` — run monthly billing (base rent + sq-ft service charge + 16% VAT), generate invoices
- `/dashboard/lease-expiry` — predictive dashboard, leases expiring within N months, alert management
- `/dashboard/ledger` — double-entry tenant ledger balances
- `/dashboard/debt-control` — arrears view, 2% monthly interest application
- `/dashboard/documents` — Supabase Storage browser (signed leases, certificates)
- `/dashboard/invoices/[id]/pdf` — download/regenerate invoice PDF
- `/dashboard/notifications` — bulk SMS/email compose + history

**Tenant portal** (`app/portal/`):
- `/portal/statements` — view ledger balance + unpaid invoices
- `/portal/invoices/[id]/pdf` — download invoice PDF
- `/portal/pay` — record/view payments (linked to M-Pesa/bank)

---

## 6. Implementation milestones (suggested order)

1. **M1 — Schema**: `feature_spec_expansion.sql` migration + RLS policies.
2. **M2 — Billing engine**: base rent + sq-ft service charge + 16% VAT on `invoices`; `/dashboard/billing-engine` page.
3. **M3 — Lease expiry dashboard**: `/dashboard/lease-expiry` + expiry alerts.
4. **M4 — PDF + documents**: invoice PDF generation, Supabase Storage buckets, `/dashboard/documents`, PDF download on invoices.
5. **M5 — Payments integration**: M-Pesa webhook endpoint marking transactions verified; direct-bank webhook (provider TBD).
6. **M6 — Notifications**: SMS + email receipts/reminders, triggered on payment/invoice events.
7. **M7 — Debt control**: 2% monthly interest accrual on arrears; `/dashboard/debt-control`.

---

## 7. Decisions (confirmed)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| PDF library | pdfkit (server) | Works in Next.js server actions/API routes; no client bundle cost; good for professional invoices |
| Email provider | Resend | Simple API, good deliverability, easy React email templates |
| SMS provider | Africa's Talking | Kenya/KES context, M-Pesa-adjacent, reliable SMS |
| Mobile money | PayHero (configured) | Webhook at `/api/payhero`; verifies signature, marks transactions verified, creates ledger entries, settles invoices |
| Direct bank | CSV-upload based | Already supported by `bulk_csv_payment_uploader.sql`; API/webhook later |
| VAT | Fixed 16% | Mandatory; stored as `vat_rate` default 16.00 on invoices |
| Interest | 2% flat / month on arrears | Non-compounding, tenant-predictable, simpler to audit |

## 8. Open questions / what I need from you

None — all integration and business-rule decisions are confirmed. Ready to implement.
