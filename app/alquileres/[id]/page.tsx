import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { markReceiptPaid, undoReceiptPayment } from '@/app/actions'
import { db } from '@/lib/db'
import { euroLabel } from '@/lib/crm'
import { RECEIPT_STATUSES, STATUS_BADGES, dateLabel, debt, longDateLabel, periodLabel, receiptStatus, today } from '@/lib/rentals'

type Params = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const lease = await db.lease.findUnique({ where: { id: Number((await params).id) }, include: { property: true } })

  return { title: lease?.property.title ?? 'Contrato' }
}

/**
 * Un contrato de alquiler con todos sus recibos, para anotar los cobros y abrir cada recibo
 * para imprimirlo o mandarlo.
 */
export default function LeasePage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<p className="text-slate-500">Cargando contrato…</p>}>
      <LeaseDetails params={params} />
    </Suspense>
  )
}

async function LeaseDetails({ params }: { params: Params }) {
  await connection()

  const lease = await db.lease.findUnique({
    where: { id: Number((await params).id) },
    include: { property: true, tenant: true, receipts: { orderBy: { period: 'desc' } } },
  })

  if (!lease) notFound()

  const on = today()
  const owed = debt(lease.receipts, on)

  return (
    <div>
      <Link href="/alquileres" className="text-sm text-slate-500 hover:text-teal-700">← Alquileres</Link>
      <h1 className="mt-2 text-2xl font-semibold">{lease.property.title}</h1>
      <p className="mt-1 text-slate-600">
        <span className="font-mono text-xs">{lease.property.reference}</span> · {lease.tenant.name} · del{' '}
        {longDateLabel(lease.startsOn)} al {longDateLabel(lease.endsOn)}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        {euroLabel(lease.monthlyRent)} al mes, que se pagan antes del día {lease.paymentDay} · Fianza de {euroLabel(lease.deposit)}
        {owed > 0 && <> · <span className="font-medium text-red-700">Debe {euroLabel(owed)}</span></>}
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Mes</th>
              <th className="px-4 py-3 text-right font-medium">Importe</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Vence</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Cobrado el</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lease.receipts.map((receipt) => {
              const status = receiptStatus(receipt, on)

              return (
                <tr key={receipt.id}>
                  <td className="px-4 py-3">{periodLabel(receipt.period)}</td>
                  <td className="px-4 py-3 text-right">{euroLabel(receipt.amount)}</td>
                  <td className="hidden px-4 py-3 md:table-cell">{dateLabel(receipt.dueOn)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGES[status]}`}>{RECEIPT_STATUSES[status]}</span>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">{receipt.paidOn && dateLabel(receipt.paidOn)}</td>
                  <td className="px-4 py-3 text-right">
                    {receipt.paidOn ? (
                      <div className="flex justify-end gap-3 text-xs">
                        <Link href={`/recibos/${receipt.id}`} target="_blank" className="text-teal-700 hover:underline">Ver recibo</Link>
                        <form action={undoReceiptPayment.bind(null, receipt.id)}>
                          <button className="text-slate-500 hover:underline">Deshacer el cobro</button>
                        </form>
                      </div>
                    ) : (
                      <form action={markReceiptPaid.bind(null, receipt.id)}>
                        <button className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">Marcar como cobrado</button>
                      </form>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
