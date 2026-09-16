import { auth } from '@/lib/firebase'

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? ''

function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await auth.currentUser?.getIdToken()
  const headers = new Headers(init.headers)
  if (!headers.has('X-Request-Id')) {
    headers.set('X-Request-Id', generateRequestId())
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  return fetch(`${BASE_URL}${path}`, { ...init, headers })
}
