// src/app/layout.tsx
import type { Metadata } from 'next'
import { Nunito, Inter } from 'next/font/google'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { Toaster } from 'sonner'

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  weight: ['400', '600', '700', '800', '900'],
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Fraldinha Livre',
  description: 'Fraldas premium direto na sua porta. Conectamos você aos melhores fornecedores do Brasil.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-br" className={`${nunito.variable} ${inter.variable}`}>
      <head>
        <link href="/assets/img/apple-touch-icon.png" rel="apple-touch-icon" />
      </head>
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
