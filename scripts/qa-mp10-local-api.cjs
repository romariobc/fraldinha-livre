// Local Worker entry point for browser QA, without Wrangler's development proxy.
// Existing Firebase identities are verified by the real auth middleware.
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { Miniflare } = require('miniflare')
const esbuild = require('esbuild')
const root = path.resolve(__dirname, '..')
const origin = new URL(process.env.QA_API_ORIGIN || 'http://127.0.0.1:8795')
assert(origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname), 'Local QA origin required')
const config = JSON.parse(fs.readFileSync(path.resolve(root, process.env.QA_LOCAL_CONFIG || 'docs/qa-artifacts/mp10-wrangler.json'), 'utf8'))
const persist = path.resolve(root, process.env.QA_LOCAL_PERSIST || 'docs/qa-artifacts/mp10-d1-verified/v3/d1')
async function main() {
  const bundle = path.join(root, 'docs/qa-artifacts/mp10-local-worker.mjs')
  await esbuild.build({ entryPoints: [config.main], bundle: true, platform: 'browser', format: 'esm', target: 'es2022', outfile: bundle, external: ['node:*', 'cloudflare:workers'] })
  const mf = new Miniflare({ scriptPath: bundle, modules: true, compatibilityDate: config.compatibility_date,
    compatibilityFlags: config.compatibility_flags, bindings: { ...config.vars, NOTIFICATIONS_ENABLED: 'false' },
    d1Databases: { DB: config.d1_databases[0].database_id }, d1Persist: persist, host: origin.hostname, port: Number(origin.port || 80) })
  console.log('Local Worker ready:', String(await mf.ready))
  const stop = async () => { await mf.dispose(); process.exit(0) }
  process.once('SIGINT', stop); process.once('SIGTERM', stop)
  await new Promise(() => {})
}
main().catch(error => { console.error(error); process.exitCode = 1 })
