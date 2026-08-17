'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronUp, ChevronDown } from 'lucide-react'

const PAYMENT_METHODS = ['PIX', 'VISA', 'MASTER', 'ELO']

const NAVIGATION_LINKS = [
  { label: 'Início', href: '/' },
  { label: 'Sobre Nós', href: '/#sobre' },
  { label: 'Produtos', href: '/catalogo' },
  { label: 'Depoimentos', href: '/#depoimentos' },
]

const HELP_LINKS = [
  { label: 'FAQ', href: '/#faq' },
  { label: 'Contato', href: '/contato' },
  { label: 'Política de Privacidade', href: '/privacidade' },
  { label: 'Termos de Uso', href: '/termos' },
]

const SUPPLIER_LINKS = [
  { label: 'Seja um parceiro', href: '/cadastro' },
  { label: 'Acesso ao painel', href: '/login' },
  { label: 'Como funciona', href: '/como-funciona' },
]

export default function Footer() {
  const pathname = usePathname()
  const isHome = pathname === '/'
  const [expanded, setExpanded] = useState(false)

  if (pathname?.startsWith('/painel-fornecedor')) {
    return null
  }

  return (
    <footer className="bg-brand-text text-white/55">
      {!isHome && (
        <div className="border-b border-white/10 px-4 py-4">
          <div className="container-fl flex items-center justify-between">
            <span className="text-xs">
              © 2026 Fraldinha Livre. Todos os direitos reservados.
            </span>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
              aria-label="Alternar rodapé expandido"
            >
              Rodapé
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}

      {(isHome || expanded) && (
        <div className="pt-16 pb-8">
          <div className="container-fl">

            {/* Top grid */}
            <div className="grid grid-cols-1 gap-10 pb-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">

              {/* Brand */}
              <div>
                <Link href="/" className="flex items-center gap-2.5">
                  <Image
                    src="/assets/img/cegonha.png"
                    alt="Fraldinha Livre"
                    width={589}
                    height={366}
                    className="h-11 w-auto"
                  />
                  <div className="flex flex-col leading-tight">
                    <span className="font-display font-black text-base text-white tracking-tight">
                      Fraldinha Livre
                    </span>
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-white/40">
                      Fraldas para o seu bebê
                    </span>
                  </div>
                </Link>
                <p className="mt-4 text-sm leading-relaxed max-w-[280px]">
                  Conectamos famílias a fornecedores de fraldas confiáveis em todo o Brasil. Mais economia, mais conforto.
                </p>
              </div>

              {/* Col 2: Navegação */}
              <div>
                <h4 className="font-display font-extrabold text-sm text-white mb-4 tracking-tight">
                  Navegação
                </h4>
                <ul className="flex flex-col gap-2.5">
                  {NAVIGATION_LINKS.map((item) => (
                    <li key={item.label}>
                      <Link href={item.href} className="text-sm hover:text-primary transition-colors">
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Col 3: Ajuda */}
              <div>
                <h4 className="font-display font-extrabold text-sm text-white mb-4 tracking-tight">
                  Ajuda
                </h4>
                <ul className="flex flex-col gap-2.5">
                  {HELP_LINKS.map((item) => (
                    <li key={item.label}>
                      <Link href={item.href} className="text-sm hover:text-primary transition-colors">
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Col 4: Para fornecedores */}
              <div>
                <h4 className="font-display font-extrabold text-sm text-white mb-4 tracking-tight">
                  Para fornecedores
                </h4>
                <ul className="flex flex-col gap-2.5">
                  {SUPPLIER_LINKS.map((item) => (
                    <li key={item.label}>
                      <Link href={item.href} className="text-sm hover:text-primary transition-colors">
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="border-t border-white/10 pt-6 flex flex-col gap-3 items-center text-center sm:flex-row sm:justify-between sm:text-left">
              <span className="text-xs">
                © 2026 Fraldinha Livre. Todos os direitos reservados.
              </span>
              <div className="flex items-center gap-1.5">
                {PAYMENT_METHODS.map((method) => (
                  <span
                    key={method}
                    className="bg-white/10 rounded px-2 py-1 text-[10px] font-bold text-white/65"
                  >
                    {method}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </footer>
  )
}
