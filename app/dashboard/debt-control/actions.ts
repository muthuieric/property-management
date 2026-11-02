'use server'

import { applyMonthlyInterest, getArrearsSummary, type InterestResult } from '@/app/lib/debt-control'

export async function runInterestApplication({
  periodMonth,
}: {
  periodMonth: string
}): Promise<InterestResult> {
  return applyMonthlyInterest({ periodMonth })
}

export async function fetchArrearsSummary() {
  return getArrearsSummary()
}
