# Read-only resource check. Never removes files or attempts automatic cleanup.
param(
    [ValidateRange(0.01, 1000000)] [double]$MinimumFreeGB = 1,
    [ValidateRange(0.01, 1000000)] [double]$WarningFreeGB = 2
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($WarningFreeGB -lt $MinimumFreeGB) {
    Write-Error 'WarningFreeGB must be greater than or equal to MinimumFreeGB.'
    exit 1
}

$workspaceDrive = (Get-Item -LiteralPath $PSScriptRoot).PSDrive.Name
$driveNames = @($workspaceDrive)
if (Get-PSDrive -Name C -ErrorAction SilentlyContinue) { $driveNames += 'C' }
$insufficient = $false
foreach ($driveName in ($driveNames | Select-Object -Unique)) {
    $drive = Get-PSDrive -Name $driveName -ErrorAction Stop
    $freeGB = [math]::Round($drive.Free / 1GB, 2)
    Write-Host "Drive ${driveName}: $freeGB GB free."
    if ($drive.Free / 1GB -lt $MinimumFreeGB) {
        Write-Warning "Insufficient space on ${driveName}: minimum $MinimumFreeGB GB. Free space manually."
        $insufficient = $true
    }
    elseif ($drive.Free / 1GB -lt $WarningFreeGB) {
        Write-Warning "Low space on ${driveName}: less than $WarningFreeGB GB."
    }
}
if ($insufficient) { exit 1 }
exit 0
