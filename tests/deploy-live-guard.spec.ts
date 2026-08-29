import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Regression net for the deploy-live safety gate. Structural assertions pin
 * the ordering of every git invocation against its exit-code check; behavior
 * tests execute the real script with a fake `git` on PATH (Windows PowerShell
 * 5.1 locally, pwsh 7 in CI) and cover both the abort paths and one complete
 * end-to-end deploy into a seeded temporary profile.
 */
const scriptPath = fileURLToPath(new URL('../scripts/deploy-live.ps1', import.meta.url))
const repoRoot = fileURLToPath(new URL('..', import.meta.url))

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
function runDeployScript(
  mode: string,
  shimDir: string,
  args: readonly string[],
  envOverrides: Readonly<Record<string, string | undefined>> = {},
): { exit: number; output: string } {
  const available = shell()
  if (available === undefined) throw new Error('no PowerShell available')
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    FAKE_GIT_MODE: mode,
    PATH: `${shimDir}${delimiter}${process.env.PATH ?? ''}`,
  }
  for (const [key, value] of Object.entries(envOverrides)) {
    if (value === undefined) delete env[key]
    else env[key] = value
  }
  const result = spawnSync(
    available.shell,
    // -ExecutionPolicy Bypass keeps `-File` working on stock Windows machines
    // whose policy (Restricted) would otherwise block the script itself.
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...args],
    { encoding: 'utf8', env },
  )
  return { exit: result.status ?? -1, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

/**
 * Normalize rendered PowerShell output so message substrings survive console
 * formatting: pwsh 7 wraps long error records at 80 columns when there is no
 * TTY, decorating each wrapped line with a `|` marker and ANSI color codes.
 * Strip those and fold all whitespace into single spaces.
 */
function collapsedOutput(text: string): string {
  return text
    .replace(/\u001b\[[0-9;]*m/gu, '')
    .replace(/\|/gu, ' ')
    .replace(/\s+/gu, ' ')
}

/** Chunk names referenced by the repo's built entry bundles. */
function referencedChunks(): string[] {
  const names = new Set<string>()
  for (const file of ['lib/index.js', 'lib/tool.js', 'lib/typert.js']) {
    const content = readFileSync(join(repoRoot, file), 'utf8')
    for (const match of content.matchAll(/runtime-[A-Za-z0-9_-]+\.js/gu)) names.add(match[0])
  }
  return [...names].sort()
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
        const result = runDeployScript(entry.mode, shimDir, ['-ProfilePath', profileDir])
        expect(result.exit).not.toBe(0)
        const collapsed = collapsedOutput(result.output)
        expect(collapsed).toContain('deploy refused')
        expect(collapsed).toContain(entry.message)
        // The gate must fail before any backup/copy: the profile stays empty.
        expect(readdirSync(profileDir)).toEqual([])
      } finally {
        rmSync(shimDir, { recursive: true, force: true })
        rmSync(profileDir, { recursive: true, force: true })
      }
    })
  }

  it('completes a full deploy through the default profile resolution', () => {
    const shimDir = mkdtempSync(join(tmpdir(), 'dsh-fake-git-'))
    // The default profile path derives from DSH_HOME or USERPROFILE; redirect
    // both to a temp home so the success path runs against a seeded sandbox
    // profile instead of the real one.
    const tempHome = mkdtempSync(join(tmpdir(), 'dsh-fake-home-'))
    const profileDir = join(tempHome, '.dsh', 'profiles', 'web', 'node_modules', '@whutzefengxie-ops', 'dsh-shadow-mind')
    try {
      writeFakeGit(shimDir)
      mkdirSync(join(profileDir, 'lib', 'chunks'), { recursive: true })
      writeFileSync(join(profileDir, 'lib', 'chunks', 'runtime-STALE123.js'), 'stale', 'utf8')
      const result = runDeployScript('ok', shimDir, [], { DSH_HOME: undefined, USERPROFILE: tempHome })
      expect(result.exit).toBe(0)

      // A timestamped backup was created before the copy.
      const backups = readdirSync(profileDir).filter(name => name.startsWith('lib.bak-'))
      expect(backups).toHaveLength(1)
      const backup = backups[0]
      expect(backup).toBeDefined()

      // The entry bundles in the profile equal the repo build.
      for (const file of ['lib/index.js', 'lib/tool.js', 'lib/typert.js', 'lib/client.js']) {
        expect(readFileSync(join(profileDir, file), 'utf8')).toBe(readFileSync(join(repoRoot, file), 'utf8'))
      }

      // Only referenced chunks remain; the seeded stale chunk moved into the backup.
      expect(readdirSync(join(profileDir, 'lib', 'chunks')).sort()).toEqual(referencedChunks())
      expect(readFileSync(join(profileDir, backup!, 'chunks-stale', 'runtime-STALE123.js'), 'utf8')).toBe('stale')

      // The self-consistency and hash verification steps ran.
      expect(result.output).toContain('referenced chunks present')
      expect(result.output).toContain('lib/client.js OK')
    } finally {
      rmSync(shimDir, { recursive: true, force: true })
      rmSync(tempHome, { recursive: true, force: true })
    }
  })
})
