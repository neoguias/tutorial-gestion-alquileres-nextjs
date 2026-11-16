import { AGENCY, dayKey, euroLabel } from './crm'

export const RECEIPT_STATUSES = { pending: 'Pendiente', overdue: 'Impagado', paid: 'Cobrado' } as const

export type ReceiptStatus = keyof typeof RECEIPT_STATUSES

// Las clases de la etiqueta de color de cada estado.
export const STATUS_BADGES: Record<ReceiptStatus, string> = {
  pending: 'bg-amber-50 text-amber-800',
  overdue: 'bg-red-50 text-red-700',
  paid: 'bg-teal-50 text-teal-800',
}

type LeaseDates = { startsOn: string; endsOn: string; paymentDay: number }
type ReceiptDates = { dueOn: string; paidOn: string | null; remindedAt?: Date | null }

/** El día de hoy en la agencia, como 2026-11-16. */
export function today(): string {
  return dayKey(new Date())
}

/** El mes de una fecha, como 2026-11. */
export function monthOf(date: string): string {
  return date.slice(0, 7)
}

/** El mes que cae n meses después de otro: addMonths('2026-11', 2) es '2027-01'. */
export function addMonths(month: string, n: number): string {
  const [year, number] = month.split('-').map(Number)

  return new Date(Date.UTC(year, number - 1 + n, 1)).toISOString().slice(0, 7)
}

/** Si el contrato está en vigor algún día de ese mes. */
export function isActiveIn(lease: LeaseDates, month: string): boolean {
  return monthOf(lease.startsOn) <= month && monthOf(lease.endsOn) >= month
}

/**
 * La fianza que exige la Ley de Arrendamientos Urbanos: una mensualidad si se alquila como
 * vivienda y dos para cualquier otro uso.
 */
export function legalDeposit(type: string, rent: number): number {
  return rent * (type === 'flat' || type === 'house' ? 1 : 2)
}

/**
 * El día en que vence el recibo de un mes: el día de pago pactado o, el primer mes, el de la
 * firma si es posterior.
 */
export function dueDate(lease: LeaseDates, month: string): string {
  const due = `${month}-${String(lease.paymentDay).padStart(2, '0')}`

  return due < lease.startsOn ? lease.startsOn : due
}

export function receiptStatus(receipt: ReceiptDates, on = today()): ReceiptStatus {
  if (receipt.paidOn) return 'paid'

  return receipt.dueOn < on ? 'overdue' : 'pending'
}

/** Lo que debe un inquilino: la suma de los recibos que han vencido sin cobrarse. */
export function debt(receipts: (ReceiptDates & { amount: number })[], on = today()): number {
  return receipts.filter((receipt) => receiptStatus(receipt, on) === 'overdue').reduce((sum, receipt) => sum + receipt.amount, 0)
}

const WEEK = 7 * 24 * 60 * 60 * 1000

/** Si toca avisar de un recibo: está impagado y nunca se ha avisado, o hace una semana o más. */
export function shouldRemind(receipt: ReceiptDates, now = new Date()): boolean {
  return receiptStatus(receipt, dayKey(now)) === 'overdue'
    && (!receipt.remindedAt || now.getTime() - receipt.remindedAt.getTime() >= WEEK)
}

/** «Noviembre de 2026». */
export function periodLabel(month: string): string {
  const text = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))

  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** 07/11/2026. */
export function dateLabel(date: string): string {
  return date.split('-').reverse().join('/')
}

/** 7 de noviembre de 2026. */
export function longDateLabel(date: string): string {
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}

type OverdueLease = {
  tenant: { name: string; email: string | null }
  property: { title: string }
  receipts: { period: string; amount: number; dueOn: string }[]
}

/** El aviso de impago de un contrato, con cada recibo pendiente y el total. */
export function overdueEmail(lease: OverdueLease) {
  const total = lease.receipts.reduce((sum, receipt) => sum + receipt.amount, 0)
  const lines = lease.receipts.map((receipt) => `- ${periodLabel(receipt.period)}: ${euroLabel(receipt.amount)}, que vencía el ${dateLabel(receipt.dueOn)}.`)

  return {
    to: lease.tenant.email ?? '',
    subject: lease.receipts.length > 1 ? 'Tienes recibos de alquiler pendientes' : 'Tienes un recibo de alquiler pendiente',
    text: [
      `Hola, ${lease.tenant.name}:`,
      '',
      `No nos consta el pago de estos recibos de ${lease.property.title}:`,
      '',
      ...lines,
      '',
      `En total, ${euroLabel(total)}. Si ya lo has pagado, no hagas caso de este mensaje y disculpa la molestia.`,
      '',
      'Un saludo,',
      AGENCY,
    ].join('\n'),
  }
}
