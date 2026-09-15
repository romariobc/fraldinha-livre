import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { createAuthMiddleware } from '../src/middleware/auth'
import { createAuthClaimHandler, type ProvisionClaimsFn, type LookupClaimsFn } from '../src/routes/auth'
import { productsPostHandler } from '../src/routes/products'
import type { Env, AppContext } from '../src/env'

describe('POST /auth/claim — Provisionamento Seguro de Custom Claims (AUTH-001)', () => {
  let mockProvisionClaims: ReturnType<typeof vi.fn<ProvisionClaimsFn>>
  let mockLookupClaims: ReturnType<typeof vi.fn<LookupClaimsFn>>

  beforeEach(() => {
    mockProvisionClaims = vi.fn<ProvisionClaimsFn>().mockResolvedValue(undefined)
    mockLookupClaims = vi.fn<LookupClaimsFn>().mockResolvedValue(null)
  })

  const createTestApp = () => {
    const fakeVerify = async (token: string) => {
      if (token === 'token-novo-usuario') {
        return { uid: 'uid-novo-123' } // Sem claims/role
      }
      if (token === 'token-comprador-existente') {
        return { uid: 'uid-comprador-456', role: 'comprador', claims: { comprador: true, role: 'comprador' } }
      }
      if (token === 'token-fornecedor-existente') {
        return { uid: 'uid-fornecedor-789', role: 'fornecedor', claims: { fornecedor: true, role: 'fornecedor' } }
      }
      return null
    }

    const testApp = new Hono<{ Bindings: Env; Variables: AppContext['Variables'] }>()

    testApp.use('/auth/*', createAuthMiddleware(fakeVerify))
    testApp.post(
      '/auth/claim',
      createAuthClaimHandler({
        provisionClaims: mockProvisionClaims,
        lookupClaims: mockLookupClaims,
      }),
    )

    // Rota protegida por RBAC para testar o ciclo ponta a ponta
    testApp.use('/products', createAuthMiddleware(fakeVerify))
    testApp.post('/products', productsPostHandler)

    return testApp
  }

  // -------------------------------------------------------------
  // 1. Autenticação (401)
  // -------------------------------------------------------------
  it('1. Requisição sem token de autenticação → 401 Unauthorized', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/auth/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'comprador' }),
    })

    const response = await app.fetch(request)
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ error: 'unauthorized' })
    expect(mockProvisionClaims).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------
  // 2. Validação estrita de roles (Prevenção de escalada e strings arbitrárias)
  // -------------------------------------------------------------
  it('2. Tentativa de solicitar role "admin" → 400 Bad Request', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/auth/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-novo-usuario',
      },
      body: JSON.stringify({ role: 'admin' }),
    })

    const response = await app.fetch(request)
    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: string }
    expect(body.error).toBe('invalid request')
    expect(mockProvisionClaims).not.toHaveBeenCalled()
  })

  it('3. Tentativa de solicitar role arbitrária → 400 Bad Request', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/auth/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-novo-usuario',
      },
      body: JSON.stringify({ role: 'super_gestor' }),
    })

    const response = await app.fetch(request)
    expect(response.status).toBe(400)
    expect(mockProvisionClaims).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------
  // 3. Prevenção de UID Spoofing
  // -------------------------------------------------------------
  it('4. UID no body é ignorado: o provisionamento usa exclusivamente o UID autenticado do token', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/auth/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-novo-usuario',
      },
      body: JSON.stringify({
        role: 'fornecedor',
        uid: 'uid-vitima-ataque', // Tentativa de injetar outro UID
      }),
    })

    const response = await app.fetch(request)
    expect(response.status).toBe(200)
    // Verifica que foi chamado com 'uid-novo-123' (do token) e NUNCA 'uid-vitima-ataque'
    expect(mockProvisionClaims).toHaveBeenCalledWith('uid-novo-123', {
      role: 'fornecedor',
      fornecedor: true,
    })
  })

  // -------------------------------------------------------------
  // 4. Fluxos legítimos de provisionamento inicial
  // -------------------------------------------------------------
  it('5. Usuário novo solicita role "comprador" → provisiona com sucesso (200)', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/auth/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-novo-usuario',
      },
      body: JSON.stringify({ role: 'comprador' }),
    })

    const response = await app.fetch(request)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ success: true, role: 'comprador', alreadyProvisioned: false })
    expect(mockProvisionClaims).toHaveBeenCalledWith('uid-novo-123', {
      role: 'comprador',
      comprador: true,
    })
  })

  it('6. Usuário novo solicita role "fornecedor" → provisiona com sucesso (200)', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/auth/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-novo-usuario',
      },
      body: JSON.stringify({ role: 'fornecedor' }),
    })

    const response = await app.fetch(request)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ success: true, role: 'fornecedor', alreadyProvisioned: false })
    expect(mockProvisionClaims).toHaveBeenCalledWith('uid-novo-123', {
      role: 'fornecedor',
      fornecedor: true,
    })
  })

  // -------------------------------------------------------------
  // 5. Idempotência e Bloqueio de Troca de Papel
  // -------------------------------------------------------------
  it('7. Chamada repetida com a mesma role → idempotente (200, alreadyProvisioned: true)', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/auth/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-fornecedor-existente',
      },
      body: JSON.stringify({ role: 'fornecedor' }),
    })

    const response = await app.fetch(request)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ success: true, role: 'fornecedor', alreadyProvisioned: true })
    // Como o token já possui a role correta, não precisa chamar novamente o Identity Toolkit
    expect(mockProvisionClaims).not.toHaveBeenCalled()
  })

  it('8. Usuário comprador tentando trocar para fornecedor → 409 Conflict', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/auth/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-comprador-existente',
      },
      body: JSON.stringify({ role: 'fornecedor' }),
    })

    const response = await app.fetch(request)
    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body).toEqual({ error: 'role change not allowed' })
    expect(mockProvisionClaims).not.toHaveBeenCalled()
  })

  it('9. Usuário fornecedor tentando trocar para comprador → 409 Conflict', async () => {
    const app = createTestApp()
    const request = new Request('http://localhost/auth/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-fornecedor-existente',
      },
      body: JSON.stringify({ role: 'comprador' }),
    })

    const response = await app.fetch(request)
    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body).toEqual({ error: 'role change not allowed' })
    expect(mockProvisionClaims).not.toHaveBeenCalled()
  })

  it('10. Idempotência via Identity Toolkit lookup (usuário com token desatualizado mas claim já gravado)', async () => {
    mockLookupClaims.mockResolvedValueOnce({
      customAttributes: { role: 'fornecedor', fornecedor: true },
    })

    const app = createTestApp()
    const request = new Request('http://localhost/auth/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-novo-usuario', // Token local ainda não tem claims
      },
      body: JSON.stringify({ role: 'fornecedor' }),
    })

    const response = await app.fetch(request)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ success: true, role: 'fornecedor', alreadyProvisioned: true })
    // Já estava gravado no servidor Google, no-op
    expect(mockProvisionClaims).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------
  // 6. Resiliência e falhas de infraestrutura (502 Bad Gateway)
  // -------------------------------------------------------------
  it('11. Falha ao comunicar com Identity Toolkit da Google → 502 Bad Gateway (permite retry)', async () => {
    mockProvisionClaims.mockRejectedValueOnce(new Error('Network failure'))

    const app = createTestApp()
    const request = new Request('http://localhost/auth/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-novo-usuario',
      },
      body: JSON.stringify({ role: 'comprador' }),
    })

    const response = await app.fetch(request)
    expect(response.status).toBe(502)
    const body = await response.json()
    expect(body).toEqual({ error: 'failed to provision claims' })
  })
})
