/// <reference types="vitest/globals" />
import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Modelo conceitual e invariantes de segurança espelhados de firestore.rules
 */
const ALLOWED_PROFILE_KEYS = [
  'role', 'name', 'email', 'cpf', 'cnpj', 'razaoSocial',
  'nomeFantasia', 'phone', 'address', 'savedCards',
  'lastPurchase', 'createdAt', 'updatedAt',
]

const ALLOWED_CREATE_KEYS = ['role', 'name', 'email', 'createdAt']

function hasOnly(keys: string[], allowed: string[]): boolean {
  return keys.every((k) => allowed.includes(k))
}

interface UserAuth {
  uid: string
  token?: {
    admin?: boolean
    role?: string
  }
}

interface FirestoreContext {
  auth: UserAuth | null
  resource?: {
    data: Record<string, unknown>
  }
}

function evaluateIsAdmin(ctx: FirestoreContext): boolean {
  if (!ctx.auth) return false
  return Boolean(
    ctx.auth.token?.admin === true ||
    ctx.auth.token?.role === 'admin' ||
    ctx.auth.uid === 'KOQclmb5eshfkufioK03ayRh6Fi2'
  )
}

function evaluateRead(ctx: FirestoreContext, targetUid: string): boolean {
  if (!ctx.auth) return false
  return ctx.auth.uid === targetUid || evaluateIsAdmin(ctx)
}

function evaluateCreate(ctx: FirestoreContext, targetUid: string, newData: Record<string, unknown>): boolean {
  if (!ctx.auth || ctx.auth.uid !== targetUid) return false

  const keys = Object.keys(newData)
  if (!hasOnly(keys, ALLOWED_CREATE_KEYS)) return false

  if (newData.role !== 'comprador' && newData.role !== 'fornecedor') return false

  if (typeof newData.name !== 'string' || newData.name.length === 0 || newData.name.length > 120) return false

  if (newData.email !== undefined && newData.email !== null) {
    if (typeof newData.email !== 'string' || newData.email.length > 120) return false
  }

  if (newData.createdAt !== undefined) {
    if (typeof newData.createdAt !== 'string' || newData.createdAt.length > 50) return false
  }

  return true
}

function evaluateUpdate(ctx: FirestoreContext, targetUid: string, newData: Record<string, unknown>): boolean {
  if (!ctx.auth || ctx.auth.uid !== targetUid) return false
  if (!ctx.resource || !ctx.resource.data) return false

  const existing = ctx.resource.data
  const keys = Object.keys(newData)
  if (!hasOnly(keys, ALLOWED_PROFILE_KEYS)) return false

  // Role é imutável
  if (newData.role !== existing.role) return false

  // Não pode ser papel não-autorizado
  if (newData.role !== 'comprador' && newData.role !== 'fornecedor') return false

  if (typeof newData.name !== 'string' || newData.name.length === 0 || newData.name.length > 120) return false

  if (newData.email !== undefined && newData.email !== null) {
    if (typeof newData.email !== 'string' || newData.email.length > 120) return false
  }

  if (newData.phone !== undefined && (typeof newData.phone !== 'string' || newData.phone.length > 30)) return false
  if (newData.cpf !== undefined && (typeof newData.cpf !== 'string' || newData.cpf.length > 20)) return false
  if (newData.cnpj !== undefined && (typeof newData.cnpj !== 'string' || newData.cnpj.length > 25)) return false
  if (newData.razaoSocial !== undefined && (typeof newData.razaoSocial !== 'string' || newData.razaoSocial.length > 150)) return false
  if (newData.nomeFantasia !== undefined && (typeof newData.nomeFantasia !== 'string' || newData.nomeFantasia.length > 150)) return false

  if (newData.savedCards !== undefined) {
    if (!Array.isArray(newData.savedCards) || newData.savedCards.length > 10) return false
  }

  if (newData.updatedAt !== undefined && (typeof newData.updatedAt !== 'string' || newData.updatedAt.length > 50)) return false

  return true
}

describe('Firestore Rules — Invariantes de Segurança e Contrato (SEC-003)', () => {
  it('arquivo firestore.rules contém as cláusulas mandatórias de segurança', () => {
    const rulesPath = path.resolve(process.cwd(), '..', 'firestore.rules')
    const content = fs.existsSync(rulesPath)
      ? fs.readFileSync(rulesPath, 'utf8')
      : fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8')

    expect(content).toContain("data.role in ['comprador', 'fornecedor']")
    expect(content).toContain('allow delete: if false;')
    expect(content).toContain('data.keys().hasOnly(allowedCreateKeys())')
    expect(content).toContain('data.keys().hasOnly(allowedProfileKeys())')
    expect(content).toContain('data.role == resource.data.role')
    expect(content).toContain('request.auth.uid == uid')
  })

  describe('Criação de Documento (allow create)', () => {
    const uid = 'user-123'
    const validComprador = {
      role: 'comprador',
      name: 'João da Silva',
      email: 'joao@email.com',
      createdAt: new Date().toISOString(),
    }

    it('criação válida de comprador é aceita', () => {
      const ctx: FirestoreContext = { auth: { uid } }
      expect(evaluateCreate(ctx, uid, validComprador)).toBe(true)
    })

    it('criação válida de fornecedor é aceita', () => {
      const ctx: FirestoreContext = { auth: { uid } }
      expect(evaluateCreate(ctx, uid, { ...validComprador, role: 'fornecedor' })).toBe(true)
    })

    it('criação com role: admin é NEGADA', () => {
      const ctx: FirestoreContext = { auth: { uid } }
      expect(evaluateCreate(ctx, uid, { ...validComprador, role: 'admin' })).toBe(false)
    })

    it('criação com role arbitrária é NEGADA', () => {
      const ctx: FirestoreContext = { auth: { uid } }
      expect(evaluateCreate(ctx, uid, { ...validComprador, role: 'superadmin' })).toBe(false)
    })

    it('criação com campos desconhecidos (ex: isAdmin, saldo) é NEGADA por hasOnly', () => {
      const ctx: FirestoreContext = { auth: { uid } }
      expect(evaluateCreate(ctx, uid, { ...validComprador, isAdmin: true })).toBe(false)
      expect(evaluateCreate(ctx, uid, { ...validComprador, saldo: 99999 })).toBe(false)
    })

    it('criação com nome vazio ou acima do limite (>120 chars) é NEGADA', () => {
      const ctx: FirestoreContext = { auth: { uid } }
      expect(evaluateCreate(ctx, uid, { ...validComprador, name: '' })).toBe(false)
      expect(evaluateCreate(ctx, uid, { ...validComprador, name: 'A'.repeat(121) })).toBe(false)
    })

    it('criação tentando gravar perfil de outro usuário é NEGADA (violação de ownership)', () => {
      const ctx: FirestoreContext = { auth: { uid: 'user-outro' } }
      expect(evaluateCreate(ctx, uid, validComprador)).toBe(false)
    })

    it('criação desautenticada é NEGADA', () => {
      const ctx: FirestoreContext = { auth: null }
      expect(evaluateCreate(ctx, uid, validComprador)).toBe(false)
    })
  })

  describe('Atualização de Documento (allow update)', () => {
    const uid = 'user-123'
    const existing = {
      role: 'comprador',
      name: 'João',
      email: 'joao@email.com',
    }

    it('atualização válida de dados cadastrais é aceita', () => {
      const ctx: FirestoreContext = {
        auth: { uid },
        resource: { data: existing },
      }
      expect(evaluateUpdate(ctx, uid, {
        ...existing,
        name: 'João Silva',
        phone: '11999999999',
        updatedAt: new Date().toISOString(),
      })).toBe(true)
    })

    it('tentativa de alterar role (ex: comprador -> admin) é NEGADA', () => {
      const ctx: FirestoreContext = {
        auth: { uid },
        resource: { data: existing },
      }
      expect(evaluateUpdate(ctx, uid, {
        ...existing,
        role: 'admin',
      })).toBe(false)
    })

    it('tentativa de alterar role (ex: comprador -> fornecedor) é NEGADA', () => {
      const ctx: FirestoreContext = {
        auth: { uid },
        resource: { data: existing },
      }
      expect(evaluateUpdate(ctx, uid, {
        ...existing,
        role: 'fornecedor',
      })).toBe(false)
    })

    it('atualização contendo campos estranhos ao domínio é NEGADA', () => {
      const ctx: FirestoreContext = {
        auth: { uid },
        resource: { data: existing },
      }
      expect(evaluateUpdate(ctx, uid, {
        ...existing,
        campoInvasor: 'valor',
      })).toBe(false)
    })

    it('atualização tentando alterar perfil de outro usuário é NEGADA', () => {
      const ctx: FirestoreContext = {
        auth: { uid: 'user-atacante' },
        resource: { data: existing },
      }
      expect(evaluateUpdate(ctx, uid, {
        ...existing,
        name: 'Alterado',
      })).toBe(false)
    })
  })

  describe('Leitura e Acesso (allow read)', () => {
    const uid = 'user-123'

    it('usuário autenticado consegue ler o próprio perfil', () => {
      const ctx: FirestoreContext = { auth: { uid } }
      expect(evaluateRead(ctx, uid)).toBe(true)
    })

    it('usuário comum NÃO consegue ler o perfil de outro usuário', () => {
      const ctx: FirestoreContext = { auth: { uid: 'user-comum-outro' } }
      expect(evaluateRead(ctx, uid)).toBe(false)
    })

    it('usuário não autenticado NÃO consegue ler nenhum perfil', () => {
      const ctx: FirestoreContext = { auth: null }
      expect(evaluateRead(ctx, uid)).toBe(false)
    })

    it('administrador com Custom Claim admin: true pode ler perfil de qualquer usuário', () => {
      const ctx: FirestoreContext = {
        auth: {
          uid: 'admin-claim-uid',
          token: { admin: true },
        },
      }
      expect(evaluateRead(ctx, uid)).toBe(true)
    })

    it('administrador com fallback temporário de UID pode ler perfil de qualquer usuário', () => {
      const ctx: FirestoreContext = {
        auth: {
          uid: 'KOQclmb5eshfkufioK03ayRh6Fi2',
        },
      }
      expect(evaluateRead(ctx, uid)).toBe(true)
    })
  })
})
