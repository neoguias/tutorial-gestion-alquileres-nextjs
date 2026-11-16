import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { db } from '@/lib/db'
import { AGENCY, euroLabel } from '@/lib/crm'
import { longDateLabel, periodLabel } from '@/lib/rentals'
import { PrintButton } from './print-button'

export const metadata: Metadata = { title: 'Recibo de alquiler' }

type Params = Promise<{ id: string }>

/** El recibo listo para imprimir. Solo existe cuando se ha cobrado. */
export default function ReceiptPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<p className="text-slate-500">Cargando recibo…</p>}>
      <ReceiptSheet params={params} />
    </Suspense>
  )
}

async function ReceiptSheet({ params }: { params: Params }) {
  await connection()

  const receipt = await db.receipt.findUnique({
    where: { id: Number((await params).id) },
    include: { lease: { include: { property: true, tenant: true } } },
  })

  if (!receipt?.paidOn) notFound()

  const { lease } = receipt
  const number = `${receipt.period}-${String(receipt.id).padStart(5, '0')}`

  return (
    <article className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-10 print:border-0 print:p-0">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="font-semibold text-teal-700">{AGENCY}</p>
          <h1 className="mt-4 text-2xl font-semibold">Recibo de alquiler</h1>
          <p className="text-sm text-slate-500">Nº {number}</p>
        </div>
        <PrintButton />
      </div>

      <dl className="mt-8 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-slate-500">Inquilino</dt>
        <dd>{lease.tenant.name}</dd>
        <dt className="text-slate-500">Inmueble</dt>
        <dd>{lease.property.title} ({lease.property.reference}), {lease.property.zone}</dd>
        <dt className="text-slate-500">Periodo</dt>
        <dd>{periodLabel(receipt.period)}</dd>
        <dt className="text-slate-500">Cobrado el</dt>
        <dd>{longDateLabel(receipt.paidOn)}</dd>
      </dl>

      {/* Cada concepto en su línea y la renta en vigor aparte, como pide la ley. */}
      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2 font-medium">Concepto</th>
            <th className="py-2 text-right font-medium">Importe</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-100">
            <td className="py-2">Renta de {periodLabel(receipt.period).toLowerCase()}</td>
            <td className="py-2 text-right">{euroLabel(receipt.amount)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className="py-3">Total</td>
            <td className="py-3 text-right">{euroLabel(receipt.amount)}</td>
          </tr>
        </tfoot>
      </table>

      <p className="mt-6 text-xs text-slate-500">Renta mensual en vigor: {euroLabel(lease.monthlyRent)}.</p>
    </article>
  )
}
