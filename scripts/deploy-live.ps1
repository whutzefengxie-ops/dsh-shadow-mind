# Deploy the built lib/ and docs/ into a DSH web profile and prepare the host restart.
#
# The harness loads the runtime plugin at process start, so a new lib/ only takes
# effect after the web/headless process is restarted. Run this script from the
# checkout, then complete the printed restart step (this script deliberately does
# NOT restart the harness: doing so would kill the operator's running session).
#
# Usage:
#   pwsh scripts/deploy-live.ps1                      # default live web profile
#   pwsh scripts/deploy-live.ps1 -ProfilePath <path>  # another installed profile
#   pwsh scripts/deploy-live.ps1 -SkipInspect         # suppress the summary print

param(
  [string]$ProfilePath = 'C:\Users\Administrator\.dsh\profiles\web\node_modules\@whutzefengxie-ops\dsh-shadow-mind',
  [switch]$SkipInspect
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot | Split-Path -Parent
$libSrc = Join-Path $root 'lib'
$docsSrc = Join-Path $root 'docs'
if (-not (Test-Path (Join-Path $libSrc 'client.js'))) { throw "built lib not found: $libSrc (run pnpm run build first)" }

# 1. Back up the currently deployed lib/ so a rollback is one copy.
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$bak = Join-Path $ProfilePath "lib.bak-$stamp-pre-deploy"
Copy-Item -Path (Join-Path $ProfilePath 'lib') -Destination $bak -Recurse
Write-Output "backup: $bak"

# 2. Lay the new build over the profile.
Copy-Item -Path (Join-Path $libSrc '*') -Destination (Join-Path $ProfilePath 'lib') -Recurse -Force
Copy-Item -Path (Join-Path $docsSrc '*') -Destination (Join-Path $ProfilePath 'docs') -Recurse -Force

# 3. Move any chunk no longer referenced into the backup, so the profile stays clean.
$referenced = @()
foreach ($file in @('lib\index.js', 'lib\tool.js', 'lib\typert.js')) {
  $raw = Get-Content (Join-Path $ProfilePath $file) -Raw
  $referenced += [regex]::Matches($raw, 'runtime-[A-Za-z0-9_-]+\.js') | ForEach-Object { $_.Value }
}
$referenced = $referenced | Select-Object -Unique
New-Item -ItemType Directory -Path (Join-Path $bak 'chunks-stale') -Force | Out-Null
Get-ChildItem (Join-Path $ProfilePath 'lib\chunks') | ForEach-Object {
  if ($referenced -notcontains $_.Name) {
    Move-Item -Path $_.FullName -Destination (Join-Path $bak 'chunks-stale') -Force
    Write-Output "stale chunk moved: $($_.Name)"
  }
}

if (-not $SkipInspect) {
  Write-Output '--- deployed bundle hashes (should read OK) ---'
  foreach ($f in @('lib\index.js', 'lib\tool.js', 'lib\typert.js', 'lib\client.js')) {
    $a = (Get-FileHash -Algorithm SHA256 (Join-Path $root $f)).Hash
    $b = (Get-FileHash -Algorithm SHA256 (Join-Path $ProfilePath $f)).Hash
    Write-Output ("{0} {1}" -f $f, ($(if ($a -eq $b) { 'OK' } else { 'MISMATCH' })))
  }
  Write-Output "profile chunks: $((Get-ChildItem (Join-Path $ProfilePath 'lib\chunks')).Name -join ', ')"
}

Write-Output ''
Write-Output 'Next: RESTART the harness process (the one serving this profile) so the host runtime'
Write-Output 'loads the freshly deployed lib/. The browser client should then match the host.'
Write-Output ''
Write-Output 'Example (adjust the PID / launch command to your run):'
Write-Output '  Stop-Process -Id 20776                # the "web --port 3080" process'
Write-Output '  # then re-start it with your usual web command, e.g.:'
Write-Output '  node --import tsx/esm apps/cli/src/bin.ts web --no-open --port 3080'
Write-Output ''
Write-Output 'Note: this script deliberately does NOT restart the harness itself, because restarting'
Write-Output 'it would terminate the operator/agent session that invoked the deploy. On a CI or operator'
Write-Output 'run, add the restart step after this script completes.'
