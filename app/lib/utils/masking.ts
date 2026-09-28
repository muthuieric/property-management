// app/lib/utils/masking.ts

/**
 * Enterprise PII Data Masking Utility.
 * Masks Kenyan and international phone numbers, keeping only the country/network prefix
 * and the last 3 digits visible while concealing the middle digits with asterisks (***).
 *
 * Examples:
 * - '+254 712 345 678' -> '+254 712 *** 678'
 * - '+254712345678'    -> '+254 712 *** 678'
 * - '0712345678'       -> '0712 *** 678'
 * - '0712 345 678'     -> '0712 *** 678'
 * - '+254 700 123 456' -> '+254 700 *** 456'
 */
export function maskPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return ''
  const trimmed = phone.trim()
  if (!trimmed) return ''

  // If already masked, avoid double masking
  if (trimmed.includes('*')) {
    return trimmed
  }

  // Extract all digits for structural inspection
  const digits = trimmed.replace(/\D/g, '')

  if (digits.length < 6) {
    return trimmed.length > 3
      ? `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`
      : '***'
  }

  // Standard Kenyan format starting with +254
  if (trimmed.startsWith('+254')) {
    const withoutCountryCode = trimmed.replace(/^\+254\s*/, '')
    const cleanDigits = withoutCountryCode.replace(/\D/g, '')

    if (cleanDigits.length >= 6) {
      const prefix = cleanDigits.slice(0, 3) // e.g. 712
      const suffix = cleanDigits.slice(-3) // e.g. 678
      return `+254 ${prefix} *** ${suffix}`
    }
    return `+254 *** ${cleanDigits.slice(-3)}`
  }

  // Kenyan format starting with 254 (without plus)
  if (trimmed.startsWith('254')) {
    const withoutCountryCode = trimmed.replace(/^254\s*/, '')
    const cleanDigits = withoutCountryCode.replace(/\D/g, '')

    if (cleanDigits.length >= 6) {
      const prefix = cleanDigits.slice(0, 3) // e.g. 712
      const suffix = cleanDigits.slice(-3) // e.g. 678
      return `+254 ${prefix} *** ${suffix}`
    }
    return `+254 *** ${cleanDigits.slice(-3)}`
  }

  // Local Kenyan format starting with 0 (e.g. 0712345678, 0110123456)
  if (trimmed.startsWith('0')) {
    const cleanDigits = digits
    if (cleanDigits.length >= 7) {
      const prefix = cleanDigits.slice(0, 4) // e.g. 0712
      const suffix = cleanDigits.slice(-3) // e.g. 678
      return `${prefix} *** ${suffix}`
    }
  }

  // Generic fallback for other country numbers
  const prefixLength = Math.max(3, Math.min(5, Math.floor(trimmed.length / 2.5)))
  const prefix = trimmed.slice(0, prefixLength)
  const suffix = trimmed.slice(-3)
  return `${prefix} *** ${suffix}`
}

