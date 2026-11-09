import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRemoteJWKSet, jwtVerify } from 'jose'

const origin = new URL(process.env.QA_API_ORIGIN || 'http://127.0.0.1:8796')
assert(origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname))
assert(!origin.username && !origin.password)

function config(path) {
  return Object.fromEntries(fs.readFileSync(new URL(path, import.meta.url), 'utf8')
    .split(/\r?\n/).filter(line => /^[A-Z_0-9]+=/.test(line))
    .map(line => {
      const index = line.indexOf('=')
      return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')]
    }))
}

const qa = config('../.env.qa.local')
const firebase = config('../front/.env.production')
const project = firebase.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))

async function identity(role) {
  const response = await fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + firebase.NEXT_PUBLIC_FIREBASE_API_KEY,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: qa['QA_' + role + '_EMAIL'],
        password: qa['QA_' + role + '_PASSWORD'],
        returnSecureToken: true,
      }),
      signal: AbortSignal.timeout(20000),
    },
  )
  assert.equal(response.status, 200, 'Falha na autenticação da conta QA ' + role)
  return (await response.json()).idToken
}

async function probe(path, { method = 'GET', token, status, code } = {}) {
  const response = await fetch(new URL(path, origin), {
    method,
    headers: token ? { Authorization: 'Bearer ' + token } : {},
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
  })
  assert.equal(response.status, status, method + ' ' + path)
  const body = await response.json()
  if (code) {
    const requestId = response.headers.get('X-Request-Id')
    assert(requestId, 'Missing request ID')
    assert.equal(body.error.requestId, requestId)
    assert.equal(body.error.code, code)
  }
  console.log(method, path, response.status)
  return body
}

try {
  assert.deepEqual(await probe('/health', { status: 200 }), { ok: true })
  const [admin, buyer] = await Promise.all([identity('ADMIN'), identity('BUYER1')])
  const { payload } = await jwtVerify(admin, jwks, {
    issuer: 'https://securetoken.google.com/' + project,
    audience: project,
    algorithms: ['RS256'],
  })
  assert(payload.admin === true || payload.role === 'admin', 'Claim administrativa ausente')
  assert(payload.comprador !== true && payload.fornecedor !== true)
  assert(!['comprador', 'fornecedor'].includes(payload.role))
  const audit = await probe('/admin/audit-logs', { token: admin, status: 200 })
  assert(Array.isArray(audit.logs))
  await probe('/admin/audit-logs', { token: buyer, status: 403, code: 'FORBIDDEN' })
  await probe('/admin/audit-logs', { token: 'invalid-token', status: 401, code: 'UNAUTHORIZED' })
  await probe('/chat/message', { method: 'POST', token: admin, status: 404, code: 'RESOURCE_NOT_FOUND' })
  await probe('/chat/message', { method: 'POST', status: 404, code: 'RESOURCE_NOT_FOUND' })
  console.log('Claim administrativa verificada e acesso confirmado no Worker local.')
} catch (error) {
  console.error(error instanceof Error ? error.message : 'QA failed')
  process.exitCode = 1
}
