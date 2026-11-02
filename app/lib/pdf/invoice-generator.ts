import PDFDocument from 'pdfkit'
import { Buffer } from 'buffer'

export interface InvoicePdfData {
  invoiceId: string
  invoiceNumber: string
  isCreditNote?: boolean
  originalInvoiceNumber?: string
  creditReason?: string
  billingMonth: string
  tenantName: string
  unitNumber: string | null
  propertyName: string | null
  baseRent: number
  serviceChargeAmount: number
  escalationPercentage: number
  yearsElapsed: number
  escalatedBaseRent: number
  escalatedServiceCharge: number
  vatRate: number
  vatAmount: number
  interestPenalty: number
  totalAmount: number
  status: string
  companyName: string | null
  vatPin: string | null
  taxPin: string | null
  companyEmail: string | null
  companyPhone: string | null
  bankName: string | null
  bankAccountName: string | null
  bankAccountNumber: string | null
  bankBranch: string | null
  issuedAt: string
}

const KES_FORMAT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'KES',
  minimumFractionDigits: 2,
})

export function generateInvoicePdf(data: InvoicePdfData): Buffer {
  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))

  // ---------- Header ----------
  doc.fontSize(22).font('Helvetica-Bold').fillColor('#0F766E').text(data.companyName ?? 'LUFFI TECH PROPERTY MANAGEMENT', 50, 45)
  doc.fontSize(10).font('Helvetica').fillColor('#475569')
  const docType = data.isCreditNote ? 'CREDIT NOTE' : 'INVOICE'
  const docTypeColor = data.isCreditNote ? '#DC2626' : '#0F766E'
  doc.fontSize(14).font('Helvetica-Bold').fillColor(docTypeColor).text(docType, 50, 75, { align: 'right' })

  // Company info block (left)
  let y = 95
  doc.fontSize(9).fillColor('#134E4A').text('From:', 50, y)
  doc.font('Helvetica-Bold').text(data.companyName ?? 'Luffi Tech Property Management', 50, y + 10)
  doc.font('Helvetica')
  if (data.taxPin) {
    doc.text(`Tax PIN: ${data.taxPin}`, 50, y + 22)
  }
  if (data.vatPin) {
    doc.text(`VAT PIN: ${data.vatPin}`, 50, y + 34)
  }
  if (data.companyEmail) {
    doc.text(data.companyEmail, 50, y + 46)
  }
  if (data.companyPhone) {
    doc.text(data.companyPhone, 50, y + 58)
  }

  // Document meta block (right)
  const metaX = 380
  doc.fontSize(9).fillColor('#134E4A').text(`${docType} No:`, metaX, y)
  doc.font('Helvetica-Bold').text(data.invoiceNumber, metaX, y + 10)
  doc.font('Helvetica')
  if (data.isCreditNote && data.originalInvoiceNumber) {
    doc.text('Original Invoice:', metaX, y + 22)
    doc.text(data.originalInvoiceNumber, metaX, y + 34)
    doc.text('Reason:', metaX, y + 46)
    doc.text(data.creditReason ?? '', metaX, y + 58)
    doc.text('Issued:', metaX, y + 82)
  } else {
    doc.text('Billing Month:', metaX, y + 22)
    doc.text(data.billingMonth, metaX, y + 34)
    doc.text('Issued:', metaX, y + 46)
  }
  doc.text(new Date(data.issuedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }), metaX, data.isCreditNote ? y + 94 : y + 58)
  doc.text('Status:', metaX, data.isCreditNote ? y + 108 : y + 70)
  doc.text(data.status.charAt(0).toUpperCase() + data.status.slice(1), metaX, data.isCreditNote ? y + 120 : y + 82)

  // ---------- Tenant / Unit block ----------
  y += data.isCreditNote ? 150 : 110
  doc.strokeColor('#0F766E').lineWidth(1).moveTo(50, y).lineTo(550, y).stroke()
  y += 14
  doc.fontSize(9).fillColor('#134E4A').font('Helvetica-Bold').text('Bill To:', 50, y)
  doc.font('Helvetica')
  doc.text(data.tenantName, 50, y + 10)
  if (data.unitNumber) {
    doc.text(`Unit: ${data.unitNumber}`, 50, y + 22)
  }
  if (data.propertyName) {
    doc.text(`Property: ${data.propertyName}`, 50, y + 34)
  }

  // ---------- Line items table ----------
  y += 62
  const tableTop = y
  const colX = { item: 50, amount: 420 }

  doc.fontSize(9).fillColor('#134E4A').font('Helvetica-Bold')
  doc.text('Description', colX.item, tableTop)
  doc.text('Amount (KES)', colX.amount, tableTop, { align: 'right' })

  y += 14
  doc.strokeColor('#99F6E4').lineWidth(0.5).moveTo(50, y).lineTo(550, y).stroke()

  const rows: Array<{ label: string; value: number; show: boolean }> = [
    { label: 'Base Rent', value: data.escalatedBaseRent, show: true },
    { label: 'Service Charge', value: data.escalatedServiceCharge, show: data.escalatedServiceCharge > 0 },
    { label: `VAT (${data.vatRate}%)`, value: data.vatAmount, show: data.vatAmount > 0 },
    { label: 'Interest Penalty (2% p.m.)', value: data.interestPenalty, show: data.interestPenalty > 0 },
  ]

  for (const row of rows) {
    if (!row.show) continue
    y += 18
    doc.fontSize(9).fillColor('#475569').font('Helvetica').text(row.label, colX.item, y)
    doc.text(KES_FORMAT.format(row.value), colX.amount, y, { align: 'right' })
  }

  y += 18
  doc.strokeColor('#99F6E4').lineWidth(0.5).moveTo(50, y).lineTo(550, y).stroke()

  // ---------- Totals ----------
  const subtotal = data.escalatedBaseRent + data.escalatedServiceCharge
  y += 16
  doc.fontSize(10).fillColor('#134E4A').font('Helvetica-Bold').text('Subtotal:', 380, y)
  doc.text(KES_FORMAT.format(subtotal), 430, y, { align: 'right' })
  y += 16
  doc.text(`VAT (${data.vatRate}%):`, 380, y)
  doc.text(KES_FORMAT.format(data.vatAmount), 430, y, { align: 'right' })
  if (data.interestPenalty > 0) {
    y += 16
    doc.text('Interest Penalty (2% p.m.):', 380, y)
    doc.text(KES_FORMAT.format(data.interestPenalty), 430, y, { align: 'right' })
  }
  y += 16
  doc.fontSize(11).fillColor('#0F766E').text('TOTAL:', 380, y)
  doc.text(KES_FORMAT.format(data.totalAmount), 430, y, { align: 'right' })

  // ---------- Payment Instructions ----------
  y += 30
  doc.strokeColor('#0F766E').lineWidth(1).moveTo(50, y).lineTo(550, y).stroke()
  y += 14
  doc.fontSize(10).fillColor('#134E4A').font('Helvetica-Bold').text('Payment Instructions', 50, y)
  y += 14
  doc.fontSize(9).fillColor('#475569').font('Helvetica')
  doc.text('Pay via RTGS or Cheque to:', 50, y)
  y += 14
  doc.font('Helvetica-Bold').text('I&M Bank', 50, y)
  if (data.bankAccountName) {
    doc.text(`Account Name: ${data.bankAccountName}`, 50, y + 12)
  }
  if (data.bankAccountNumber) {
    doc.text(`Account Number: ${data.bankAccountNumber}`, 50, y + 24)
  }
  if (data.bankBranch) {
    doc.text(`Branch: ${data.bankBranch}`, 50, y + 36)
  }
  doc.font('Helvetica')
  doc.text('Please quote the Invoice Number as the payment reference.', 50, y + 50)

  // ---------- Footer ----------
  const pageHeight = doc.page.height
  doc.fontSize(8).fillColor('#94A3B8').font('Helvetica')
  const docTypeText = data.isCreditNote ? 'credit note' : 'invoice'
  doc.text(
    `Generated by Luffi Tech Property Management System. This is a computer-generated ${docTypeText} and does not require a manual signature.`,
    50,
    pageHeight - 60,
    { width: 500, align: 'center' }
  )
  doc.text(
    `VAT PIN: ${data.vatPin ?? 'N/A'}  |  Tax PIN: ${data.taxPin ?? 'N/A'}  |  Bank: I&M Bank`,
    50,
    pageHeight - 48,
    { width: 500, align: 'center' }
  )

  doc.end()

  const buffer = Buffer.concat(chunks)
  return buffer
}
