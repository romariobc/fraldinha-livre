import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { MarketProvider } from '@/contexts/market-context'
import { OrdersProvider } from '@/contexts/orders-context'
import { CartProvider } from '@/contexts/cart-context'
import { ProductsProvider } from '@/contexts/products-context'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <OrdersProvider>
      <ProductsProvider>
        <CartProvider>
          <MarketProvider>
            <Header />
            <main>
              {children}
            </main>
            <Footer />
          </MarketProvider>
        </CartProvider>
      </ProductsProvider>
    </OrdersProvider>
  )
}
