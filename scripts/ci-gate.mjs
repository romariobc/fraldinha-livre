import { pathToFileURL } from 'node:url'

export function validationSucceeded(results) {
  return results.length > 0 && results.every((result) => result === 'success')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!validationSucceeded(process.argv.slice(2))) {
    console.error('Validation did not succeed for every required job. Publication is blocked.')
    process.exitCode = 1
  }
}
