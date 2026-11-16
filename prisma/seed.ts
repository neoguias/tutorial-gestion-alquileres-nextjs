import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { db } from '../lib/db'
import { deleteAllPhotos, savePhoto } from '../lib/photos'
import { issueReceipt } from '../lib/receipts'
import { addMonths, legalDeposit, monthOf, today } from '../lib/rentals'

/**
 * Datos de ejemplo de Atalaya Inmobiliaria: una cartera pequeña de inmuebles, unos cuantos
 * clientes con lo que buscan y alguna visita, para tener algo que cruzar desde el principio.
 */
async function main() {
  await db.receipt.deleteMany()
  await db.lease.deleteMany()
  await db.visit.deleteMany()
  await db.demand.deleteMany()
  await db.contact.deleteMany()
  await db.property.deleteMany()
  await deleteAllPhotos()

  const properties: [string, string, string, string, string, number, number, number][] = [
    ['AT-101', 'Piso luminoso junto al mercado', 'sale', 'flat', 'Ruzafa', 289000, 3, 92],
    ['AT-102', 'Ático con terraza', 'sale', 'flat', 'El Carmen', 415000, 2, 78],
    ['AT-103', 'Piso para reformar', 'sale', 'flat', 'Benimaclet', 168000, 3, 85],
    ['AT-104', 'Casa de pueblo con patio', 'sale', 'house', 'Malvarrosa', 352000, 4, 140],
    ['AT-105', 'Estudio reformado', 'rent', 'flat', 'Ruzafa', 850, 1, 45],
    ['AT-106', 'Piso familiar con garaje', 'rent', 'flat', 'Campanar', 1250, 3, 110],
    ['AT-107', 'Local a pie de calle', 'rent', 'commercial', 'Patraix', 1100, 0, 120],
    ['AT-108', 'Piso exterior de cuatro dormitorios', 'sale', 'flat', 'Campanar', 325000, 4, 124],
    ['AT-109', 'Oficina con vistas', 'rent', 'office', 'El Carmen', 1450, 0, 95],
    ['AT-110', 'Bajo con jardín', 'sale', 'flat', 'Patraix', 239000, 2, 88],
  ]

  for (const [reference, title, operation, type, zone, price, bedrooms, area] of properties) {
    const property = await db.property.create({ data: { reference, title, operation, type, zone, price, bedrooms, area } })

    // Cada inmueble de ejemplo tiene su foto en prisma/photos.
    const photo = new File([await readFile(`prisma/photos/${reference}.jpg`)], `${reference}.jpg`, { type: 'image/jpeg' })
    await db.propertyPhoto.create({ data: { propertyId: property.id, path: await savePhoto(property.id, photo) } })
  }

  const lucia = await db.contact.create({
    data: { name: 'Lucía Ferrer', email: 'lucia@example.test', phone: '600 111 222', demands: { create: { operation: 'sale', type: 'flat', zone: 'Ruzafa', maxPrice: 300000, minBedrooms: 2 } } },
  })
  const marc = await db.contact.create({
    data: { name: 'Marc Soler', email: 'marc@example.test', demands: { create: { operation: 'sale', maxPrice: 340000, minBedrooms: 3, minArea: 100 } } },
  })
  await db.contact.create({
    data: { name: 'Ana Ruiz', email: 'ana@example.test', phone: '611 333 444', demands: { create: { operation: 'rent', type: 'flat', maxPrice: 1000 } } },
  })
  await db.contact.create({
    data: { name: 'Jorge Martí', email: 'jorge@example.test', notes: 'Tiene un negocio de cerámica y busca local.', demands: { create: { operation: 'rent', type: 'commercial', maxPrice: 1200, minArea: 80 } } },
  })
  await db.contact.create({
    data: { name: 'Elena Gil', email: 'elena@example.test', demands: { create: { operation: 'sale', zone: 'El Carmen', maxPrice: 450000 } } },
  })

  const at = (days: number, hours: number, minutes: number) => {
    const date = new Date()
    date.setDate(date.getDate() + days)
    date.setHours(hours, minutes, 0, 0)
    return date
  }

  await db.visit.create({ data: { propertyId: (await db.property.findUniqueOrThrow({ where: { reference: 'AT-101' } })).id, contactId: lucia.id, scheduledAt: at(1, 10, 30) } })
  await db.visit.create({ data: { propertyId: (await db.property.findUniqueOrThrow({ where: { reference: 'AT-108' } })).id, contactId: marc.id, scheduledAt: at(2, 17, 0) } })

  await seedRentals()
}

/**
 * Tres contratos de alquiler firmados hace unos meses, con sus recibos. Todos están al día
 * menos Jorge, que no ha pagado los dos últimos.
 */
async function seedRentals() {
  await db.contact.create({ data: { name: 'Clara Vidal', email: 'clara@example.test', notes: 'Arquitecta. Alquila la oficina para su estudio.' } })

  const leases: [string, string, number, number][] = [
    // Inmueble, inquilino, hace cuántos meses se firmó y para cuántos años.
    ['AT-105', 'Ana Ruiz', 8, 1],
    ['AT-107', 'Jorge Martí', 14, 5],
    ['AT-109', 'Clara Vidal', 3, 3],
  ]

  const thisMonth = monthOf(today())

  for (const [reference, name, monthsAgo, years] of leases) {
    const property = await db.property.findUniqueOrThrow({ where: { reference } })
    const tenant = await db.contact.findFirstOrThrow({ where: { name } })
    const first = addMonths(thisMonth, -monthsAgo)

    // Termina el último día del mes anterior al aniversario: el día 1 de ese mes menos uno.
    const end = new Date(`${addMonths(first, years * 12)}-01T00:00:00Z`)
    end.setUTCDate(0)

    const lease = await db.lease.create({
      data: {
        propertyId: property.id,
        contactId: tenant.id,
        startsOn: `${first}-01`,
        endsOn: end.toISOString().slice(0, 10),
        monthlyRent: property.price,
        deposit: legalDeposit(property.type, property.price),
      },
    })
    await db.property.update({ where: { id: property.id }, data: { status: 'closed' } })

    for (let month = first; month <= thisMonth; month = addMonths(month, 1)) {
      const { receipt } = await issueReceipt(lease, month)
      const unpaid = reference === 'AT-107' && month >= addMonths(thisMonth, -1)

      // Los demás se cobran unos días antes de vencer, si ya ha llegado ese día.
      if (!unpaid && receipt.dueOn <= today()) {
        const day = Number(receipt.dueOn.slice(8)) - ((Number(month.slice(5)) + lease.id) % 4)
        await db.receipt.update({ where: { id: receipt.id }, data: { paidOn: `${month}-${String(day).padStart(2, '0')}` } })
      }
    }
  }
}

main().finally(() => db.$disconnect())
