// src/app/(main)/perfil/page.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  User,
  Package,
  MapPin,
  LogOut,
  ChevronRight,
  Star,
  Pencil,
  Plus,
  Truck,
} from 'lucide-react'
import {
  MOCK_USER,
  MOCK_ORDERS,
  MOCK_ADDRESSES,
  STATUS_LABEL,
  STATUS_COLOR,
} from '@/lib/profile-mock'

type Tab = 'conta' | 'pedidos' | 'enderecos'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'conta',     label: 'Minha Conta',  icon: <User size={17} /> },
  { id: 'pedidos',   label: 'Meus Pedidos', icon: <Package size={17} /> },
  { id: 'enderecos', label: 'Endereços',    icon: <MapPin size={17} /> },
]

export default function PerfilPage() {
  const [tab, setTab] = useState<Tab>('conta')

  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Page header */}
      <section className="bg-primary-dark py-10 px-4">
        <div className="container-fl flex items-center gap-5">
          <div className="flex-shrink-0 w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
            <span className="font-display font-black text-2xl text-white select-none">
              {MOCK_USER.avatarInitials}
            </span>
          </div>
          <div>
            <h1 className="font-display font-black text-xl sm:text-2xl text-white leading-tight">
              {MOCK_USER.name}
            </h1>
            <p className="text-white/70 text-sm mt-0.5">
              Membro desde {MOCK_USER.memberSince}
            </p>
          </div>
        </div>
      </section>

      <div className="container-fl py-8">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Sidebar */}
          <aside className="lg:w-60 flex-shrink-0">
            <nav className="bg-white rounded-card shadow-card overflow-hidden">
              {TABS.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={[
                    'w-full flex items-center gap-3 px-5 py-3.5 text-sm font-semibold transition-colors',
                    i !== 0 ? 'border-t border-slate-100' : '',
                    tab === t.id
                      ? 'bg-primary-light text-primary-dark'
                      : 'text-brand-muted hover:bg-slate-50',
                  ].join(' ')}
                >
                  <span className={tab === t.id ? 'text-primary-dark' : 'text-brand-muted'}>
                    {t.icon}
                  </span>
                  {t.label}
                  {tab === t.id && (
                    <ChevronRight size={15} className="ml-auto text-primary-dark" />
                  )}
                </button>
              ))}

              <div className="border-t border-slate-100">
                <Link
                  href="/"
                  className="w-full flex items-center gap-3 px-5 py-3.5 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={17} />
                  Sair da conta
                </Link>
              </div>
            </nav>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {tab === 'conta'     && <ContaTab />}
            {tab === 'pedidos'   && <PedidosTab />}
            {tab === 'enderecos' && <EnderecosTab />}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Aba: Minha Conta ─── */
function ContaTab() {
  return (
    <div className="space-y-5">
      {/* Dados pessoais */}
      <div className="bg-white rounded-card shadow-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-black text-lg text-brand-text">Dados pessoais</h2>
          <button className="flex items-center gap-1.5 text-sm font-semibold text-primary-dark hover:underline">
            <Pencil size={14} /> Editar
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { label: 'Nome completo', value: MOCK_USER.name },
            { label: 'E-mail',        value: MOCK_USER.email },
            { label: 'Telefone',      value: MOCK_USER.phone },
            { label: 'CPF',           value: MOCK_USER.cpf },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-muted mb-1">
                {label}
              </p>
              <p className="text-sm font-semibold text-brand-text">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Segurança */}
      <div className="bg-white rounded-card shadow-card p-6">
        <h2 className="font-display font-black text-lg text-brand-text mb-5">Segurança</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-3 border-b border-slate-100">
            <div>
              <p className="text-sm font-semibold text-brand-text">Senha</p>
              <p className="text-xs text-brand-muted">Última alteração há 3 meses</p>
            </div>
            <button className="text-sm font-semibold text-primary-dark hover:underline">
              Alterar
            </button>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-semibold text-brand-text">Login com Google</p>
              <p className="text-xs text-brand-muted">Conta vinculada</p>
            </div>
            <span className="text-xs font-semibold bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
              Ativo
            </span>
          </div>
        </div>
      </div>

      {/* Resumo rápido */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { label: 'Pedidos realizados', value: MOCK_ORDERS.length, icon: <Package size={20} className="text-primary-dark" /> },
          { label: 'Pedidos entregues',  value: MOCK_ORDERS.filter(o => o.status === 'entregue').length, icon: <Star size={20} className="text-accent" /> },
          { label: 'Endereços salvos',   value: MOCK_ADDRESSES.length, icon: <MapPin size={20} className="text-primary-dark" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-white rounded-card shadow-card p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-primary-light flex items-center justify-center flex-shrink-0">
              {icon}
            </div>
            <div>
              <p className="font-display font-black text-2xl text-brand-text leading-none">{value}</p>
              <p className="text-xs text-brand-muted mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Aba: Meus Pedidos ─── */
function PedidosTab() {
  return (
    <div className="space-y-4">
      <h2 className="font-display font-black text-lg text-brand-text">Meus Pedidos</h2>

      {MOCK_ORDERS.length === 0 ? (
        <div className="bg-white rounded-card shadow-card p-10 text-center">
          <Package size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-brand-muted font-semibold">Você ainda não fez pedidos.</p>
          <Link
            href="/catalogo"
            className="inline-block mt-4 px-6 py-2.5 rounded-full bg-accent text-white font-display font-bold text-sm hover:bg-accent-dark transition-colors"
          >
            Ver catálogo
          </Link>
        </div>
      ) : (
        MOCK_ORDERS.map((order) => (
          <div key={order.id} className="bg-white rounded-card shadow-card overflow-hidden">
            {/* Order header */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="font-display font-black text-sm text-brand-text">{order.id}</span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[order.status]}`}>
                  {STATUS_LABEL[order.status]}
                </span>
              </div>
              <p className="text-xs text-brand-muted">{order.date}</p>
            </div>

            {/* Items */}
            <div className="px-5 py-4 space-y-2">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-brand-text">
                    {item.quantity}x {item.brand} {item.productName} — Tam. {item.size}
                  </span>
                  <span className="font-semibold text-brand-text whitespace-nowrap">
                    R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}
                  </span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-slate-50 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs text-brand-muted">
                {order.trackingCode && (
                  <>
                    <Truck size={14} />
                    <span>Rastreio: <span className="font-semibold text-brand-text">{order.trackingCode}</span></span>
                  </>
                )}
              </div>
              <p className="font-display font-black text-base text-brand-text">
                Total: R$ {order.total.toFixed(2).replace('.', ',')}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

/* ─── Aba: Endereços ─── */
function EnderecosTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-black text-lg text-brand-text">Endereços salvos</h2>
        <button className="flex items-center gap-1.5 text-sm font-semibold text-white bg-accent hover:bg-accent-dark px-4 py-2 rounded-full transition-colors">
          <Plus size={15} /> Novo endereço
        </button>
      </div>

      {MOCK_ADDRESSES.map((addr) => (
        <div
          key={addr.id}
          className={[
            'bg-white rounded-card shadow-card p-5 relative',
            addr.isDefault ? 'ring-2 ring-primary' : '',
          ].join(' ')}
        >
          {addr.isDefault && (
            <span className="absolute top-4 right-4 text-xs font-bold text-primary-dark bg-primary-light px-2.5 py-1 rounded-full">
              Padrão
            </span>
          )}
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center flex-shrink-0 mt-0.5">
              <MapPin size={17} className="text-primary-dark" />
            </div>
            <div className="flex-1 min-w-0 pr-16">
              <p className="font-display font-black text-sm text-brand-text">{addr.label}</p>
              <p className="text-sm text-brand-muted mt-1 leading-relaxed">
                {addr.street}, {addr.number}
                {addr.complement && ` — ${addr.complement}`}
                <br />
                {addr.neighborhood}, {addr.city} – {addr.state}
                <br />
                CEP {addr.zip}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100">
            <button className="text-xs font-semibold text-primary-dark hover:underline">
              Editar
            </button>
            {!addr.isDefault && (
              <>
                <span className="text-slate-200">|</span>
                <button className="text-xs font-semibold text-brand-muted hover:underline">
                  Tornar padrão
                </button>
                <span className="text-slate-200">|</span>
                <button className="text-xs font-semibold text-red-500 hover:underline">
                  Remover
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
