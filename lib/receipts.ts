import type { Lease, Prisma } from '@/app/generated/prisma/client'
import { db } from './db'
import { sendMail } from './mail'
import { addMonths, dueDate, monthOf, overdueEmail, shouldRemind, today } from './rentals'
import { dayKey } from './crm'

/**
 * El recibo de un mes. Si ya estaba emitido devuelve el que hay, así que emitir dos veces el
 * mismo mes no duplica nada. Acepta el cliente de una transacción.
 */
export async function issueReceipt(lease: Lease, month: string, client: Prisma.TransactionClient = db) {
  const existing = await client.receipt.findUnique({ where: { leaseId_period: { leaseId: lease.id, period: month } } })
  if (existing) {
    return { receipt: existing, created: false }
  }

  const receipt = await client.receipt.create({
    data: { leaseId: lease.id, period: month, amount: lease.monthlyRent, dueOn: dueDate(lease, month) },
  })

  return { receipt, created: true }
}

/** Emite el recibo del mes de cada contrato en vigor y devuelve cuántos son nuevos. */
export async function issueMonthlyReceipts(month = monthOf(today())): Promise<number> {
  // En vigor algún día del mes: empieza antes del día 1 del mes siguiente y termina el día 1
  // de este o después.
  const leases = await db.lease.findMany({
    where: { startsOn: { lt: `${addMonths(month, 1)}-01` }, endsOn: { gte: `${month}-01` } },
  })

  let issued = 0
  for (const lease of leases) {
    if ((await issueReceipt(lease, month)).created) issued++
  }

  return issued
}

/**
 * Manda un aviso por contrato con todos sus recibos impagados, si alguno está pendiente de
 * aviso y el inquilino tiene email. Devuelve cuántos avisos ha mandado.
 */
export async function remindOverdueTenants(now = new Date()): Promise<number> {
  const overdue = { paidOn: null, dueOn: { lt: dayKey(now) } }

  const leases = await db.lease.findMany({
    where: { tenant: { email: { not: null } }, receipts: { some: overdue } },
    include: { tenant: true, property: true, receipts: { where: overdue, orderBy: { period: 'desc' } } },
  })

  let sent = 0
  for (const lease of leases) {
    if (!lease.receipts.some((receipt) => shouldRemind(receipt, now))) continue

    await sendMail(overdueEmail(lease))
    await db.receipt.updateMany({ where: { id: { in: lease.receipts.map((receipt) => receipt.id) } }, data: { remindedAt: now } })
    sent++
  }

  return sent
}
