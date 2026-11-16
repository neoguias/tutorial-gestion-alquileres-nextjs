import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/lib/db'
import { sendMail } from '@/lib/mail'
import { issueMonthlyReceipts, issueReceipt, remindOverdueTenants } from '@/lib/receipts'
import { debt, dueDate, legalDeposit, receiptStatus, shouldRemind } from '@/lib/rentals'

// Los avisos no salen: comprobamos que se piden y con qué.
vi.mock('@/lib/mail', () => ({ sendMail: vi.fn() }))

const lease = { startsOn: '2026-01-01', endsOn: '2026-12-31', paymentDay: 7 }

describe('las reglas de los alquileres', () => {
  it('pone el vencimiento en el día de pago, o en el de la firma el primer mes', () => {
    expect(dueDate(lease, '2026-11')).toBe('2026-11-07')
    expect(dueDate({ ...lease, startsOn: '2026-11-20' }, '2026-11')).toBe('2026-11-20')
  })

  it('pide una mensualidad de fianza para vivienda y dos para un local', () => {
    expect(legalDeposit('flat', 900)).toBe(900)
    expect(legalDeposit('commercial', 1200)).toBe(2400)
  })

  it('da un recibo por impagado al día siguiente de vencer', () => {
    const receipt = { dueOn: '2026-11-07', paidOn: null, amount: 900 }

    expect(receiptStatus(receipt, '2026-11-07')).toBe('pending')
    expect(receiptStatus(receipt, '2026-11-08')).toBe('overdue')
    expect(receiptStatus({ ...receipt, paidOn: '2026-11-10' }, '2026-11-16')).toBe('paid')
    expect(debt([receipt, { ...receipt, dueOn: '2026-10-07' }], '2026-11-16')).toBe(1800)
  })

  it('vuelve a avisar de un impagado cuando ha pasado una semana', () => {
    const receipt = { dueOn: '2026-10-07', paidOn: null, remindedAt: new Date('2026-11-16T09:00') }

    expect(shouldRemind({ ...receipt, remindedAt: null }, new Date('2026-11-16T09:00'))).toBe(true)
    expect(shouldRemind(receipt, new Date('2026-11-20T09:00'))).toBe(false)
    expect(shouldRemind(receipt, new Date('2026-11-23T09:00'))).toBe(true)
  })
})

describe('los recibos', () => {
  async function createLease() {
    const property = await db.property.create({
      data: { reference: 'AT-1', title: 'Estudio de prueba', operation: 'rent', type: 'flat', zone: 'Ruzafa', price: 900, area: 45 },
    })
    const tenant = await db.contact.create({ data: { name: 'Ana Ruiz', email: 'ana@example.test' } })

    return db.lease.create({ data: { propertyId: property.id, contactId: tenant.id, monthlyRent: 900, deposit: 900, ...lease } })
  }

  beforeEach(async () => {
    vi.mocked(sendMail).mockClear()
    await db.receipt.deleteMany()
    await db.lease.deleteMany()
    await db.contact.deleteMany()
    await db.property.deleteMany()
  })

  it('se emiten una sola vez al mes y solo para los contratos en vigor', async () => {
    await createLease()

    expect(await issueMonthlyReceipts('2026-11')).toBe(1)
    expect(await issueMonthlyReceipts('2026-11')).toBe(0)
    expect(await issueMonthlyReceipts('2027-01')).toBe(0)
  })

  it('avisan al inquilino de lo que debe una vez por semana', async () => {
    const ana = await createLease()
    await issueReceipt(ana, '2026-10')
    const { receipt } = await issueReceipt(ana, '2026-11')
    await db.receipt.update({ where: { id: receipt.id }, data: { paidOn: '2026-11-05' } })

    expect(await remindOverdueTenants(new Date('2026-11-16T09:00'))).toBe(1)
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'ana@example.test', subject: 'Tienes un recibo de alquiler pendiente' }))

    expect(await remindOverdueTenants(new Date('2026-11-19T09:00'))).toBe(0)
    expect(await remindOverdueTenants(new Date('2026-11-23T09:00'))).toBe(1)
  })
})
