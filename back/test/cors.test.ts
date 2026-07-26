import { describe, it, expect } from 'vitest'
import { env } from 'cloudflare:workers'
import app from '../src/index'

// O front (localhost:3000 em dev) chama o Worker em *.workers.dev com header
// Authorization — requisicao nao-simples, o navegador SEMPRE faz preflight.
describe('CORS', () => {
  it('OPTIONS /orders (preflight) permite origin localhost com Authorization', async () => {
    const request = new Request('http://localhost/orders', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization',
      },
    })
    const response = await app.fetch(request, env)

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
    expect(response.headers.get('Access-Control-Allow-Headers')?.toLowerCase()).toContain('authorization')
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('PATCH')
  })

  it('OPTIONS /products/:id (preflight) permite PUT e DELETE', async () => {
    const request = new Request('http://localhost/products/1', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'authorization',
      },
    })
    const response = await app.fetch(request, env)

    expect(response.status).toBe(204)
    const allowMethods = response.headers.get('Access-Control-Allow-Methods')
    expect(allowMethods).toContain('PUT')
    expect(allowMethods).toContain('DELETE')
  })

  it('resposta real de /orders carrega Access-Control-Allow-Origin (mesmo em 401)', async () => {
    const request = new Request('http://localhost/orders', {
      headers: { Origin: 'http://localhost:3000' },
    })
    const response = await app.fetch(request, env)

    expect(response.status).toBe(401)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
  })

  it('origin desconhecido nao e refletido', async () => {
    const request = new Request('http://localhost/orders', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://malicioso.example.com',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization',
      },
    })
    const response = await app.fetch(request, env)

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
})
