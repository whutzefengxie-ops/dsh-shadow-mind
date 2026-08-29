import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Structural regression net for the deploy-live safety gate. The script itself
 * needs PowerShell 7 and is not executed here; these assertions pin the exact
 * failure modes the gate exists for: a failed `git fetch` must abort instead of
 * comparing against a stale origin/main ref, and the gate must run before any
 * backup/copy step.
 */
const scriptPath = fileURLToPath(new URL('../scripts/deploy-live.ps1', import.meta.url))

describe('deploy-live safety gate', () => {
  const script = readFileSync(scriptPath, 'utf8')

  it('aborts on a failed fetch instead of comparing against a stale origin/main', () => {
    const fetch = script.indexOf('git -C $root fetch origin')
    const exitCheck = script.indexOf('$LASTEXITCODE')
    const headCheck = script.indexOf('rev-parse HEAD')
    expect(fetch).toBeGreaterThan(-1)
    expect(exitCheck).toBeGreaterThan(fetch)
    expect(headCheck).toBeGreaterThan(exitCheck)
    expect(script).toContain('deploy refused: cannot verify origin/main')
  })

  it('runs the whole gate before the first backup/copy step', () => {
    const headCheck = script.indexOf('rev-parse HEAD')
    const mainCheck = script.indexOf('rev-parse origin/main')
    const backup = script.indexOf('lib.bak-')
    expect(mainCheck).toBeGreaterThan(headCheck)
    expect(backup).toBeGreaterThan(mainCheck)
    expect(script.slice(headCheck, backup)).toContain('deploy refused: HEAD')
  })

  it('keeps an explicit AllowDirty escape hatch', () => {
    expect(script).toContain('[switch]$AllowDirty')
    expect(script).toContain('pass -AllowDirty to override')
  })
})
