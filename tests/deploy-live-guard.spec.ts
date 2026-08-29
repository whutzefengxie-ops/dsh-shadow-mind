import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Regression net for the deploy-live safety gate. Structural assertions pin
 * the ordering of every git invocation against its exit-code check; behavior
 * tests execute the real script with a fake `git` on PATH (Windows PowerShell
 * 5.1 locally, pwsh 7 in CI) and assert the gate aborts BEFORE touching the
 * profile directory.
 */
const scriptPath = fileURLToPath(new URL('../scripts/deploy-live.ps1', import.meta.url))

const WINDOWS = process.platform === 'win32'

/** PowerShell available on this machine, or undefined to skip behavior tests. */
function shell(): { readonly shell: string } | undefined {
  const candidate = WINDOWS ? 'powershell' : 'pwsh'
  const probe = spawnSync(candidate, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], { encoding: 'utf8' })
  return probe.error === undefined && probe.status === 0 ? { shell: candidate } : undefined
}

function readScript(): string {
  return readFileSync(scriptPath, 'utf8')
}

/** One fake git whose behavior is selected by FAKE_GIT_MODE; the logic lives in
 * a Node script so the Windows .cmd wrapper stays a trivial passthrough (batch
 * blocks do not propagate `exit /b` reliably inside parenthesized groups). */
function writeFakeGit(dir: string): void {
  const logic = `'use strict'
const mode = process.env.FAKE_GIT_MODE ?? ''
const joined = process.argv.slice(2).join(' ')
if (joined.includes('status --porcelain')) {
  if (mode === 'dirty') console.log('M src/runtime/index.ts')
  if (mode === 'status-fail') process.exit(1)
  process.exit(0)
}
if (joined.includes('fetch origin')) {
  if (mode === 'fetch-fail') process.exit(1)
  process.exit(0)
}
if (joined.includes('rev-parse HEAD')) {
  if (mode === 'revparse-empty') process.exit(0)
  console.log('aaaa1111111111111111111111111111111111111111')
  process.exit(0)
}
if (joined.includes('rev-parse origin/main')) {
  console.log(mode === 'head-mismatch'
    ? 'bbbb2222222222222222222222222222222222222222'
    : 'aaaa1111111111111111111111111111111111111111')
  process.exit(0)
}
process.exit(0)
`
  writeFileSync(join(dir, 'git.js'), logic, 'utf8')
  const path = join(dir, WINDOWS ? 'git.cmd' : 'git')
  if (WINDOWS) {
    writeFileSync(path, '@echo off\r\nnode "%~dp0git.js" %*\r\nexit /b %errorlevel%\r\n', 'utf8')
  } else {
    writeFileSync(path, '#!/bin/sh\nexec node "$(dirname "$0")/git.js" "$@"\n', 'utf8')
    chmodSync(path, 0o755)
  }
}

/** Run the real deploy script against the fake git; returns combined output and exit code. */
function runDeployScript(mode: string, shimDir: string, profileDir: string): { exit: number; output: string } {
  const available = shell()
  if (available === undefined) throw new Error('no PowerShell available')
  const env = {
    ...process.env,
    FAKE_GIT_MODE: mode,
    PATH: `${shimDir}${delimiter}${process.env.PATH ?? ''}`,
  }
  const result = spawnSync(
    available.shell,
    ['-NoProfile', '-File', scriptPath, '-ProfilePath', profileDir],
    { encoding: 'utf8', env },
  )
  return { exit: result.status ?? -1, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

describe('deploy-live safety gate (structure)', () => {
  const script = readScript()

  it('checks every git invocation for its exit code, in order', () => {
    const status = script.indexOf('$status = git -C $root status --porcelain')
    const exitStatus = script.indexOf('$LASTEXITCODE -ne 0')
    const fetch = script.indexOf('git -C $root fetch origin --quiet')
    const exitFetch = script.indexOf('$LASTEXITCODE -ne 0', exitStatus + 1)
    const head = script.indexOf('rev-parse HEAD')
    const exitHead = script.indexOf('$LASTEXITCODE -ne 0', exitFetch + 1)
    const main = script.indexOf('rev-parse origin/main')
    const exitMain = script.indexOf('$LASTEXITCODE -ne 0', exitHead + 1)
    const backup = script.indexOf('lib.bak-')
    for (const index of [status, exitStatus, fetch, exitFetch, head, exitHead, main, exitMain, backup]) {
      expect(index).toBeGreaterThan(-1)
    }
    expect(status).toBeLessThan(exitStatus)
    expect(exitStatus).toBeLessThan(fetch)
    expect(fetch).toBeLessThan(exitFetch)
    expect(exitFetch).toBeLessThan(head)
    expect(head).toBeLessThan(exitHead)
    expect(exitHead).toBeLessThan(main)
    expect(main).toBeLessThan(exitMain)
    expect(exitMain).toBeLessThan(backup)
  })

  it('names every abort reason distinctly', () => {
    expect(script).toContain('cannot verify a clean tree')
    expect(script).toContain('cannot verify origin/main')
    expect(script).toContain('cannot resolve HEAD')
    expect(script).toContain('cannot resolve origin/main')
    expect(script).toContain('has uncommitted changes')
    expect(script).toContain('is not origin/main')
  })

  it('keeps an explicit AllowDirty escape hatch', () => {
    expect(script).toContain('[switch]$AllowDirty')
    expect(script).toContain('pass -AllowDirty to override')
  })
})

describe.skipIf(shell() === undefined)('deploy-live safety gate (behavior)', () => {
  const cases: ReadonlyArray<{ mode: string; message: string }> = [
    { mode: 'status-fail', message: 'cannot verify a clean tree' },
    { mode: 'fetch-fail', message: 'cannot verify origin/main' },
    { mode: 'dirty', message: 'has uncommitted changes' },
    { mode: 'head-mismatch', message: 'is not origin/main' },
    { mode: 'revparse-empty', message: 'cannot resolve HEAD' },
  ]

  for (const entry of cases) {
    it(`aborts before touching the profile when git reports: ${entry.mode}`, () => {
      const shimDir = mkdtempSync(join(tmpdir(), 'dsh-fake-git-'))
      const profileDir = mkdtempSync(join(tmpdir(), 'dsh-fake-profile-'))
      try {
        writeFakeGit(shimDir)
        const result = runDeployScript(entry.mode, shimDir, profileDir)
        expect(result.exit).not.toBe(0)
        expect(result.output).toContain('deploy refused')
        expect(result.output).toContain(entry.message)
        // The gate must fail before any backup/copy: the profile stays empty.
        expect(readdirSync(profileDir)).toEqual([])
      } finally {
        rmSync(shimDir, { recursive: true, force: true })
        rmSync(profileDir, { recursive: true, force: true })
      }
    })
  }
})
