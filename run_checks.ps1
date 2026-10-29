param([switch]$Build)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$checkExitCode = 1

Push-Location -LiteralPath $PSScriptRoot
try {
    & "$PSScriptRoot/check_resources.ps1"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    $runnerArguments = @("$PSScriptRoot/scripts/run-checks.mjs")
    if ($Build) { $runnerArguments += '--build' }
    & node @runnerArguments
    $checkExitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}
exit $checkExitCode
