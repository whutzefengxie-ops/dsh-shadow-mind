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
#   pwsh scripts/deploy-live.ps1 -AllowDirty          # bypass the safety gate (experimental only)
#
# The default profile path is derived from $env:DSH_HOME (falling back to
# ~/.dsh, the Harness default home). Pass -ProfilePath to override.
#
# Safety gate: deploying from a dirty or outdated checkout silently reverts
# whatever the live profile currently runs (for example fixes merged into main
# but not yet checked out locally). Unless -AllowDirty is passed, the script
# refuses to run when the checkout has uncommitted changes or its HEAD is not
# origin/main.

param(
  [string]$ProfilePath = (Join-Path (if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }) 'profiles\web\node_modules\@whutzefengxie-ops\dsh-shadow-mind'),
  [switch]$SkipInspect,
  [switch]$AllowDirty
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot | Split-Path -Parent
$libSrc = Join-Path $root 'lib'
$docsSrc = Join-Path $root 'docs'
if (-not (Test-Path (Join-Path $libSrc 'client.js'))) { throw "built lib not found: $libSrc (run pnpm run build first)" }

# 0. Safety gate: never deploy a tree that does not represent origin/main.
if (-not $AllowDirty) {
  if (git -C $root status --porcelain) {
    throw "deploy refused: the checkout at $root has uncommitted changes. Commit or stash them, or pass -AllowDirty to override."
  }
  # Native exit codes are not covered by $ErrorActionPreference, so a failed
  # fetch (offline, proxy, auth) must abort explicitly: comparing against a
  # stale origin/main ref would silently pass an outdated checkout.
  git -C $root fetch origin --quiet
  if ($LASTEXITCODE -ne 0) {
    throw "deploy refused: cannot verify origin/main (git fetch exited $LASTEXITCODE). Fix network/auth and retry, or pass -AllowDirty to override."
  }
  $head = git -C $root rev-parse HEAD
  $main = git -C $root rev-parse origin/main
  if ($head -ne $main) {
    throw "deploy refused: HEAD ($($head.Substring(0, 7))) is not origin/main ($($main.Substring(0, 7))). Update the checkout to origin/main before deploying, or pass -AllowDirty to override."
  }
}

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

# 4. Self-consistency: every chunk referenced by an entry bundle must exist on disk.
# A missing referenced chunk would make the harness fail to load the runtime on the
# next restart (the same failure class as "Shadow Mind data is unavailable").
$chunksOnDisk = @(Get-ChildItem (Join-Path $ProfilePath 'lib\chunks') -File | ForEach-Object { $_.Name })
$missing = @($referenced | Where-Object { $chunksOnDisk -notcontains $_ })
if ($missing.Count -gt 0) {
  throw "deployed lib is not self-consistent: referenced chunk(s) missing: $($missing -join ', ')"
}
Write-Output "referenced chunks present on disk: $(if ($referenced) { $referenced -join ', ' } else { '(none referenced)' })"

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
