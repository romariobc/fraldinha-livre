// src/components/fornecedor/PerfilTab.tsx
'use client'

import { useState } from 'react'
import { Building2, MapPin, Phone, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { useAuth, type UserProfile } from '@/contexts/auth-context'
import { isValidCNPJ } from '@/lib/utils'
import { maskCnpj } from '@/lib/supplier-mock'

function formatCEP(cep: string): string {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) return cep
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  return phone
}

function maskCNPJInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

function maskPhoneBR(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

type ProfileAddress = NonNullable<UserProfile['address']>

function getOrEmptyAddress(addr: UserProfile['address']): ProfileAddress {
  return addr ?? {
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
  }
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

export default function PerfilTab() {
  const { profile, updateProfile } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editData, setEditData] = useState<UserProfile>(profile || {
    role: 'fornecedor',
    name: '',
    email: '',
    address: {
      logradouro: '',
      numero: '',
      bairro: '',
      cidade: '',
      estado: '',
      cep: '',
    },
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (!profile) {
    return (
      <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full">
        <div className="bg-white rounded-card shadow-card p-6 text-center">
          <p className="text-brand-muted">Carregando perfil...</p>
        </div>
      </div>
    )
  }

  const handleEditClick = () => {
    setEditData(profile)
    setErrors({})
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditData(profile)
    setErrors({})
  }

  async function handleSave() {
    const newErrors: Record<string, string> = {}

    if (!editData.cnpj?.trim()) {
      newErrors.cnpj = 'CNPJ é obrigatório'
    } else if (!isValidCNPJ(editData.cnpj)) {
      newErrors.cnpj = 'CNPJ inválido'
    }

    if (!editData.razaoSocial?.trim()) {
      newErrors.razaoSocial = 'Razão social é obrigatória'
    }

    if (!editData.nomeFantasia?.trim()) {
      newErrors.nomeFantasia = 'Nome fantasia é obrigatório'
    }

    if (!editData.phone?.trim()) {
      newErrors.phone = 'Telefone é obrigatório'
    } else {
      const phoneDigits = editData.phone.replace(/\D/g, '')
      if (![10, 11].includes(phoneDigits.length)) {
        newErrors.phone = 'Telefone deve ter DDD + número (10 ou 11 dígitos)'
      }
    }

    if (!editData.address?.logradouro?.trim()) newErrors.logradouro = 'Logradouro é obrigatório'
    if (!editData.address?.numero?.trim()) newErrors.numero = 'Número é obrigatório'
    if (!editData.address?.bairro?.trim()) newErrors.bairro = 'Bairro é obrigatório'
    if (!editData.address?.cidade?.trim()) newErrors.cidade = 'Cidade é obrigatória'
    if (!editData.address?.estado?.trim()) newErrors.estado = 'Estado é obrigatório'
    if (!editData.address?.cep?.trim()) newErrors.cep = 'CEP é obrigatório'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    try {
      setIsSaving(true)
      await updateProfile({
        cnpj: editData.cnpj,
        razaoSocial: editData.razaoSocial,
        nomeFantasia: editData.nomeFantasia,
        phone: editData.phone,
        address: editData.address,
      })
      setIsEditing(false)
      toast.success('Perfil salvo com sucesso!')
    } catch (error) {
      console.error('Erro ao salvar perfil:', error)
      toast.error('Erro ao salvar perfil')
    } finally {
      setIsSaving(false)
    }
  }

  // Visualização
  if (!isEditing) {
    const fullAddress = profile.address
      ? [
          `${profile.address.logradouro}, ${profile.address.numero}${profile.address.complemento ? ` — ${profile.address.complemento}` : ''}`,
          `${profile.address.bairro}, ${profile.address.cidade} — ${profile.address.estado}`,
          profile.address.cep,
        ].join(' · ')
      : 'Não informado'

    return (
      <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full">
        <div className="bg-white rounded-card shadow-card p-6">
          <div className="flex items-center gap-4 mb-5">
            <Avatar size="lg" className="w-14 h-14">
              <AvatarFallback className="bg-primary text-white font-display font-black text-xl">
                {(profile.nomeFantasia || 'F').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-display font-black text-lg text-brand-text">
                {profile.nomeFantasia || 'Nome fantasia não informado'}
              </p>
            </div>
          </div>

          <Separator />
          <InfoRow
            icon={CreditCard}
            label="CNPJ"
            value={profile.cnpj ? maskCnpj(profile.cnpj) : 'Não informado'}
          />
          <Separator />
          <InfoRow icon={Building2} label="Razão social" value={profile.razaoSocial || 'Não informada'} />
          <Separator />
          <InfoRow
            icon={Phone}
            label="Telefone"
            value={profile.phone ? formatPhone(profile.phone) : 'Não informado'}
          />
          <Separator />
          <InfoRow icon={MapPin} label="Endereço" value={fullAddress} />
        </div>

        <button
          onClick={handleEditClick}
          className="w-full py-3 rounded-xl border-2 border-primary text-primary-dark font-display font-bold text-sm hover:bg-primary-light transition-colors"
        >
          Editar perfil
        </button>
      </div>
    )
  }

  // Formulário de edição
  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full">
      <div className="bg-white rounded-card shadow-card p-6 space-y-5">
        <h3 className="font-display font-bold text-lg text-brand-text">Editar Perfil</h3>

        <div>
          <label className="block text-sm font-semibold text-brand-text mb-2">Nome fantasia</label>
          <input
            type="text"
            value={editData.nomeFantasia || ''}
            onChange={(e) => {
              setEditData({ ...editData, nomeFantasia: e.target.value })
              if (errors.nomeFantasia) setErrors({ ...errors, nomeFantasia: '' })
            }}
            className={`w-full px-3 py-2 border-2 rounded-lg text-sm focus:outline-none ${
              errors.nomeFantasia ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
            }`}
          />
          {errors.nomeFantasia && <p className="text-xs text-red-600 mt-1">{errors.nomeFantasia}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-brand-text mb-2">Razão social</label>
          <input
            type="text"
            value={editData.razaoSocial || ''}
            onChange={(e) => {
              setEditData({ ...editData, razaoSocial: e.target.value })
              if (errors.razaoSocial) setErrors({ ...errors, razaoSocial: '' })
            }}
            className={`w-full px-3 py-2 border-2 rounded-lg text-sm focus:outline-none ${
              errors.razaoSocial ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
            }`}
          />
          {errors.razaoSocial && <p className="text-xs text-red-600 mt-1">{errors.razaoSocial}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-brand-text mb-2">E-mail (readonly)</label>
          <input
            type="email"
            value={profile.email || ''}
            disabled
            className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg text-sm bg-slate-50 opacity-50 cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-brand-text mb-2">CNPJ</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={18}
            value={editData.cnpj || ''}
            onChange={(e) => {
              const masked = maskCNPJInput(e.target.value)
              setEditData({ ...editData, cnpj: masked })
              if (errors.cnpj) setErrors({ ...errors, cnpj: '' })
            }}
            placeholder="00.000.000/0000-00"
            className={`w-full px-3 py-2 border-2 rounded-lg text-sm focus:outline-none ${
              errors.cnpj ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
            }`}
          />
          {errors.cnpj && <p className="text-xs text-red-600 mt-1">{errors.cnpj}</p>}
        </div>

        <div>
          <label className="block text-sm font-semibold text-brand-text mb-2">Telefone</label>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={15}
            value={editData.phone || ''}
            onChange={(e) => {
              const masked = maskPhoneBR(e.target.value)
              setEditData({ ...editData, phone: masked })
              if (errors.phone) setErrors({ ...errors, phone: '' })
            }}
            placeholder="(11) 99999-9999"
            className={`w-full px-3 py-2 border-2 rounded-lg text-sm focus:outline-none ${
              errors.phone ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
            }`}
          />
          {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
        </div>

        <div>
          <h4 className="font-semibold text-sm text-brand-text mb-3">Endereço</h4>
          <div className="space-y-3">
            <input
              type="text"
              value={editData.address?.logradouro || ''}
              onChange={(e) => {
                setEditData({
                  ...editData,
                  address: { ...getOrEmptyAddress(editData.address), logradouro: e.target.value },
                })
                if (errors.logradouro) setErrors({ ...errors, logradouro: '' })
              }}
              placeholder="Logradouro"
              className={`w-full px-3 py-2 border-2 rounded-lg text-sm focus:outline-none ${
                errors.logradouro ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
              }`}
            />
            {errors.logradouro && <p className="text-xs text-red-600 -mt-2">{errors.logradouro}</p>}

            <div className="grid grid-cols-3 gap-3">
              <input
                type="text"
                value={editData.address?.numero || ''}
                onChange={(e) => {
                  setEditData({
                    ...editData,
                    address: { ...getOrEmptyAddress(editData.address), numero: e.target.value },
                  })
                  if (errors.numero) setErrors({ ...errors, numero: '' })
                }}
                placeholder="Número"
                className={`px-3 py-2 border-2 rounded-lg text-sm focus:outline-none ${
                  errors.numero ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
                }`}
              />
              <input
                type="text"
                value={editData.address?.cep || ''}
                onChange={(e) => {
                  const formatted = formatCEP(e.target.value)
                  setEditData({
                    ...editData,
                    address: { ...getOrEmptyAddress(editData.address), cep: formatted },
                  })
                  if (errors.cep) setErrors({ ...errors, cep: '' })
                }}
                placeholder="CEP"
                className={`px-3 py-2 border-2 rounded-lg text-sm focus:outline-none ${
                  errors.cep ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
                }`}
              />
              <input
                type="text"
                value={editData.address?.estado || ''}
                onChange={(e) => {
                  setEditData({
                    ...editData,
                    address: { ...getOrEmptyAddress(editData.address), estado: e.target.value.toUpperCase() },
                  })
                  if (errors.estado) setErrors({ ...errors, estado: '' })
                }}
                placeholder="UF"
                maxLength={2}
                className={`px-3 py-2 border-2 rounded-lg text-sm focus:outline-none ${
                  errors.estado ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
                }`}
              />
            </div>
            {(errors.numero || errors.cep || errors.estado) && (
              <p className="text-xs text-red-600">{errors.numero || errors.cep || errors.estado}</p>
            )}

            <input
              type="text"
              value={editData.address?.bairro || ''}
              onChange={(e) => {
                setEditData({
                  ...editData,
                  address: { ...getOrEmptyAddress(editData.address), bairro: e.target.value },
                })
                if (errors.bairro) setErrors({ ...errors, bairro: '' })
              }}
              placeholder="Bairro"
              className={`w-full px-3 py-2 border-2 rounded-lg text-sm focus:outline-none ${
                errors.bairro ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
              }`}
            />
            {errors.bairro && <p className="text-xs text-red-600 -mt-2">{errors.bairro}</p>}

            <input
              type="text"
              value={editData.address?.cidade || ''}
              onChange={(e) => {
                setEditData({
                  ...editData,
                  address: { ...getOrEmptyAddress(editData.address), cidade: e.target.value },
                })
                if (errors.cidade) setErrors({ ...errors, cidade: '' })
              }}
              placeholder="Cidade"
              className={`w-full px-3 py-2 border-2 rounded-lg text-sm focus:outline-none ${
                errors.cidade ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
              }`}
            />
            {errors.cidade && <p className="text-xs text-red-600 -mt-2">{errors.cidade}</p>}

            <input
              type="text"
              value={editData.address?.complemento || ''}
              onChange={(e) => {
                setEditData({
                  ...editData,
                  address: { ...getOrEmptyAddress(editData.address), complemento: e.target.value },
                })
              }}
              placeholder="Complemento (opcional)"
              className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="flex-1 py-3 rounded-xl border-2 border-slate-300 text-slate-700 font-display font-bold text-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 py-3 rounded-xl bg-primary text-white font-display font-bold text-sm hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {isSaving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}
