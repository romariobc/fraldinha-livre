import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { MarketProvider } from '@/contexts/market-context'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main>
        <MarketProvider>{children}</MarketProvider>
      </main>
      <Footer />
    </>
  )
}
