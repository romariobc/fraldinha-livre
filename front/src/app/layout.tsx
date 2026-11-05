// src/app/layout.tsx
import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/contexts/auth-context'

import { MarketProvider } from '@/contexts/market-context'
import { OrdersProvider } from '@/contexts/orders-context'
import { CartProvider } from '@/contexts/cart-context'
import { ProductsProvider } from '@/contexts/products-context'

const nunito = localFont({
  src: './fonts/nunito-latin-variable.woff2',
  variable: '--font-nunito',
  weight: '200 1000',
  display: 'swap',
})

const inter = localFont({
  src: './fonts/inter-latin-variable.woff2',
  variable: '--font-inter',
  weight: '100 900',
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
