import { writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const workerName = 'fraldinha-livre-backend-homologacao'
const databaseName = 'fraldinha-livre-qa-integrated'
const productionDatabase = 'a6da1bcf-ed51-4c8a-8dcb-cfd0c6c9e612'
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
const token = process.env.CLOUDFLARE_API_TOKEN
if (!accountId || !token) throw new Error('Credenciais Cloudflare ausentes no CI.')
const backDir = fileURLToPath(new URL('../back/', import.meta.url))
const cli = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url))
async function cloudflare(path, init = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  const body = await response.json()
  if (!response.ok || !body.success) {
    throw new Error(`Cloudflare ${path}: HTTP ${response.status}; codes ${(body.errors ?? []).map((e) => e.code).join(',')}`)
  }
  return body.result
}
const databases = await cloudflare('d1/database?name=' + encodeURIComponent(databaseName))
let database = databases.find((entry) => entry.name === databaseName)
if (!database) database = await cloudflare('d1/database', { method: 'POST', body: JSON.stringify({ name: databaseName }) })
if (database.name !== databaseName || !database.uuid || database.uuid === productionDatabase) {
  throw new Error('Banco de homologação inválido; operação interrompida antes de migrations.')
}
const config = {
  name: workerName,
  main: 'src/qa-entry.ts',
  compatibility_date: '2026-07-19',
  compatibility_flags: ['nodejs_compat'],
  workers_dev: true,
  observability: { enabled: true },
  d1_databases: [{ binding: 'DB', database_name: databaseName, database_id: database.uuid }],
  ai: { binding: 'AI' },
  vars: {
    FIREBASE_PROJECT_ID: 'fraldinha-livre',
    NOTIFICATIONS_ENABLED: 'false',
    SUPPLIER_UIDS: 'cSK4LXIakuajmCSiJFaHOccck2s1,RLZxfzeih2hvC5VukqzaHcI8qHn2,8GyypkqWVdbAesG036qXIRVVOji1',
  },
}
writeFileSync(new URL('../back/wrangler.qa.generated.json', import.meta.url), JSON.stringify(config, null, 2))
function wrangler(args) {
  const result = spawnSync(process.execPath, [cli, ...args, '--config', 'wrangler.qa.generated.json'], {
    cwd: backDir, env: process.env, stdio: 'inherit',
  })
  if (result.error || result.status !== 0) throw new Error(`Wrangler falhou: ${args[0]} ${args[1] ?? ''}`)
}
wrangler(['d1', 'migrations', 'apply', 'DB', '--remote'])
wrangler(['d1', 'execute', 'DB', '--remote', '--file', '../scripts/qa/fixture.sql'])
wrangler(['deploy'])
const subdomain = await cloudflare('workers/subdomain')
const deployments = await cloudflare(`workers/scripts/${workerName}/deployments`)
mkdirSync('qa-evidence', { recursive: true })
writeFileSync('qa-evidence/deployment.json', JSON.stringify({
  commit: process.env.GITHUB_SHA,
  workerName,
  databaseName,
  databaseId: database.uuid,
  endpoint: `https://${workerName}.${subdomain.subdomain}.workers.dev`,
  deployments,
}, null, 2))
console.log(`Homologação publicada: https://${workerName}.${subdomain.subdomain}.workers.dev`)
