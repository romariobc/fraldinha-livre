// src/app/page.tsx
import Image from 'next/image'
import Link from 'next/link'
import WaveDivider from '@/components/WaveDivider'

const BRANDS = ['Pampers', 'Huggies', 'MamyPoko', 'Turma da Mônica', 'Cremer']

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
                {/* Hero photo */}
                <div className="aspect-[4/5] rounded-[28px] overflow-hidden bg-primary-light">
                  <Image
                    src="/assets/img/hero1.jpg"
                    alt="Bebê feliz com fraldinha"
                    width={500}
                    height={625}
                    className="w-full h-full object-cover"
                    priority
                  />
                </div>

                {/* Bubble top */}
                <div className="absolute -top-6 -right-4 sm:-right-8 bg-white rounded-2xl px-4 py-3 shadow-card flex items-center gap-2.5 whitespace-nowrap">
                  <span className="text-2xl">🛒</span>
                  <div>
                    <p className="font-display font-extrabold text-sm text-brand-text leading-none">
                      Pedido confirmado!
                    </p>
                    <p className="text-[11px] text-brand-muted mt-0.5">Chegando em 24–48h</p>
                  </div>
                </div>

                {/* Bubble bottom */}
                <div className="absolute -bottom-6 -left-4 sm:-left-7 bg-accent text-white rounded-2xl px-4 py-3 shadow-lg shadow-accent/25">
                  <p className="text-[11px] opacity-90">Economia média</p>
                  <p className="font-display font-black text-xl leading-none">R$ 87/mês</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <WaveDivider bgTop="#E8F6FD" bgBottom="#ffffff" />

      {/* ── BRANDS ── */}
      <section className="bg-white py-12">
        <div className="container-fl">
          <p className="text-center text-[11px] font-bold uppercase tracking-[1.5px] text-brand-muted mb-6">
            Fraldas das marcas que você já conhece e confia
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-6">
            {BRANDS.map((brand) => (
              <span
                key={brand}
                className="bg-brand-bg rounded-full px-5 py-2 font-display font-extrabold text-sm text-brand-muted"
              >
                {brand}
              </span>
            ))}
          </div>
        </div>
      </section>

      <WaveDivider bgTop="#ffffff" bgBottom="#ffffff" path="M0,0 C480,70 960,0 1440,55 L1440,70 L0,70 Z" />
    </>
  )
}
