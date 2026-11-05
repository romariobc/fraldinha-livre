import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { CHECKS, runChecks } from './run-checks.mjs'

const require = createRequire(import.meta.url)
const { load } = require('js-yaml')
const root = fileURLToPath(new URL('../', import.meta.url))
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const workflow = (name) => load(read('.github/workflows/' + name + '.yml'))
const gate = (...args) => spawnSync(process.execPath, ['scripts/ci-gate.mjs', ...args], { cwd: root, encoding: 'utf8' })

test('the real gate command only succeeds when every required job succeeded', () => {
  assert.equal(gate('success', 'success').status, 0)
  for (const status of ['failure', 'cancelled', 'skipped', 'pending', '']) {
    const result = gate('success', status)
    assert.equal(result.status, 1, status)
    assert.match(result.stderr, /Publication is blocked/)
  }
  assert.equal(gate().status, 1)
})

test('local QA stops at every failing check and preserves its exit code', () => {
  for (let failureAt = 0; failureAt < CHECKS.length; failureAt++) {
    const calls = []
    const status = runChecks({
      log() {},
      runCommand(command, args) {
        calls.push([command, args])
        return { status: calls.length - 1 === failureAt ? 7 : 0 }
      },
    })
    assert.equal(status, 7)
    assert.equal(calls.length, failureAt + 1)
  }
})

test('a missing executable or interrupted process fails closed', () => {
  for (const result of [{ status: null, error: new Error('ENOENT') }, { status: null, signal: 'SIGTERM' }]) {
    let calls = 0
    assert.equal(runChecks({ log() {}, runCommand() { calls++; return result } }), 1)
    assert.equal(calls, 1)
  }
})

test('successful local QA only runs validation; build is explicit and failure propagates', () => {
  const calls = []
  assert.equal(runChecks({ log() {}, runCommand(command, args) { calls.push([command, args]); return { status: 0 } } }), 0)
  assert.equal(calls.length, CHECKS.length)
  assert.ok(calls.every(([command, args]) => !/deploy|migrations|git\s+(add|commit|push)|remove-item/i.test([command, ...args].join(' '))))
  let buildSeen = false
  const code = runChecks({ includeBuild: true, log() {}, runCommand(command, args) {
    if (args.includes('build')) { buildSeen = true; return { status: 3 } }
    return { status: 0 }
  } })
  assert.equal(buildSeen, true)
  assert.equal(code, 3)
})

test('all PRs to main use the shared validation without secret-bearing or mutable jobs', () => {
  const pr = workflow('pr-validation')
  assert.deepEqual(pr.on.pull_request.branches, ['main'])
  assert.equal(pr.on.pull_request.paths, undefined)
  assert.equal(pr.on.pull_request.paths_ignore, undefined)
  assert.equal(pr.on.pull_request_target, undefined)
  assert.deepEqual(Object.keys(pr.jobs), ['validate'])
  assert.equal(pr.jobs.validate.uses, './.github/workflows/validation.yml')
  assert.equal(pr.jobs.validate.secrets, undefined)
  const shared = workflow('validation')
  assert.ok(Object.hasOwn(shared.on, 'workflow_call'))
  const commands = shared.jobs.tests.strategy.matrix.include.map((entry) => entry.command)
  for (const [, command, args] of CHECKS) {
    assert.ok(commands.includes([command, ...args].join(' ')), `Missing shared check: ${command} ${args.join(' ')}`)
  }
  assert.equal(shared.jobs.required.if, '${{ always() }}')
  assert.deepEqual(shared.jobs.required.needs, ['tests', 'frontend-container'])
  const command = shared.jobs.required.steps.at(-1).run
  assert.match(command, /node scripts\/ci-gate\.mjs/)
  assert.match(command, /needs\.tests\.result/)
  assert.match(command, /needs\.frontend-container\.result/)
  assert.doesNotMatch(read('.github/workflows/validation.yml'), /secrets\.|wrangler.*deploy|d1 migrations/)
})

test('production cannot reach migrations/deploy until validation of the same revision succeeds', () => {
  const prod = workflow('cloudflare-deploy')
  assert.deepEqual(prod.on.push.branches, ['main'])
  assert.deepEqual(prod.jobs.validate.needs, 'check-ref')
  assert.equal(prod.jobs.validate.uses, './.github/workflows/validation.yml')
  assert.equal(prod.jobs.validate.if, undefined)
  assert.equal(prod.jobs.deploy.needs, 'validate')
  assert.equal(prod.jobs.deploy.if, undefined)
  assert.equal(prod.jobs.deploy.environment, 'Production')
  assert.equal(prod.jobs['check-ref'].steps[0].env.DEPLOY_REF, '${{ github.ref }}')
  assert.match(prod.jobs['check-ref'].steps[0].run, /test "\$DEPLOY_REF" = refs\/heads\/main/)
  for (const name of ['cloudflare-deploy', 'validation', 'homologation-deploy']) {
    for (const job of Object.values(workflow(name).jobs)) {
      for (const step of job.steps ?? []) {
        if (step.uses?.startsWith('actions/checkout@')) {
          assert.equal(step.with.ref, '${{ github.sha }}')
          assert.equal(step.with['persist-credentials'], false)
        }
      }
    }
  }
})

test('homologation is a separate, explicitly confirmed deployment after validation', () => {
  const qa = workflow('homologation-deploy')
  assert.deepEqual(Object.keys(qa.on), ['workflow_dispatch'])
  assert.equal(qa.on.workflow_dispatch.inputs.confirm.default, false)
  assert.equal(qa.jobs.validate.if, '${{ inputs.confirm }}')
  assert.equal(qa.jobs.validate.uses, './.github/workflows/validation.yml')
  assert.equal(qa.jobs.deploy.needs, 'validate')
  assert.equal(qa.jobs.deploy.environment, 'homologation')
})

test('PowerShell entrypoints contain no publication, Git mutation, deletion or fixed workspace path', () => {
  const scripts = read('run_checks.ps1') + read('check_resources.ps1')
  assert.doesNotMatch(scripts, /Remove-Item|\brm\s|wrangler|git\s+(add|commit|push)|E:\\Labdev/i)
  assert.match(read('run_checks.ps1'), /finally\s*\{\s*Pop-Location/s)
})

test('read-only resource checker returns success or failure for the available disk space', () => {
  const run = (free) => {
    const script = `function Get-PSDrive { param($Name, $ErrorAction) [pscustomobject]@{ Free = ${free} } }; & ./check_resources.ps1`
    return spawnSync('pwsh', ['-NoProfile', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { cwd: root, encoding: 'utf8' })
  }
  assert.equal(run(10 * 1024 ** 3).status, 0)
  const low = run(0)
  assert.equal(low.status, 1)
  assert.match(low.stdout, /0 GB free/)
})
