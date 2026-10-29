import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
export const CHECKS = [
  ['CI safety regressions', 'node', ['--test', 'scripts/ci-safety.test.mjs']],
  ['Backend tests', 'npm', ['test', '--workspace', 'back', '--', '--maxWorkers=1']],
  ['Frontend tests', 'npm', ['test', '--workspace', 'front', '--', '--maxWorkers=2']],
  ['Contracts tests', 'npm', ['test', '--workspace', 'packages/contracts']],
  ['API E2E runner regressions', 'node', ['--test', 'scripts/test-e2e-logic.test.mjs']],
  ['Frontend types', 'npm', ['exec', '--workspace', 'front', '--', 'tsc', '--noEmit', '-p', 'tsconfig.json']],
  ['Backend types', 'npm', ['exec', '--workspace', 'back', '--', 'tsc', '--noEmit', '-p', 'tsconfig.json']],
  ['Contracts types', 'npm', ['exec', '--workspace', 'packages/contracts', '--', 'tsc', '--noEmit', '-p', 'tsconfig.json']],
  ['Frontend lint', 'npm', ['run', 'lint', '--workspace', 'front']],
]

function execute(command, args) {
  // npm is a .cmd shim on Windows; all tokens here are fixed by this module.
  if (command === 'npm' && process.platform === 'win32') {
    return spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', ['npm', ...args].join(' ')], { cwd: root, stdio: 'inherit' })
  }
  return spawnSync(command === 'node' ? process.execPath : command, args, { cwd: root, stdio: 'inherit' })
}

export function runChecks({ runCommand = execute, includeBuild = false, log = console.log } = {}) {
  const checks = includeBuild
    ? [...CHECKS, ['Frontend build', 'npm', ['run', 'build', '--workspace', 'front', '--', '--webpack']]]
    : CHECKS
  for (const [label, command, args] of checks) {
    log(label)
    const result = runCommand(command, [...args])
    if (result.error || result.status !== 0) {
      log(`FAILED: ${label}. No subsequent checks were executed.`)
      return Number.isInteger(result.status) && result.status > 0 ? result.status : 1
    }
  }
  log('Validation completed. No publication or Git mutation was performed.')
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2)
  if (args.some((arg) => arg !== '--build')) {
    console.error('Usage: node scripts/run-checks.mjs [--build]')
    process.exitCode = 1
  } else {
    process.exitCode = runChecks({ includeBuild: args.includes('--build') })
  }
}
