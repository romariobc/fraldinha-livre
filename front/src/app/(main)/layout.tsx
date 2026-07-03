import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { MarketProvider } from '@/contexts/market-context'
import { OrdersProvider } from '@/contexts/orders-context'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <OrdersProvider>
      <MarketProvider>
        <Header />
        <main>
          {children}
        </main>
        <Footer />
      </MarketProvider>
    </OrdersProvider>
  )
}
