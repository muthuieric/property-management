// app/dashboard/leases/new/page.tsx
import { redirect } from 'next/navigation'

export default async function NewLeasePage({
  searchParams,
}: {
  searchParams: Promise<{ tenant_id?: string; unit_id?: string }>
}) {
  const resolvedParams = await searchParams
  if (resolvedParams.unit_id) {
    redirect('/dashboard/properties')
  }
  redirect('/dashboard/tenants')
}
