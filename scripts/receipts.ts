import 'dotenv/config'
import { db } from '../lib/db'
import { issueMonthlyReceipts, remindOverdueTenants } from '../lib/receipts'
import { monthOf, periodLabel, today } from '../lib/rentals'

/**
 * Las dos tareas periódicas de los alquileres, para lanzarlas desde el cron:
 *
 *   npm run receipts:issue [-- 2026-12]   emite los recibos del mes
 *   npm run receipts:remind               avisa de los impagados
 */
async function main() {
  const [task, month = monthOf(today())] = process.argv.slice(2)

  if (task === 'issue') {
    console.log(`Recibos de ${periodLabel(month).toLowerCase()}: ${await issueMonthlyReceipts(month)} emitidos.`)
  } else if (task === 'remind') {
    console.log(`Avisos de impago enviados: ${await remindOverdueTenants()}.`)
  } else {
    console.error('Uso: tsx scripts/receipts.ts issue [AAAA-MM] | remind')
    process.exitCode = 1
  }
}

main().finally(() => db.$disconnect())
