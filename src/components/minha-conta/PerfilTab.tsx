// src/components/minha-conta/PerfilTab.tsx
'use client'

import { Mail, MapPin, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { MockUser } from '@/lib/account-mock'

interface PerfilTabProps {
  user: MockUser
}

function maskCpf(cpf: string): string {
  return cpf.replace(/^\d{3}\.\d{3}\.(\d{3}-\d{2})$/, (_, last) => `***.***.${last}`)
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={14} className="text-primary-dark" />
      </div>
      <div>
        <p className="text-xs text-brand-muted font-semibold mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-brand-text">{value}</p>
      </div>
    </div>
  )
}

export default function PerfilTab({ user }: PerfilTabProps) {
  const fullAddress = [
    `${user.address.logradouro}, ${user.address.numero}${user.address.complemento ? ` — ${user.address.complemento}` : ''}`,
    `${user.address.bairro}, ${user.address.cidade} — ${user.address.estado}`,
    user.address.cep,
  ].join(' · ')

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-card shadow-card p-6">
        {/* Avatar + nome */}
        <div className="flex items-center gap-4 mb-5">
          <Avatar size="lg" className="w-14 h-14">
            <AvatarFallback className="bg-primary text-white font-display font-black text-xl">
              {user.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-display font-black text-lg text-brand-text">{user.name}</p>
            <p className="text-xs text-brand-muted">Membro desde jan/2026</p>
          </div>
        </div>

        <Separator />
        <InfoRow icon={Mail}        label="E-mail"               value={user.email} />
        <Separator />
        <InfoRow icon={CreditCard}  label="CPF"                  value={maskCpf(user.cpf)} />
        <Separator />
        <InfoRow icon={MapPin}      label="Endereço de cadastro" value={fullAddress} />
      </div>

      <button
        onClick={() => toast.info('Edição de perfil em breve.')}
        className="w-full py-3 rounded-xl border-2 border-primary text-primary-dark font-display font-bold text-sm hover:bg-primary-light transition-colors"
      >
        Editar perfil
      </button>
    </div>
  )
}
