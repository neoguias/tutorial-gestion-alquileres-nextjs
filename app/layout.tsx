import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Nav, NavLinks } from '@/components/nav'
import { AGENCY } from '@/lib/crm'
import './globals.css'

export const metadata: Metadata = {
  title: { template: `%s · ${AGENCY}`, default: AGENCY },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 text-slate-800 antialiased">
        <header className="border-b border-slate-200 bg-white print:hidden">
          <Suspense fallback={<NavLinks />}>
            <Nav />
          </Suspense>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  )
}
