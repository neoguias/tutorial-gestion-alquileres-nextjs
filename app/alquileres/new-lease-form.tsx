'use client'

import { useActionState, useState } from 'react'
import { createLease, type FormState } from '@/app/actions'
import { FieldError } from '@/components/field-error'
import { legalDeposit } from '@/lib/rentals'

const input = 'mt-1 w-full rounded border border-slate-300 px-2 py-1.5'

type Props = {
  properties: { id: number; reference: string; title: string; type: string; price: number }[]
  contacts: { id: number; name: string }[]
}

/** El alta de un contrato. Al elegir el inmueble propone su renta y la fianza que marca la ley. */
export function NewLeaseForm({ properties, contacts }: Props) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState<FormState, FormData>(createLease, { errors: {} })
  const values = state.values ?? {}
  const [rent, setRent] = useState(values.monthlyRent ?? '')
  const [deposit, setDeposit] = useState(values.deposit ?? '')

  function chooseProperty(id: string) {
    const property = properties.find((p) => p.id === Number(id))
    if (property) {
      setRent(String(property.price))
      setDeposit(String(legalDeposit(property.type, property.price)))
    }
  }

  return (
    <>
      <button onClick={() => setOpen(!open)} className="rounded bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800">
        Nuevo contrato
      </button>

      {open && (
        <form action={action} className="order-last mt-2 grid w-full gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-3">
          <label className="text-sm">Inmueble
            <select name="propertyId" defaultValue={values.propertyId ?? ''} onChange={(e) => chooseProperty(e.target.value)} className={input}>
              <option value="">Elige uno</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.reference} · {p.title}</option>)}
            </select>
            <FieldError messages={state.errors.propertyId} />
          </label>
          <label className="text-sm">Inquilino
            <select name="contactId" defaultValue={values.contactId ?? ''} className={input}>
              <option value="">Elige uno</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <FieldError messages={state.errors.contactId} />
          </label>
          <label className="text-sm">Día de pago
            <input name="paymentDay" type="number" min={1} max={28} defaultValue={values.paymentDay ?? '7'} className={input} />
            <FieldError messages={state.errors.paymentDay} />
          </label>
          <label className="text-sm">Empieza el
            <input name="startsOn" type="date" defaultValue={values.startsOn} className={input} />
            <FieldError messages={state.errors.startsOn} />
          </label>
          <label className="text-sm">Termina el
            <input name="endsOn" type="date" defaultValue={values.endsOn} className={input} />
            <FieldError messages={state.errors.endsOn} />
          </label>
          <span />
          <label className="text-sm">Renta mensual (€)
            <input name="monthlyRent" type="number" value={rent} onChange={(e) => setRent(e.target.value)} className={input} />
            <FieldError messages={state.errors.monthlyRent} />
          </label>
          <label className="text-sm">Fianza (€)
            <input name="deposit" type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} className={input} />
            <FieldError messages={state.errors.deposit} />
          </label>
          <div className="sm:col-span-3">
            <button disabled={pending} className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60">
              {pending ? 'Guardando…' : 'Guardar contrato'}
            </button>
          </div>
        </form>
      )}
    </>
  )
}
