# Gestión de alquileres en un CRM inmobiliario con Next.js

El CRM inmobiliario de Atalaya Inmobiliaria, una agencia inventada de Valencia, con un módulo nuevo para llevar los alquileres. Guarda los contratos con su renta, su fianza y su día de pago, emite un recibo cada mes, anota los cobros, imprime los recibos cobrados y avisa por email a los inquilinos que tienen recibos vencidos sin pagar.

Está hecho con Next.js 16, Prisma 7 sobre SQLite, Zod y nodemailer, sobre el CRM del tutorial anterior.

El tutorial completo está en Neoguias: [Cómo gestionar alquileres en un CRM inmobiliario con Next.js](https://www.neoguias.com/gestionar-alquileres-nextjs/). Hay una versión con Laravel y Livewire en [este otro repositorio](https://github.com/neoguias/tutorial-gestion-alquileres-laravel).

Los tutoriales anteriores de la serie:

- [Cómo crear un CRM inmobiliario con Next.js](https://www.neoguias.com/crear-crm-inmobiliario-nextjs/), con [su repositorio](https://github.com/neoguias/tutorial-crm-inmobiliario-nextjs).
- [Cómo crear un portal inmobiliario como Idealista con Next.js](https://www.neoguias.com/crear-portal-inmobiliario-nextjs/), con [su repositorio](https://github.com/neoguias/tutorial-portal-inmobiliario-nextjs).
- [Cómo valorar un piso por comparables en un CRM inmobiliario con Next.js](https://www.neoguias.com/valorar-inmuebles-comparables-nextjs/), con [su repositorio](https://github.com/neoguias/tutorial-valoracion-inmobiliaria-nextjs).

## Cómo arrancarlo

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Abre `http://localhost:3000`. El seed carga diez inmuebles con una foto cada uno, seis clientes, dos visitas y tres contratos de alquiler firmados hace unos meses con todos sus recibos. Uno de los inquilinos debe los dos últimos. Los alquileres están en `http://localhost:3000/alquileres`. Las fotos de ejemplo están generadas con IA y son de uso libre.

Las dos tareas periódicas, emitir los recibos del mes y avisar de los impagados, son un script que se lanza desde el cron del servidor:

```bash
npm run receipts:issue
npm run receipts:remind
```

Por ejemplo, con estas dos líneas en el `crontab` los recibos se emiten el día 1 a las ocho y los avisos salen cada día a las nueve:

```
0 8 1 * * cd /ruta/al/proyecto && npm run receipts:issue
0 9 * * * cd /ruta/al/proyecto && npm run receipts:remind
```

Sin `SMTP_URL` en el `.env`, los emails no se envían y se muestran por consola. Con ella, por ejemplo `SMTP_URL="smtps://usuario:clave@smtp.example.com"`, salen de verdad.

Los tests usan su propia base de datos SQLite, `test.db`, que se crea de cero en cada ejecución:

```bash
npm test
```

Requiere Node 22 o superior.

## Dónde está cada cosa

- [`prisma/schema.prisma`](prisma/schema.prisma): las tablas de inmuebles, clientes, demandas, visitas, contratos y recibos.
- [`lib/rentals.ts`](lib/rentals.ts): las reglas de los alquileres en funciones puras, que son la fianza que marca la ley, el vencimiento y el estado de cada recibo, lo que se debe, cuándo toca avisar y el texto del aviso.
- [`lib/receipts.ts`](lib/receipts.ts): la emisión de los recibos y los avisos de impago, contra la base de datos.
- [`lib/mail.ts`](lib/mail.ts) y [`scripts/receipts.ts`](scripts/receipts.ts): el envío de emails con nodemailer y el script que lanza el cron.
- [`lib/matching.ts`](lib/matching.ts): el cruce, en un sentido y en el otro, como condiciones de Prisma.
- [`lib/crm.ts`](lib/crm.ts): la agencia, sus zonas, los textos en español de cada valor y el formato de precios y fechas.
- [`lib/validation.ts`](lib/validation.ts): los esquemas de Zod de los formularios.
- [`app/actions.ts`](app/actions.ts): las Server Actions que guardan inmuebles, clientes, visitas, estados, contratos y cobros.
- [`lib/photos.ts`](lib/photos.ts) y [`app/fotos`](app/fotos): las fotos se guardan en `storage/photos` y las sirve un Route Handler, porque Next.js no sirve lo que se añade a `public` después de compilar.
- [`app/inmuebles`](app/inmuebles), [`app/clientes`](app/clientes), [`app/visitas`](app/visitas) y [`app/alquileres`](app/alquileres): las pantallas del CRM.
- [`app/recibos`](app/recibos): el recibo listo para imprimir.
- [`tests/rentals.test.ts`](tests/rentals.test.ts): las reglas de los alquileres, la emisión de recibos y los avisos, con el envío de emails simulado.
- [`tests/crm.test.ts`](tests/crm.test.ts): el cruce, los formularios, las fotos y el formato de los precios.

## Autor

Creado por [Edu Lázaro](https://edulazaro.com) para [Neoguias](https://www.neoguias.com).

## Licencia

Este ejemplo es software libre con [licencia MIT](LICENSE).
