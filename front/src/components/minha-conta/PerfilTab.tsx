// src/components/minha-conta/PerfilTab.tsx
'use client'

import { useState } from 'react'
import { Mail, MapPin, Phone, CreditCard, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { useAuth, type UserProfile } from '@/contexts/auth-context'
import { isValidCPF, isProfileComplete } from '@/lib/utils'


function maskCpfDisplay(cpf?: string): string {
  if (!cpf) return 'Não informado'
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return cpf
  return `***.***.${digits.slice(6)}`
}

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

function maskCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

function maskPhoneBR(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  // 8-10 dígitos: (00) 0000-0000
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  // 11 dígitos: (00) 00000-0000
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

export default function PerfilTab({ returnTo }: { returnTo?: string }) {
  const { profile, updateProfile } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editData, setEditData] = useState<UserProfile>(profile || {
    role: 'comprador',
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
  const [showAddCard, setShowAddCard] = useState(false)
  const [newCardName, setNewCardName] = useState('')
  const [newCardNumber, setNewCardNumber] = useState('')
  const [newCardExpiry, setNewCardExpiry] = useState('')
  const [newCardCvv, setNewCardCvv] = useState('')
  const [isSavingCard, setIsSavingCard] = useState(false)

  async function handleAddCard() {
    if (!newCardName.trim() || !newCardNumber.trim() || !newCardExpiry.trim() || !newCardCvv.trim()) {
      toast.error('Preencha todos os campos do cartão')
      return
    }

    const cleanNumber = newCardNumber.replace(/\D/g, '')
    if (cleanNumber.length < 13 || cleanNumber.length > 19) {
      toast.error('Número de cartão inválido')
      return
    }

    const brand = cleanNumber.startsWith('4')
      ? 'Visa'
      : cleanNumber.startsWith('5')
      ? 'Mastercard'
      : 'Elo'

    const newCard = {
      id: `card-${Date.now()}`,
      brand,
      last4: cleanNumber.slice(-4),
      holderName: newCardName.toUpperCase(),
      expirationDate: newCardExpiry,
    }

    try {
      setIsSavingCard(true)
      const existingCards = profile?.savedCards || []
      await updateProfile({
        savedCards: [...existingCards, newCard],
      })
      toast.success('Cartão adicionado com sucesso!')
      setShowAddCard(false)
      setNewCardName('')
      setNewCardNumber('')
      setNewCardExpiry('')
      setNewCardCvv('')
    } catch (err) {
      console.error('Erro ao salvar cartão:', err)
      toast.error('Erro ao salvar cartão')
    } finally {
      setIsSavingCard(false)
    }
  }

  async function handleRemoveCard(cardId: string) {
    try {
      const existingCards = profile?.savedCards || []
      const filtered = existingCards.filter((c) => c.id !== cardId)
      await updateProfile({
        savedCards: filtered,
      })
      toast.success('Cartão removido com sucesso!')
    } catch (err) {
      console.error('Erro ao remover cartão:', err)
      toast.error('Erro ao remover cartão')
    }
  }

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

    // Validar CPF
    if (!editData.cpf?.trim()) {
      newErrors.cpf = 'CPF é obrigatório'
    } else {
      const cpfDigits = editData.cpf.replace(/\D/g, '')
      if (cpfDigits.length !== 11) {
        newErrors.cpf = 'CPF deve ter 11 dígitos'
      } else if (!isValidCPF(editData.cpf)) {
        newErrors.cpf = 'CPF inválido'
      }
    }

    // Validar campos obrigatórios do perfil
    if (!editData.phone?.trim()) {
      newErrors.phone = 'Telefone é obrigatório'
    } else {
      const phoneDigits = editData.phone.replace(/\D/g, '')
      if (![10, 11].includes(phoneDigits.length)) {
        newErrors.phone = 'Telefone deve ter DDD + número (10 ou 11 dígitos)'
      }
    }

    if (!editData.address?.logradouro?.trim()) {
      newErrors.logradouro = 'Logradouro é obrigatório'
    }
    if (!editData.address?.numero?.trim()) {
      newErrors.numero = 'Número é obrigatório'
    }
    if (!editData.address?.bairro?.trim()) {
      newErrors.bairro = 'Bairro é obrigatório'
    }
    if (!editData.address?.cidade?.trim()) {
      newErrors.cidade = 'Cidade é obrigatória'
    }
    if (!editData.address?.estado?.trim()) {
      newErrors.estado = 'Estado é obrigatório'
    }
    if (!editData.address?.cep?.trim()) {
      newErrors.cep = 'CEP é obrigatório'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    try {
      setIsSaving(true)
      await updateProfile({
        name: editData.name || profile?.name || '',
        cpf: editData.cpf,
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
    const profileComplete = isProfileComplete(profile)
    const fullAddress = profile.address
      ? [
          `${profile.address.logradouro}, ${profile.address.numero}${profile.address.complemento ? ` — ${profile.address.complemento}` : ''}`,
          `${profile.address.bairro}, ${profile.address.cidade} — ${profile.address.estado}`,
          profile.address.cep,
        ].join(' · ')
      : 'Não informado'

    return (
      <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full">
        {returnTo && !profileComplete && (
          <div className="bg-accent/10 border-2 border-accent rounded-card p-4">
            <p className="text-sm font-semibold text-accent-dark">
              Complete seu perfil (endereço, CPF e telefone) para finalizar a compra.
            </p>
          </div>
        )}

        {!profileComplete && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-card p-4">
            <p className="text-sm font-semibold text-yellow-900">
              ⚠️ Seu perfil está incompleto. Edite seus dados para continuar.
            </p>
          </div>
        )}

        <div className="bg-white rounded-card shadow-card p-6">
          {/* Avatar + nome */}
          <div className="flex items-center gap-4 mb-5">
            <Avatar size="lg" className="w-14 h-14">
              <AvatarFallback className="bg-primary text-white font-display font-black text-xl">
                {(profile.name || 'U').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-display font-black text-lg text-brand-text">{profile.name}</p>
              <p className="text-xs text-brand-muted">
                {profile.createdAt ? `Membro desde ${new Date(profile.createdAt).toLocaleDateString('pt-BR')}` : 'Membro'}
              </p>
            </div>
          </div>

          <Separator />
          <InfoRow icon={Mail} label="E-mail" value={profile.email} />
          <Separator />
          <InfoRow icon={CreditCard} label="CPF" value={maskCpfDisplay(profile.cpf)} />
          <Separator />
          <InfoRow icon={Phone} label="Telefone" value={profile.phone ? formatPhone(profile.phone) : 'Não informado'} />
          <Separator />
          <InfoRow icon={MapPin} label="Endereço de cadastro" value={fullAddress} />
        </div>

        {/* Seção de Cartões Salvos */}
        <div className="bg-white rounded-card shadow-card p-6 mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-black text-lg text-brand-text flex items-center gap-2">
              <CreditCard size={20} className="text-primary-dark" />
              Cartões de Crédito Salvos
            </h3>
            {!showAddCard && (
              <button
                onClick={() => setShowAddCard(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-light hover:bg-primary/20 text-primary-dark font-semibold text-xs transition-colors"
              >
                <Plus size={14} />
                Adicionar
              </button>
            )}
          </div>

          {/* Lista de cartões */}
          {(!profile.savedCards || profile.savedCards.length === 0) && !showAddCard ? (
            <p className="text-sm text-brand-muted py-2">
              Nenhum cartão cadastrado. Adicione um cartão para agilizar suas compras.
            </p>
          ) : (
            <div className="space-y-3 mb-4">
              {(profile.savedCards || []).map((card) => (
                <div
                  key={card.id}
                  className="flex items-center justify-between p-4 rounded-xl border-2 border-slate-100 hover:border-primary/20 transition-colors bg-slate-50/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-xs uppercase text-slate-500 shadow-sm">
                      {card.brand}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-brand-text">
                        •••• •••• •••• {card.last4}
                      </p>
                      <p className="text-xs text-brand-muted mt-0.5">
                        {card.holderName} · Expira em {card.expirationDate}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveCard(card.id)}
                    className="p-2 rounded-lg hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors"
                    title="Remover Cartão"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Formulário de adicionar cartão */}
          {showAddCard && (
            <div className="border-t border-slate-100 pt-4 mt-4 space-y-4">
              <h4 className="font-semibold text-sm text-brand-text">Novo Cartão de Crédito</h4>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Nome Impresso no Cartão"
                  value={newCardName}
                  onChange={(e) => setNewCardName(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Número do Cartão"
                  maxLength={19}
                  value={newCardNumber}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '')
                    setNewCardNumber(digits)
                  }}
                  className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Validade (MM/AA)"
                    maxLength={5}
                    value={newCardExpiry}
                    onChange={(e) => {
                      let val = e.target.value.replace(/\D/g, '')
                      if (val.length > 2) {
                        val = `${val.slice(0, 2)}/${val.slice(2, 4)}`
                      }
                      setNewCardExpiry(val)
                    }}
                    className="px-3 py-2 border-2 border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none"
                  />
                  <input
                    type="password"
                    placeholder="CVV"
                    maxLength={4}
                    value={newCardCvv}
                    onChange={(e) => setNewCardCvv(e.target.value.replace(/\D/g, ''))}
                    className="px-3 py-2 border-2 border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={isSavingCard}
                  onClick={() => setShowAddCard(false)}
                  className="flex-1 py-2 rounded-lg border-2 border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  disabled={isSavingCard}
                  onClick={handleAddCard}
                  className="flex-1 py-2 rounded-lg bg-primary text-white font-semibold text-xs hover:bg-primary-dark transition-colors"
                >
                  {isSavingCard ? 'Salvando...' : 'Salvar Cartão'}
                </button>
              </div>
            </div>
          )}
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

        {/* Nome */}
        <div>
          <label className="block text-sm font-semibold text-brand-text mb-2">Nome</label>
          <input
            type="text"
            value={editData.name || ''}
            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
            className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none"
          />
        </div>

        {/* E-mail (readonly) */}
        <div>
          <label className="block text-sm font-semibold text-brand-text mb-2">E-mail (readonly)</label>
          <input
            type="email"
            value={profile.email || ''}
            disabled
            className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg text-sm bg-slate-50 opacity-50 cursor-not-allowed"
          />
        </div>

        {/* CPF */}
        <div>
          <label className="block text-sm font-semibold text-brand-text mb-2">CPF</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={14}
            value={editData.cpf || ''}
            onChange={(e) => {
              const masked = maskCPF(e.target.value)
              setEditData({ ...editData, cpf: masked })
              if (errors.cpf) setErrors({ ...errors, cpf: '' })
            }}
            placeholder="000.000.000-00"
            className={`w-full px-3 py-2 border-2 rounded-lg text-sm focus:outline-none ${
              errors.cpf ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-primary'
            }`}
          />
          {errors.cpf && <p className="text-xs text-red-600 mt-1">{errors.cpf}</p>}
        </div>

        {/* Telefone */}
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

        {/* Endereço */}
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
              <p className="text-xs text-red-600">
                {errors.numero || errors.cep || errors.estado}
              </p>
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

      {/* Botões */}
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
