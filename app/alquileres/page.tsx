import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { db } from '@/lib/db'
import { euroLabel } from '@/lib/crm'
import { RECEIPT_STATUSES, STATUS_BADGES, dateLabel, debt, monthOf, periodLabel, receiptStatus, today } from '@/lib/rentals'
import { NewLeaseForm } from './new-lease-form'

export const metadata: Metadata = { title: 'Alquileres' }

/**
 * Los contratos de alquiler de la agencia, con el estado del recibo de este mes y lo que
 * debe cada inquilino, y el alta de un contrato nuevo.
 */
export default function LeasesPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Cargando alquileres…</p>}>
      <Leases />
    </Suspense>
  )
}

async function Leases() {
  // «Hoy» depende del momento de la petición, no del de la compilación.
  await connection()

  const on = today()
  const month = monthOf(on)

  const [leases, properties, contacts] = await Promise.all([
    db.lease.findMany({ include: { property: true, tenant: true, receipts: true }, orderBy: { endsOn: 'asc' } }),
    db.property.findMany({ where: { operation: 'rent', status: 'available' }, orderBy: { reference: 'asc' } }),
    db.contact.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])

  const receipts = leases.flatMap((lease) => lease.receipts)
  const thisMonth = receipts.filter((receipt) => receipt.period === month)
  const overdue = receipts.filter((receipt) => receiptStatus(receipt, on) === 'overdue')
  const sum = (list: { amount: number }[]) => list.reduce((total, receipt) => total + receipt.amount, 0)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-semibold">Alquileres</h1>
        <NewLeaseForm properties={properties} contacts={contacts} />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Recibos de {periodLabel(month).toLowerCase()}</p>
          <p className="mt-1 text-2xl font-semibold">{euroLabel(sum(thisMonth))}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Cobrado este mes</p>
          <p className="mt-1 text-2xl font-semibold text-teal-700">{euroLabel(sum(thisMonth.filter((receipt) => receipt.paidOn)))}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Impagado ({overdue.length} {overdue.length === 1 ? 'recibo' : 'recibos'})</p>
          <p className={`mt-1 text-2xl font-semibold ${overdue.length ? 'text-red-700' : ''}`}>{euroLabel(sum(overdue))}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Inmueble</th>
              <th className="px-4 py-3 text-right font-medium">Renta</th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">Hasta</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Este mes</th>
              <th className="px-4 py-3 text-right font-medium">Debe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leases.map((lease) => {
              const current = lease.receipts.find((receipt) => receipt.period === month)
              const owed = debt(lease.receipts, on)

              return (
                <tr key={lease.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/alquileres/${lease.id}`} className="font-medium hover:text-teal-700">{lease.property.title}</Link>
                    <div className="text-xs text-slate-500">{lease.property.reference} · {lease.tenant.name}</div>
                  </td>
                  <td className="px-4 py-3 text-right">{euroLabel(lease.monthlyRent)}</td>
                  <td className="hidden px-4 py-3 lg:table-cell">{dateLabel(lease.endsOn)}</td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {current ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGES[receiptStatus(current, on)]}`}>{RECEIPT_STATUSES[receiptStatus(current, on)]}</span>
                    ) : (
                      <span className="text-xs text-slate-400">Sin recibo</span>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-right ${owed ? 'font-medium text-red-700' : 'text-slate-400'}`}>{euroLabel(owed)}</td>
                </tr>
              )
            })}
            {leases.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Todavía no hay contratos de alquiler.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
