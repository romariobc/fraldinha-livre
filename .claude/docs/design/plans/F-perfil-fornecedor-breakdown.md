# Perfil do Fornecedor (identidade Firestore) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao fornecedor logado um perfil real (CNPJ, razão social, nome fantasia, telefone,
endereço) persistido em `users/{uid}` no Firestore, editável numa nova aba "Perfil" no painel do
fornecedor — mesmo padrão da feature 007a (comprador).

**Architecture:** Estende o `UserProfile` já existente (`front/src/contexts/auth-context.tsx`) com
3 campos opcionais novos (`cnpj`, `razaoSocial`, `nomeFantasia`), reaproveitando `phone`/`address`
que já existem. Novo componente `PerfilTab.tsx` em `components/fornecedor/`, mesma estrutura
view/edição do `PerfilTab.tsx` do comprador. Nova aba no painel. Nenhuma mudança em `back/`,
`packages/contracts`, `firestore.rules` ou `market-context.tsx`.

**Tech Stack:** Next.js App Router, React, TypeScript, Firebase/Firestore (via `useAuth()`),
Tailwind, Vitest + React Testing Library + `@testing-library/user-event`.

## Global Constraints

- **Sem trava/gate.** Diferente do comprador, esta aba não bloqueia nenhuma ação — só visualizar e
  editar. Nenhum banner de "perfil incompleto".
- **Sem ligação com `supplierId`.** O perfil gravado não filtra `directOrders`/`offers` do painel
  (continuam vindo de `MOCK_DIRECT_ORDERS`/`MOCK_OFFERS`) nem substitui `MOCK_SUPPLIER` ou
  `STORE_SUPPLIERS`. Isso é proposital — não tocar `market-context.tsx`, `supplier-mock.ts` (exceto
  importar a função pura `maskCnpj` já exportada de lá) nem `suppliers.ts`.
- **Sem campos de geolocalização** (estados/cidades/CEPs de atendimento) — só identidade + 1
  endereço, mesmo formato do comprador.
- **`updateProfile()` já bloqueia escrita de `role` (D-013)** — não duplicar essa lógica, ela já
  existe em `auth-context.tsx:109-130` e cobre qualquer patch novo automaticamente.
- **Não editar o campo `name` do perfil.** É o nome da pessoa que fez onboarding (setado uma vez em
  `onboarding/page.tsx`), distinto de `nomeFantasia` (nome da empresa). O patch de `updateProfile`
  desta feature nunca inclui `name`.
- **Fallback de `editData` inicial deve usar `role: 'fornecedor'`**, não `'comprador'` (achado da
  revisão do spec — copiar o padrão do comprador sem essa troca é um bug de cópia literal).
- **Convenção do projeto:** commits em português, `tsc --noEmit` e `npm run lint` devem sair exit 0
  em `front/` antes de qualquer commit ser considerado pronto.

---

## Task 1: `isValidCNPJ` + extensão do tipo `UserProfile`

**Files:**
- Modify: `front/src/lib/utils.ts` (adicionar função, não tocar `isValidCPF`/`isProfileComplete`)
- Modify: `front/src/contexts/auth-context.tsx:16-33` (adicionar 3 campos opcionais na interface)
- Test: `front/src/lib/__tests__/utils.test.ts` (novo arquivo — não existe teste de `utils.ts` hoje)

**Interfaces:**
- Produces: `isValidCNPJ(cnpj: string): boolean` — usada pela Task 2.
- Produces: `UserProfile.cnpj?: string`, `UserProfile.razaoSocial?: string`,
  `UserProfile.nomeFantasia?: string` — usados pela Task 2.

- [ ] **Step 1: Escrever o teste falho de `isValidCNPJ`**

Criar `front/src/lib/__tests__/utils.test.ts`:

```typescript
/// <reference types="vitest/globals" />

import { describe, it, expect } from 'vitest'
import { isValidCNPJ } from '../utils'

describe('isValidCNPJ', () => {
  it('should accept a valid CNPJ with punctuation', () => {
    expect(isValidCNPJ('11.222.333/0001-81')).toBe(true)
  })

  it('should accept a valid CNPJ with only digits', () => {
    expect(isValidCNPJ('11222333000181')).toBe(true)
  })

  it('should reject a CNPJ with wrong check digits', () => {
    expect(isValidCNPJ('11.222.333/0001-80')).toBe(false)
  })

  it('should reject a CNPJ with repeated digits', () => {
    expect(isValidCNPJ('11111111111111')).toBe(false)
  })

  it('should reject a CNPJ with wrong length', () => {
    expect(isValidCNPJ('123')).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd front && npx vitest run src/lib/__tests__/utils.test.ts`
Expected: FAIL — `isValidCNPJ` não existe em `../utils`.

- [ ] **Step 3: Implementar `isValidCNPJ` em `front/src/lib/utils.ts`**

Adicionar ao final do arquivo (depois de `isProfileComplete`, antes de `safeRedirect`, ou depois de
`safeRedirect` — não importa a ordem, só não remover nada existente):

```typescript
/**
 * Valida um CNPJ brasileiro:
 * - Remove caracteres não dígitos
 * - Rejeita se não tiver exatamente 14 dígitos
 * - Rejeita sequências repetidas (ex: 11111111111111)
 * - Valida os 2 dígitos verificadores com o algoritmo padrão
 */
export function isValidCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '')

  if (digits.length !== 14) return false
  if (/^(\d)\1{13}$/.test(digits)) return false

  const calcCheckDigit = (base: string, weights: number[]): number => {
    let sum = 0
    for (let i = 0; i < weights.length; i++) {
      sum += parseInt(base[i]) * weights[i]
    }
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  const firstDigit = calcCheckDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  if (parseInt(digits[12]) !== firstDigit) return false

  const secondDigit = calcCheckDigit(digits.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  if (parseInt(digits[13]) !== secondDigit) return false

  return true
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd front && npx vitest run src/lib/__tests__/utils.test.ts`
Expected: PASS — 5/5 testes verdes.

- [ ] **Step 5: Estender `UserProfile` em `auth-context.tsx`**

Em `front/src/contexts/auth-context.tsx`, localizar a interface (linhas 16-33):

```typescript
export interface UserProfile {
  role: UserRole;
  name: string;
  email: string;
  cpf?: string;
  phone?: string;
  address?: {
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    estado: string;
    cep: string;
  };
  createdAt?: string;
  updatedAt?: string;
}
```

Substituir por (adiciona 3 campos após `cpf?`, resto idêntico):

```typescript
export interface UserProfile {
  role: UserRole;
  name: string;
  email: string;
  cpf?: string;
  cnpj?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  phone?: string;
  address?: {
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    estado: string;
    cep: string;
  };
  createdAt?: string;
  updatedAt?: string;
}
```

- [ ] **Step 6: Verificar tipos e suíte completa**

Run: `cd front && npx tsc --noEmit`
Expected: exit 0 (nenhum erro — os 3 campos são opcionais, nenhum consumidor existente quebra).

Run: `cd front && npm test`
Expected: todos os testes verdes (288 + 5 novos = 293).

- [ ] **Step 7: Commit**

```bash
git add front/src/lib/utils.ts front/src/lib/__tests__/utils.test.ts front/src/contexts/auth-context.tsx
git commit -m "feat(front): isValidCNPJ + campos de fornecedor no UserProfile"
```

---

## Task 2: Componente `PerfilTab.tsx` do fornecedor

**Files:**
- Create: `front/src/components/fornecedor/PerfilTab.tsx`
- Test: `front/src/components/fornecedor/__tests__/PerfilTab.test.tsx`

**Interfaces:**
- Consumes: `isValidCNPJ(cnpj: string): boolean` (Task 1, de `@/lib/utils`).
- Consumes: `UserProfile` (Task 1, de `@/contexts/auth-context`) com `cnpj?`/`razaoSocial?`/`nomeFantasia?`.
- Consumes: `useAuth()` → `{ profile, updateProfile }` (já existe, sem mudança).
- Consumes: `maskCnpj(cnpj: string): string` (já existe em `@/lib/supplier-mock`, só importar).
- Produces: `export default function PerfilTab()` — sem props, usado pela Task 3.

- [ ] **Step 1: Escrever o teste falho**

Criar `front/src/components/fornecedor/__tests__/PerfilTab.test.tsx`:

```tsx
/// <reference types="vitest/globals" />

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import PerfilTab from '../PerfilTab'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}))

import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'

const mockUseAuth = vi.mocked(useAuth)
const mockUpdateProfile = vi.fn()

const BASE_PROFILE = {
  role: 'fornecedor' as const,
  name: 'Joao Fornecedor',
  email: 'joao@distribuidorasul.com.br',
  cnpj: '11.222.333/0001-81',
  razaoSocial: 'Distribuidora Sul Ltda.',
  nomeFantasia: 'Distribuidora Sul',
  phone: '(11) 98765-4321',
  address: {
    logradouro: 'Av. Paulista',
    numero: '1000',
    bairro: 'Bela Vista',
    cidade: 'São Paulo',
    estado: 'SP',
    cep: '01310-100',
  },
}

function mockAuth(profile: typeof BASE_PROFILE | null) {
  mockUseAuth.mockReturnValue({
    user: null,
    profile,
    role: 'fornecedor',
    loading: false,
    signInGoogle: vi.fn(),
    signOutUser: vi.fn(),
    updateProfile: mockUpdateProfile,
  })
}

describe('PerfilTab (fornecedor)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show loading state when profile is null', () => {
    mockAuth(null)

    render(<PerfilTab />)

    expect(screen.getByText('Carregando perfil...')).toBeInTheDocument()
  })

  it('should render company data masked in view mode', () => {
    mockAuth(BASE_PROFILE)

    render(<PerfilTab />)

    expect(screen.getByText('Distribuidora Sul')).toBeInTheDocument()
    expect(screen.getByText('Distribuidora Sul Ltda.')).toBeInTheDocument()
    expect(screen.getByText('***.222.333/0001-**')).toBeInTheDocument()
  })

  it('should show validation error for invalid CNPJ on save', async () => {
    const user = userEvent.setup()
    mockAuth(BASE_PROFILE)

    render(<PerfilTab />)
    await user.click(screen.getByText('Editar perfil'))

    const cnpjInput = screen.getByPlaceholderText('00.000.000/0000-00')
    await user.clear(cnpjInput)
    await user.type(cnpjInput, '11222333000180') // checksum errado (o valido termina em 81)

    await user.click(screen.getByText('Salvar'))

    expect(await screen.findByText('CNPJ inválido')).toBeInTheDocument()
    expect(mockUpdateProfile).not.toHaveBeenCalled()
  })

  it('should save valid data and show success toast', async () => {
    const user = userEvent.setup()
    mockUpdateProfile.mockResolvedValueOnce(undefined)
    mockAuth(BASE_PROFILE)

    render(<PerfilTab />)
    await user.click(screen.getByText('Editar perfil'))
    await user.click(screen.getByText('Salvar'))

    await waitFor(() =>
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        cnpj: BASE_PROFILE.cnpj,
        razaoSocial: BASE_PROFILE.razaoSocial,
        nomeFantasia: BASE_PROFILE.nomeFantasia,
        phone: BASE_PROFILE.phone,
        address: BASE_PROFILE.address,
      })
    )
    expect(toast.success).toHaveBeenCalledWith('Perfil salvo com sucesso!')
  })

  it('should show error toast when updateProfile rejects', async () => {
    const user = userEvent.setup()
    mockUpdateProfile.mockRejectedValueOnce(new Error('network error'))
    mockAuth(BASE_PROFILE)

    render(<PerfilTab />)
    await user.click(screen.getByText('Editar perfil'))
    await user.click(screen.getByText('Salvar'))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Erro ao salvar perfil'))
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd front && npx vitest run src/components/fornecedor/__tests__/PerfilTab.test.tsx`
Expected: FAIL — módulo `../PerfilTab` não existe.

- [ ] **Step 3: Implementar `front/src/components/fornecedor/PerfilTab.tsx`**

```tsx
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
              <p className="text-xs text-brand-muted">
                {profile.razaoSocial || 'Razão social não informada'}
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
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd front && npx vitest run src/components/fornecedor/__tests__/PerfilTab.test.tsx`
Expected: PASS — 5/5 testes verdes.

- [ ] **Step 5: Rodar tsc/lint/suíte completa**

Run: `cd front && npx tsc --noEmit && npm run lint && npm test`
Expected: todos exit 0 / verdes (293 + 5 = 298 testes).

- [ ] **Step 6: Commit**

```bash
git add front/src/components/fornecedor/PerfilTab.tsx front/src/components/fornecedor/__tests__/PerfilTab.test.tsx
git commit -m "feat(front): aba Perfil do fornecedor (CNPJ/razao social/nome fantasia/endereco)"
```

---

## Task 3: Ligar a aba "Perfil" ao painel do fornecedor

**Files:**
- Modify: `front/src/app/(main)/fornecedor/painel/page.tsx`

**Interfaces:**
- Consumes: `PerfilTab` (Task 2, default export de `@/components/fornecedor/PerfilTab`).

**Nota:** não há `__tests__/` em `fornecedor/painel/` nem em nenhum componente de
`components/fornecedor/` hoje (confirmado — pasta inteira sem testes de página). Esta task não cria
teste de página nova (consistente com o que já existe); a cobertura automatizada real é a do
`PerfilTab.test.tsx` (Task 2). A verificação desta task é rodar a suíte completa + `tsc`/lint
(nada deve quebrar) e uma verificação manual no navegador ao final do plano.

- [ ] **Step 1: Adicionar o import e a 4ª chave de `TabKey`**

Em `front/src/app/(main)/fornecedor/painel/page.tsx`, localizar:

```tsx
import PedidosDiretosTab from '@/components/fornecedor/PedidosDiretosTab'
import OfertasMercadoTab from '@/components/fornecedor/OfertasMercadoTab'
import LogisticaTab      from '@/components/fornecedor/LogisticaTab'

type TabKey = 'diretos' | 'ofertas' | 'logistica'
```

Substituir por:

```tsx
import PedidosDiretosTab from '@/components/fornecedor/PedidosDiretosTab'
import OfertasMercadoTab from '@/components/fornecedor/OfertasMercadoTab'
import LogisticaTab      from '@/components/fornecedor/LogisticaTab'
import PerfilTab         from '@/components/fornecedor/PerfilTab'

type TabKey = 'diretos' | 'ofertas' | 'logistica' | 'perfil'
```

- [ ] **Step 2: Adicionar o `TabsTrigger` "Perfil"**

Localizar o bloco de `TabsTrigger` de "Logística":

```tsx
                <TabsTrigger
                  value="logistica"
                  className="rounded-none px-5 py-3 text-sm font-semibold flex-none whitespace-nowrap"
                >
                  🚚 Logística
                </TabsTrigger>
              </TabsList>
```

Substituir por (adiciona o trigger de Perfil antes do fechamento de `</TabsList>`):

```tsx
                <TabsTrigger
                  value="logistica"
                  className="rounded-none px-5 py-3 text-sm font-semibold flex-none whitespace-nowrap"
                >
                  🚚 Logística
                </TabsTrigger>
                <TabsTrigger
                  value="perfil"
                  className="rounded-none px-5 py-3 text-sm font-semibold flex-none whitespace-nowrap"
                >
                  🏢 Perfil
                </TabsTrigger>
              </TabsList>
```

- [ ] **Step 3: Adicionar o `TabsContent` "Perfil"**

Localizar:

```tsx
              <TabsContent value="logistica">
                <LogisticaTab />
              </TabsContent>
            </div>
          </Tabs>
```

Substituir por:

```tsx
              <TabsContent value="logistica">
                <LogisticaTab />
              </TabsContent>
              <TabsContent value="perfil">
                <PerfilTab />
              </TabsContent>
            </div>
          </Tabs>
```

- [ ] **Step 4: Rodar tsc/lint/suíte completa**

Run: `cd front && npx tsc --noEmit && npm run lint && npm test`
Expected: todos exit 0 / verdes (298 testes, nenhum novo nesta task).

- [ ] **Step 5: Commit**

```bash
git add "front/src/app/(main)/fornecedor/painel/page.tsx"
git commit -m "feat(front): liga aba Perfil ao painel do fornecedor"
```

---

## Task 4: Registro de estado (documentação, sem código)

**Files:**
- Modify: `.claude/context/estado/progresso.md`
- Modify: `.claude/context/estado/feature_list.json`

**Interfaces:** nenhuma — task de documentação, sem dependência de tipos/funções.

- [ ] **Step 1: Atualizar `progresso.md`**

Adicionar uma nova seção "Estado atual" no topo do arquivo registrando: perfil do fornecedor
implementado (CNPJ/razão social/nome fantasia/endereço em `users/{uid}`), aba Perfil no painel,
suíte verde, e a nota de escopo explícita: **dado gravado não tem consumidor ainda — não filtra
`directOrders`/`offers`, não aparece no catálogo do comprador — a amarração `uid↔supplierId` fica
para a feature 007**.

- [ ] **Step 2: Atualizar `feature_list.json`**

Adicionar nota na feature "006" (ou criar entrada específica, se preferir granularidade maior)
registrando a mesma informação: perfil do fornecedor pronto, desconectado de `supplierId` por
decisão consciente, feature 007 ainda `todo`.

- [ ] **Step 3: Validação humana no navegador**

Rodar `npm run dev` no worktree, logar como fornecedor (ou usar uma conta de teste com
`role: fornecedor`), abrir `/fornecedor/painel`, clicar na aba Perfil, preencher CNPJ/razão
social/nome fantasia/telefone/endereço, salvar, dar F5 e confirmar que os dados persistem.
**Importante: avisar que isso não deve mudar nada nas outras 3 abas — é o comportamento esperado
desta fatia**, não um bug.

- [ ] **Step 4: Commit**

```bash
git add .claude/context/estado/progresso.md .claude/context/estado/feature_list.json
git commit -m "docs(estado): perfil do fornecedor implementado (desconectado de supplierId por escopo)"
```
