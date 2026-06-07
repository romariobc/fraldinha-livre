// src/components/Footer.tsx
import Image from 'next/image'
import Link from 'next/link'

const PAYMENT_METHODS = ['PIX', 'VISA', 'MASTER', 'ELO']

export default function Footer() {
  return (
    <footer className="bg-brand-text text-white/55 pt-16 pb-8">
      <div className="container-fl">

        {/* Top grid */}
        <div className="grid grid-cols-1 gap-10 pb-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">

          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/assets/img/Logo_simples_sem_fundo.png"
                alt="Fraldinha Livre"
                width={40}
                height={40}
                className="h-9 w-auto brightness-0 invert"
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

          {/* Col 2 */}
          <div>
            <h4 className="font-display font-extrabold text-sm text-white mb-4 tracking-tight">
              Navegação
            </h4>
            <ul className="flex flex-col gap-2.5">
              {['Início', 'Sobre Nós', 'Produtos', 'Depoimentos'].map((item) => (
                <li key={item}>
                  <Link href="/" className="text-sm hover:text-primary transition-colors">
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 */}
          <div>
            <h4 className="font-display font-extrabold text-sm text-white mb-4 tracking-tight">
              Ajuda
            </h4>
            <ul className="flex flex-col gap-2.5">
              {[
                { label: 'FAQ', href: '/#faq' },
                { label: 'Contato', href: '/#contato' },
                { label: 'Política de Privacidade', href: '/privacidade' },
                { label: 'Termos de Uso', href: '/termos' },
              ].map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="text-sm hover:text-primary transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4 */}
          <div>
            <h4 className="font-display font-extrabold text-sm text-white mb-4 tracking-tight">
              Para fornecedores
            </h4>
            <ul className="flex flex-col gap-2.5">
              {['Seja um parceiro', 'Acesso ao painel', 'Como funciona'].map((item) => (
                <li key={item}>
                  <Link href="#" className="text-sm hover:text-primary transition-colors">
                    {item}
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
    </footer>
  )
}
