'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { VISIT_OUTCOMES } from '@/lib/crm'
import { deletePhotoFile, savePhoto } from '@/lib/photos'
import { issueReceipt } from '@/lib/receipts'
import { isActiveIn, monthOf, today } from '@/lib/rentals'
import { contactSchema, fieldErrors, leaseSchema, photosSchema, propertySchema, statusSchema, visitSchema, type FieldErrors } from '@/lib/validation'

// Los valores vuelven con los errores: React vacía el formulario al terminar la acción y así
// el usuario no tiene que volver a escribirlo todo.
export type FormState = { errors: FieldErrors; values?: Record<string, string> }

export async function createProperty(_state: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries(formData) as Record<string, string>
  const parsed = propertySchema.safeParse(values)
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  if (await db.property.findUnique({ where: { reference: parsed.data.reference } })) {
    return { errors: { reference: ['Ya existe un inmueble con esa referencia.'] }, values }
  }

  const property = await db.property.create({ data: parsed.data })

  redirect(`/inmuebles/${property.id}`)
}

export async function updateStatus(propertyId: number, formData: FormData) {
  const status = statusSchema.parse(formData.get('status'))

  await db.property.update({ where: { id: propertyId }, data: { status } })

  refresh()
}

export async function scheduleVisit(propertyId: number, _state: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries(formData) as Record<string, string>
  const parsed = visitSchema.safeParse(values)
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  await db.visit.create({ data: { propertyId, ...parsed.data } })

  refresh()

  return { errors: {} }
}

export async function createContact(_state: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries(formData) as Record<string, string>
  const parsed = contactSchema.safeParse(values)
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  const { name, email, phone, ...demand } = parsed.data

  // El cliente y su demanda se crean juntos: si falla una, no queda la otra a medias.
  await db.contact.create({ data: { name, email, phone, demands: { create: demand } } })

  refresh()

  return { errors: {} }
}

export async function markVisit(visitId: number, outcome: keyof typeof VISIT_OUTCOMES) {
  if (!(outcome in VISIT_OUTCOMES)) {
    throw new Error('Resultado de visita desconocido.')
  }

  await db.visit.update({ where: { id: visitId }, data: { outcome } })

  refresh()
}

export async function addPhotos(propertyId: number, _state: FormState, formData: FormData): Promise<FormState> {
  const parsed = photosSchema.safeParse(formData.getAll('photos'))
  if (!parsed.success) {
    return { errors: { photos: [parsed.error.issues[0].message] } }
  }

  // Las fotos nuevas van detrás de las que ya tiene el inmueble.
  const last = await db.propertyPhoto.aggregate({ where: { propertyId }, _max: { position: true } })
  let position = last._max.position ?? 0

  for (const file of parsed.data) {
    const path = await savePhoto(propertyId, file)
    await db.propertyPhoto.create({ data: { propertyId, path, position: ++position } })
  }

  refresh()

  return { errors: {} }
}

export async function deletePhoto(photoId: number) {
  const photo = await db.propertyPhoto.delete({ where: { id: photoId } })
  await deletePhotoFile(photo.path)

  refresh()
}

export async function createLease(_state: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries(formData) as Record<string, string>
  const parsed = leaseSchema.safeParse(values)
  if (!parsed.success) {
    return { errors: fieldErrors(parsed.error), values }
  }

  const property = await db.property.findUnique({ where: { id: parsed.data.propertyId } })
  if (property?.operation !== 'rent') {
    return { errors: { propertyId: ['Elige un inmueble en alquiler.'] }, values }
  }

  // El contrato, el inmueble fuera de la cartera y el recibo de este mes, todo o nada.
  const lease = await db.$transaction(async (tx) => {
    const lease = await tx.lease.create({ data: parsed.data })
    await tx.property.update({ where: { id: property.id }, data: { status: 'closed' } })

    // El recibo de este mes no espera al día 1 del que viene.
    const month = monthOf(today())
    if (isActiveIn(lease, month)) {
      await issueReceipt(lease, month, tx)
    }

    return lease
  })

  redirect(`/alquileres/${lease.id}`)
}

export async function markReceiptPaid(receiptId: number) {
  await db.receipt.update({ where: { id: receiptId }, data: { paidOn: today() } })

  refresh()
}

export async function undoReceiptPayment(receiptId: number) {
  await db.receipt.update({ where: { id: receiptId }, data: { paidOn: null } })

  refresh()
}
