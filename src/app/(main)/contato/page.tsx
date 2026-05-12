'use client'

import { useState } from 'react'
import { MapPin, Phone, Mail, Clock, Send, CheckCircle2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

const CONTACT_INFO = [
  {
    icon: MapPin,
    label: 'Endereço',
    lines: ['Av. Paulista, 1374 — 12º andar', 'Bela Vista, São Paulo — SP', 'CEP 01310-100'],
  },
  {
    icon: Phone,
    label: 'Telefone',
    lines: ['(11) 4002-8922', '(11) 98765-4321 (WhatsApp)'],
  },
  {
    icon: Mail,
    label: 'E-mail',
    lines: ['contato@fraldinhalivr.com.br', 'suporte@fraldinhalivr.com.br'],
  },
  {
    icon: Clock,
    label: 'Horário de atendimento',
    lines: ['Segunda a Sexta: 8h às 18h', 'Sábado: 9h às 13h'],
  },
]

const SUBJECTS = [
  'Dúvida sobre pedido',
  'Problema com entrega',
  'Parceria / Fornecedor',
  'Imprensa',
  'Outro',
]

export default function ContatoPage() {
  const [sent, setSent] = useState(false)
  const [subject, setSubject] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSent(true)
  }

  return (
    <>
      {/* ── HERO ── */}
      <section className="bg-gradient-to-br from-primary-light via-brand-bg to-white pt-14 pb-20">
        <div className="container-fl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[2px] text-primary-dark mb-2">
            Fale com a gente
          </p>
          <h1
            className="font-display font-black text-brand-text leading-[1.1] mb-4"
            style={{ fontSize: 'clamp(28px, 5vw, 48px)' }}
          >
            Como podemos ajudar? 💬
          </h1>
          <p className="text-brand-muted text-base max-w-xl mx-auto leading-relaxed">
            Nossa equipe está pronta para responder suas dúvidas, resolver problemas
            e ouvir sugestões. Respondemos em até <strong className="text-brand-text">2 horas</strong> em dias úteis.
          </p>
        </div>
      </section>

      {/* ── BODY ── */}
      <section className="bg-brand-bg py-16">
        <div className="container-fl">
          <div className="flex flex-col gap-10 lg:grid lg:grid-cols-[1fr_1.5fr] lg:gap-12 lg:items-start">

            {/* ── Informações de contato ── */}
            <div className="flex flex-col gap-5">

              {/* Cards de info */}
              {CONTACT_INFO.map(({ icon: Icon, label, lines }) => (
                <div
                  key={label}
                  className="bg-white rounded-card shadow-card p-5 flex gap-4 items-start"
                >
                  <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
                    <Icon size={18} className="text-primary-dark" />
                  </div>
                  <div>
                    <p className="font-display font-extrabold text-sm text-brand-text mb-1">{label}</p>
                    {lines.map((line) => (
                      <p key={line} className="text-sm text-brand-muted leading-relaxed">{line}</p>
                    ))}
                  </div>
                </div>
              ))}

              {/* Mapa placeholder */}
              <div className="rounded-card overflow-hidden shadow-card bg-primary-light h-44 flex items-center justify-center relative">
                <div className="text-center">
                  <MapPin size={28} className="text-primary-dark mx-auto mb-2" />
                  <p className="text-sm font-display font-bold text-primary-dark">Av. Paulista, 1374</p>
                  <p className="text-[11px] text-brand-muted">São Paulo — SP</p>
                </div>
                <div
                  aria-hidden="true"
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(0deg, #5BBFEA 0, #5BBFEA 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, #5BBFEA 0, #5BBFEA 1px, transparent 1px, transparent 40px)',
                  }}
                />
              </div>
            </div>

            {/* ── Formulário ── */}
            <div className="bg-white rounded-card shadow-card p-6 sm:p-8">

              {sent ? (
                <div className="flex flex-col items-center justify-center text-center py-12 gap-4">
                  <CheckCircle2 size={52} className="text-primary-dark" />
                  <p className="font-display font-black text-xl text-brand-text">
                    Mensagem enviada!
                  </p>
                  <p className="text-brand-muted text-sm max-w-xs leading-relaxed">
                    Recebemos sua mensagem e retornaremos em breve pelo e-mail informado.
                    Prazo: até <strong>2 horas</strong> em dias úteis.
                  </p>
                  <button
                    onClick={() => setSent(false)}
                    className="mt-2 text-sm font-semibold text-primary-dark hover:underline"
                  >
                    Enviar outra mensagem
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <p className="font-display font-extrabold text-lg text-brand-text">
                      Envie sua mensagem
                    </p>
                    <p className="text-sm text-brand-muted mt-1">
                      Preencha o formulário abaixo e entraremos em contato.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    {/* Nome + Email */}
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="nome" className="text-sm font-semibold text-brand-text">
                          Nome completo
                        </Label>
                        <Input
                          id="nome"
                          type="text"
                          placeholder="Ana Lima"
                          required
                          className="border-2 border-slate-200 rounded-xl bg-slate-50 focus-visible:border-primary focus-visible:ring-0 text-brand-text placeholder:text-slate-400"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="email" className="text-sm font-semibold text-brand-text">
                          E-mail
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="ana@email.com"
                          required
                          className="border-2 border-slate-200 rounded-xl bg-slate-50 focus-visible:border-primary focus-visible:ring-0 text-brand-text placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    {/* Telefone */}
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="telefone" className="text-sm font-semibold text-brand-text">
                        Telefone <span className="font-normal text-brand-muted">(opcional)</span>
                      </Label>
                      <Input
                        id="telefone"
                        type="tel"
                        placeholder="(11) 99999-0000"
                        className="border-2 border-slate-200 rounded-xl bg-slate-50 focus-visible:border-primary focus-visible:ring-0 text-brand-text placeholder:text-slate-400"
                      />
                    </div>

                    {/* Assunto — chips */}
                    <div className="flex flex-col gap-2">
                      <p className="text-sm font-semibold text-brand-text">Assunto</p>
                      <div className="flex flex-wrap gap-2">
                        {SUBJECTS.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setSubject(s)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                              subject === s
                                ? 'bg-primary text-white'
                                : 'bg-brand-bg text-brand-muted hover:bg-primary-light hover:text-primary-dark'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Mensagem */}
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="mensagem" className="text-sm font-semibold text-brand-text">
                        Mensagem
                      </Label>
                      <Textarea
                        id="mensagem"
                        placeholder="Descreva sua dúvida ou solicitação..."
                        required
                        rows={5}
                        className="border-2 border-slate-200 rounded-xl bg-slate-50 focus-visible:border-primary focus-visible:ring-0 text-brand-text placeholder:text-slate-400 resize-none"
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full rounded-xl py-6 bg-accent hover:bg-accent-dark font-display font-bold text-base text-white transition-colors flex items-center justify-center gap-2"
                    >
                      <Send size={18} />
                      Enviar mensagem
                    </Button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA strip ── */}
      <section className="bg-primary-dark py-12 text-center">
        <div className="container-fl">
          <p className="font-display font-black text-white mb-2"
             style={{ fontSize: 'clamp(18px, 3vw, 28px)' }}>
            Prefere o WhatsApp? 📱
          </p>
          <p className="text-white/70 text-sm mb-6">
            Atendemos também pelo WhatsApp de segunda a sábado.
          </p>
          <a
            href="https://wa.me/5511987654321"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-white text-primary-dark font-display font-extrabold text-sm hover:bg-primary-light transition-colors"
          >
            💬 Chamar no WhatsApp
          </a>
        </div>
      </section>
    </>
  )
}
