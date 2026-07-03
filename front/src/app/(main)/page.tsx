// src/app/page.tsx
import Image from 'next/image'
import Link from 'next/link'
import WaveDivider from '@/components/WaveDivider'
import FaqAccordion from '@/components/FaqAccordion'

const BRANDS = [
  'Pampers', 'Huggies', 'MamyPoko', 'Turma da Mônica',
  'Cremer', 'Babysec', 'Pom Pom', 'Mili', 'Softcair', 'Up & Go',
]

function CloudBrand({ name, delay = 0 }: { name: string; delay?: number }) {
  return (
    <div
      className="relative cloud-float"
      style={{
        paddingTop: 28,
        filter: 'drop-shadow(0 6px 16px rgba(30,120,170,0.22))',
        animationDelay: `${delay}s`,
      }}
    >
      {/* Bumps — z-0 para ficarem atrás do corpo */}
      <div className="absolute z-0 bg-white rounded-full" style={{ width: 36, height: 36, top: 4,  left: 14 }} />
      <div className="absolute z-0 bg-white rounded-full" style={{ width: 50, height: 50, top: 0,  left: 36 }} />
      <div className="absolute z-0 bg-white rounded-full" style={{ width: 30, height: 30, top: 10, right: 12 }} />
      {/* Body — relative z-[1] para aparecer acima dos bumps */}
      <div className="relative z-[1] bg-white rounded-[28px] px-7 py-3 min-w-[110px] flex items-center justify-center">
        <span className="font-display font-extrabold text-sm text-brand-text whitespace-nowrap">
          {name}
        </span>
      </div>
    </div>
  )
}

/** Nuvenzinha decorativa de fundo (sem texto) */
function DecoCloud({ className }: { className?: string }) {
  return (
    <div
      className={`absolute pointer-events-none ${className ?? ''}`}
      style={{ filter: 'drop-shadow(0 2px 6px rgba(30,120,170,0.1))' }}
      aria-hidden="true"
    >
      <div className="relative" style={{ paddingTop: 18 }}>
        <div className="absolute bg-white/50 rounded-full" style={{ width: 22, height: 22, top: 3,  left: 8  }} />
        <div className="absolute bg-white/50 rounded-full" style={{ width: 32, height: 32, top: 0,  left: 22 }} />
        <div className="absolute bg-white/50 rounded-full" style={{ width: 18, height: 18, top: 7,  right: 8  }} />
        <div className="bg-white/50 rounded-[18px] px-5 py-2 w-24" />
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <>
      {/* ── HERO ── */}
      <section
        id="hero"
        className="relative overflow-hidden bg-gradient-to-br from-primary-light via-brand-bg to-white pt-12 pb-24 lg:pt-20 lg:pb-32"
      >
        {/* Blob decorativo */}
        <div
          aria-hidden="true"
          className="absolute -top-20 -right-20 w-72 h-72 rounded-full lg:w-96 lg:h-96"
          style={{ background: 'radial-gradient(circle, rgba(91,191,234,0.15) 0%, transparent 70%)' }}
        />

        <div className="container-fl relative z-10">
          <div className="flex flex-col gap-10 lg:grid lg:grid-cols-2 lg:items-center lg:gap-20">

            {/* Content */}
            <div>
              {/* Badge */}
              <div className="inline-flex items-center gap-1.5 bg-primary/15 text-primary-dark rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse2" />
                Entrega garantida pelo fornecedor
              </div>

              <h1 className="font-display font-black text-brand-text leading-[1.1] mb-5"
                  style={{ fontSize: 'clamp(30px, 6vw, 56px)' }}>
                Fraldas premium<br />
                <span className="text-primary-dark">direto na sua</span><br />
                porta 🍼
              </h1>

              <p className="text-brand-muted text-base lg:text-lg leading-relaxed mb-8 max-w-[480px]">
                Conectamos você aos melhores fornecedores de fraldas do Brasil.
                Compare ofertas, economize de verdade e garanta o conforto do seu bebê.
              </p>

              {/* CTAs */}
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  href="/cadastro"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-accent text-white font-display font-bold text-base hover:bg-accent-dark transition-all hover:-translate-y-0.5 shadow-lg shadow-accent/25"
                >
                  ✨ Começar grátis
                </Link>
                <Link
                  href="/#produtos"
                  className="inline-flex items-center justify-center px-7 py-3.5 rounded-full border-2 border-primary text-primary-dark font-display font-bold text-base hover:bg-primary-light transition-colors"
                >
                  Ver produtos
                </Link>
              </div>

              {/* Trust */}
              <div className="flex items-center gap-2.5 mt-8">
                <div className="flex">
                  {['A', 'M', 'R'].map((letter, i) => (
                    <span
                      key={letter}
                      className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center font-display font-extrabold text-[10px] text-white"
                      style={{
                        marginLeft: i === 0 ? 0 : '-8px',
                        background: ['#5BBFEA', '#F5A623', '#2A9FD4'][i],
                      }}
                    >
                      {letter}
                    </span>
                  ))}
                </div>
                <span className="text-xs text-brand-muted">
                  +2.400 famílias economizando todo mês
                </span>
              </div>
            </div>

            {/* Visual */}
            <div className="flex justify-center">
              <div className="relative w-full max-w-[420px] lg:max-w-[500px]">

                {/* Card principal */}
                <div className="aspect-[4/5] rounded-[28px] bg-gradient-to-br from-primary to-primary-dark flex flex-col items-center justify-center gap-6 p-10 overflow-hidden relative">
                  {/* Blobs decorativos */}
                  <div aria-hidden="true" className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-white/10" />
                  <div aria-hidden="true" className="absolute -bottom-12 -right-12 w-64 h-64 rounded-full bg-white/8" />
                  <div aria-hidden="true" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-white/5" />

                  {/* Logo animada */}
                  <div className="relative z-10 animate-float">
                    <Image
                      src="/assets/img/Logo_simples_sem_fundo.png"
                      alt=""
                      width={120}
                      height={120}
                      className="h-28 w-auto drop-shadow-xl"
                      priority
                    />
                  </div>

                  {/* Mini cards de produto */}
                  <div className="relative z-10 flex flex-col gap-3 w-full">
                    {[
                      { marca: 'Pampers', tam: 'Tam. M · 32 un.', preco: 'R$ 29' },
                      { marca: 'Huggies', tam: 'Tam. G · 28 un.', preco: 'R$ 34' },
                      { marca: 'MamyPoko', tam: 'Tam. P · 36 un.', preco: 'R$ 22' },
                    ].map((item, i) => (
                      <div
                        key={item.marca}
                        className="flex items-center justify-between bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2.5"
                        style={{ opacity: 1 - i * 0.15 }}
                      >
                        <div>
                          <p className="font-display font-extrabold text-white text-sm leading-none">{item.marca}</p>
                          <p className="text-white/65 text-[11px] mt-0.5">{item.tam}</p>
                        </div>
                        <span className="font-display font-black text-white text-base">{item.preco}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bubble top — pedido confirmado */}
                <div className="absolute -top-5 -right-4 sm:-right-8 bg-white rounded-2xl px-4 py-3 shadow-card flex items-center gap-2.5 whitespace-nowrap z-20">
                  <Image
                    src="/assets/img/Logo_simples_sem_fundo.png"
                    alt=""
                    width={28}
                    height={28}
                    className="h-7 w-auto"
                  />
                  <div>
                    <p className="font-display font-extrabold text-sm text-brand-text leading-none">Pedido confirmado!</p>
                    <p className="text-[11px] text-brand-muted mt-0.5">Chegando em 24–48h</p>
                  </div>
                </div>

                {/* Bubble bottom — economia */}
                <div className="absolute -bottom-5 -left-4 sm:-left-7 bg-accent text-white rounded-2xl px-4 py-3 shadow-lg shadow-accent/25 z-20">
                  <p className="text-[11px] opacity-90">Economia média</p>
                  <p className="font-display font-black text-xl leading-none">R$ 87/mês</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <WaveDivider bgTop="#E8F6FD" bgBottom="#3BAED4" />

      {/* ── BRANDS — sky with floating clouds ── */}
      <section
        className="relative overflow-hidden py-16 -mt-px"
        style={{ background: 'linear-gradient(180deg, #3BAED4 0%, #6DCAEA 45%, #B3E4F8 100%)' }}
      >
        {/* Sol decorativo — dentro dos limites da section para não ser cortado */}
        <div
          aria-hidden="true"
          className="absolute top-6 right-8 w-32 h-32 rounded-full"
          style={{ background: 'radial-gradient(circle, #FFE566 0%, #FFD000 55%, rgba(255,208,0,0) 100%)' }}
        />

        {/* Nuvenzinhas decorativas de fundo — cada uma com delay próprio */}
        <DecoCloud className="top-3   left-[5%]  scale-90  opacity-70 cloud-float [animation-delay:0.3s]" />
        <DecoCloud className="top-8   left-[42%] scale-75  opacity-50 cloud-float [animation-delay:1.7s] [animation-duration:6s]" />
        <DecoCloud className="bottom-2 right-[8%] scale-110 opacity-60 cloud-float [animation-delay:0.9s] [animation-duration:5.5s]" />
        <DecoCloud className="bottom-4 left-[22%] scale-75  opacity-40 cloud-float [animation-delay:2.4s]" />

        <div className="container-fl relative z-10">
          <p className="text-center text-[11px] font-bold uppercase tracking-[2px] text-white/80 drop-shadow mb-10">
            Fraldas das marcas que você já conhece e confia
          </p>

          {/* Nuvens de marca — 2 linhas flutuantes */}
          <div className="flex flex-wrap items-end justify-center gap-x-6 gap-y-4 sm:gap-x-10 sm:gap-y-6">
            {BRANDS.map((brand, i) => (
              <CloudBrand key={brand} name={brand} delay={i * 0.45} />
            ))}
          </div>
        </div>
      </section>

      <WaveDivider bgTop="#B3E4F8" bgBottom="#ffffff" path="M0,0 C480,70 960,0 1440,55 L1440,70 L0,70 Z" />

      {/* ── HOW IT WORKS ── */}
      <section id="sobre" className="bg-white py-20">
        <div className="container-fl">
          <div className="flex flex-col gap-16 lg:grid lg:grid-cols-2 lg:items-center lg:gap-20">

            {/* Steps */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[2px] text-primary-dark mb-2">
                Como funciona
              </p>
              <h2 className="font-display font-black text-brand-text leading-[1.15] mb-4"
                  style={{ fontSize: 'clamp(24px, 3vw, 40px)' }}>
                Simples, rápido<br />e econômico 💛
              </h2>
              <p className="text-brand-muted text-sm leading-relaxed mb-10 max-w-[500px]">
                Do pedido à entrega, cuidamos de tudo para que você foque no que importa — o seu bebê.
              </p>

              <div className="flex flex-col gap-7">
                {[
                  {
                    n: '1',
                    title: 'Escolha seus produtos',
                    desc: 'Navegue pelo catálogo e adicione ao carrinho as fraldas na quantidade e tamanho que precisar.',
                  },
                  {
                    n: '2',
                    title: 'Fornecedores competem por você',
                    desc: 'Seu pedido vai para nossa rede de fornecedores. Eles confirmam ou fazem ofertas — você escolhe a melhor.',
                  },
                  {
                    n: '3',
                    title: 'Pague com segurança',
                    desc: 'Checkout integrado com Mercado Pago. Pagamento protegido, entrega garantida.',
                  },
                  {
                    n: '4',
                    title: 'Receba em casa',
                    desc: 'O fornecedor cuida da entrega diretamente até você. Acompanhe tudo pela sua área de cliente.',
                  },
                ].map((step) => (
                  <div key={step.n} className="flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-full bg-primary-light text-primary-dark flex items-center justify-center font-display font-black text-lg flex-shrink-0">
                      {step.n}
                    </div>
                    <div>
                      <p className="font-display font-extrabold text-brand-text mb-1">{step.title}</p>
                      <p className="text-sm text-brand-muted leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual card */}
            <div className="bg-primary-light rounded-[28px] p-10 flex flex-col items-center text-center gap-4">
              <span className="text-6xl animate-float inline-block">🍼</span>
              <p className="font-display font-extrabold text-lg text-primary-dark">
                Sua cegonha de fraldas<br />está a caminho!
              </p>
              <p className="text-sm text-brand-muted leading-relaxed">
                Conectamos famílias a fornecedores confiáveis em todo o Brasil, com entrega rápida e preço justo.
              </p>
              <Link
                href="/cadastro"
                className="mt-2 inline-flex items-center justify-center px-6 py-3 rounded-full bg-primary text-white font-display font-bold text-sm hover:bg-primary-dark transition-colors"
              >
                Fazer meu primeiro pedido
              </Link>
            </div>
          </div>
        </div>
      </section>

      <WaveDivider bgTop="#ffffff" bgBottom="#F0F8FD" path="M0,55 C480,0 960,70 1440,25 L1440,70 L0,70 Z" />

      {/* ── PRODUCTS ── */}
      <section id="produtos" className="bg-brand-bg py-20">
        <div className="container-fl">
          <div className="flex flex-col gap-4 mb-12 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[2px] text-primary-dark mb-2">
                Catálogo
              </p>
              <h2 className="font-display font-black text-brand-text"
                  style={{ fontSize: 'clamp(24px, 3vw, 40px)' }}>
                Produtos em destaque
              </h2>
            </div>
            <Link
              href="/#produtos"
              className="inline-flex items-center px-5 py-2 rounded-full border-2 border-primary text-primary-dark font-display font-bold text-sm hover:bg-primary-light transition-colors self-start sm:self-auto"
            >
              Ver todos →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {[
              { brand: 'Pampers', name: 'Supersec Pants', size: 'Tam. P · 28 un.', price: 16, badge: 'Mais vendido', badgeColor: 'bg-accent' },
              { brand: 'Huggies', name: 'Supreme Care', size: 'Tam. M · 32 un.', price: 29, badge: null, badgeColor: '' },
              { brand: 'MamyPoko', name: 'Pants Premium', size: 'Tam. G · 30 un.', price: 39, badge: 'Oferta', badgeColor: 'bg-primary-dark' },
              { brand: 'Fraldinha Livre', name: 'Kit Inicial Bebê', size: 'P + M + G · 3 pcts', price: 49, badge: null, badgeColor: '' },
            ].map((product) => (
              <div
                key={product.name}
                className="bg-white rounded-card shadow-card overflow-hidden hover:-translate-y-1.5 hover:shadow-card-hover transition-all cursor-pointer"
              >
                <div className="aspect-square bg-primary-light flex items-center justify-center text-4xl sm:text-5xl relative">
                  🧷
                  {product.badge && (
                    <span className={`absolute top-2.5 left-2.5 ${product.badgeColor} text-white text-[10px] font-bold rounded-full px-2.5 py-0.5`}>
                      {product.badge}
                    </span>
                  )}
                </div>
                <div className="p-3.5 sm:p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-primary-dark mb-0.5">
                    {product.brand}
                  </p>
                  <p className="font-display font-extrabold text-sm text-brand-text mb-0.5">
                    {product.name}
                  </p>
                  <p className="text-[11px] text-brand-muted mb-3">{product.size}</p>
                  <div className="flex items-center justify-between">
                    <p className="font-display font-black text-base sm:text-lg text-brand-text">
                      R$&nbsp;{product.price}
                      <span className="text-[11px] font-medium text-brand-muted font-body"> / pct</span>
                    </p>
                    <button
                      className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-lg hover:bg-primary-dark hover:scale-110 transition-all"
                      aria-label={`Adicionar ${product.name} ao carrinho`}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <WaveDivider bgTop="#F0F8FD" bgBottom="#2A9FD4" path="M0,20 C360,70 1080,0 1440,40 L1440,70 L0,70 Z" />

      {/* ── STATS ── */}
      <section className="bg-primary-dark py-14">
        <div className="container-fl">
          <div className="grid grid-cols-2 gap-8 text-center lg:grid-cols-4">
            {[
              { num: '2.4k+', label: 'Famílias atendidas' },
              { num: 'R$87', label: 'Economia média/mês' },
              { num: '120+', label: 'Fornecedores parceiros' },
              { num: '98%', label: 'Satisfação dos clientes' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="font-display font-black text-white leading-none"
                   style={{ fontSize: 'clamp(32px, 5vw, 48px)' }}>
                  {stat.num}
                </p>
                <p className="text-sm text-white/70 mt-2">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <WaveDivider bgTop="#2A9FD4" bgBottom="#ffffff" path="M0,55 C360,0 1080,70 1440,20 L1440,70 L0,70 Z" />

      {/* ── TESTIMONIALS ── */}
      <section id="depoimentos" className="bg-white py-20">
        <div className="container-fl">
          <div className="text-center mb-14">
            <p className="text-[11px] font-bold uppercase tracking-[2px] text-primary-dark mb-2">
              Depoimentos
            </p>
            <h2 className="font-display font-black text-brand-text"
                style={{ fontSize: 'clamp(24px, 3vw, 40px)' }}>
              O que as famílias dizem
            </h2>
            <p className="text-brand-muted text-sm mt-2">
              Mais de 2.400 famílias já economizaram com a Fraldinha Livre.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { letter: 'A', name: 'Ana Lima', role: 'Mamãe do Miguel, 8 meses', color: 'bg-primary', text: '"Economizei quase R$100 no mês! O fornecedor confirmou rápido e as fraldas chegaram em dois dias. Recomendo muito."' },
              { letter: 'R', name: 'Rafael Mendes', role: 'Papai da Sofia, 4 meses', color: 'bg-accent', text: '"Super prático! Fiz o pedido pelo site e em menos de 1 hora recebi a confirmação do fornecedor. Processo todo transparente."' },
              { letter: 'C', name: 'Carla Santos', role: 'Mamãe do Pedro, 1 ano', color: 'bg-primary-dark', text: '"A plataforma é linda e muito fácil de usar. O melhor é saber que estou pagando justo — sem atravessadores escondidos."' },
            ].map((t) => (
              <div key={t.name} className="bg-brand-bg rounded-card p-6">
                <p className="text-accent tracking-widest mb-3">★★★★★</p>
                <p className="text-sm text-brand-muted leading-relaxed mb-5">{t.text}</p>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${t.color} text-white flex items-center justify-center font-display font-extrabold text-sm flex-shrink-0`}>
                    {t.letter}
                  </div>
                  <div>
                    <p className="font-display font-extrabold text-sm text-brand-text">{t.name}</p>
                    <p className="text-[11px] text-brand-muted">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <WaveDivider bgTop="#ffffff" bgBottom="#F0F8FD" />

      {/* ── FAQ ── */}
      <section id="faq" className="bg-brand-bg py-20">
        <div className="container-fl">
          <div className="flex flex-col gap-16 lg:grid lg:grid-cols-[1fr_1.4fr] lg:items-start lg:gap-20">

            {/* Sticky card */}
            <div className="bg-white rounded-[28px] p-10 flex flex-col items-center text-center gap-4 lg:sticky lg:top-24">
              <span className="text-5xl">🍼</span>
              <p className="font-display font-extrabold text-lg text-primary-dark">
                Ainda tem dúvidas?
              </p>
              <p className="text-sm text-brand-muted leading-relaxed">
                Fale com a nossa equipe pelo WhatsApp ou deixe sua mensagem — respondemos em até 2 horas.
              </p>
              <Link
                href="/contato"
                className="mt-2 inline-flex items-center justify-center px-6 py-3 rounded-full bg-primary text-white font-display font-bold text-sm hover:bg-primary-dark transition-colors"
              >
                💬 Falar no WhatsApp
              </Link>
            </div>

            {/* Accordion */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[2px] text-primary-dark mb-2">
                FAQ
              </p>
              <h2 className="font-display font-black text-brand-text mb-8"
                  style={{ fontSize: 'clamp(24px, 3vw, 40px)' }}>
                Perguntas<br />frequentes
              </h2>

              <FaqAccordion />
            </div>
          </div>
        </div>
      </section>

      <WaveDivider bgTop="#F0F8FD" bgBottom="#2A9FD4" path="M0,20 C480,70 960,0 1440,50 L1440,70 L0,70 Z" />

      {/* ── CTA ── */}
      <section className="bg-primary-dark py-20 text-center relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ background: 'radial-gradient(circle at center, rgba(255,255,255,0.05) 0%, transparent 60%)' }}
        />
        <div className="container-fl relative">
          <h2 className="font-display font-black text-white mb-3"
              style={{ fontSize: 'clamp(24px, 4vw, 40px)' }}>
            Pronto para economizar<br />nas fraldas do seu bebê? 🍼
          </h2>
          <p className="text-white/75 text-base mb-10">
            Crie sua conta grátis e faça seu primeiro pedido hoje mesmo.
          </p>
          <div className="flex flex-col gap-3 items-center sm:flex-row sm:justify-center">
            <Link
              href="/cadastro"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-white text-primary-dark font-display font-extrabold text-base hover:bg-primary-light transition-colors"
            >
              ✨ Criar conta grátis
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-full border-2 border-white/50 text-white font-display font-bold text-base hover:border-white hover:bg-white/10 transition-colors"
            >
              Já tenho conta
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
