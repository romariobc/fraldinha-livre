// src/app/layout.tsx
import type { Metadata } from 'next'
import { Nunito, Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/contexts/auth-context'

import { MarketProvider } from '@/contexts/market-context'
import { OrdersProvider } from '@/contexts/orders-context'
import { CartProvider } from '@/contexts/cart-context'
import { ProductsProvider } from '@/contexts/products-context'

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
        <OrdersProvider>
          <ProductsProvider>
            <CartProvider>
              <AuthProvider>
                <MarketProvider>
                  {children}
                </MarketProvider>
              </AuthProvider>
            </CartProvider>
          </ProductsProvider>
        </OrdersProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
