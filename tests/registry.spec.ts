import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Config, DEFAULT_SHADOW_ID, DEFAULT_SHADOW_PROMPT, ShadowRegistry, parseShadowDefinition } from '../src/runtime/index.ts'
import type { ShadowDefinitionInput } from '../src/runtime/index.ts'

function input(overrides: Partial<ShadowDefinitionInput> = {}): ShadowDefinitionInput {
  return {
    id: DEFAULT_SHADOW_ID,
    name: 'Shadow',
    enabled: true,
    debug: false,
    activationProbability: 0.7,
    activeForModels: ['mock/*'],
    runWithModel: 'mock/shadow',
    reasoningEffort: 'low',
    timeoutSeconds: 12,
    tools: ['web_search'],
    capture: 'full',
    context: 'standard',
    thinkFirst: false,
    holdout: false,
    prompt: 'Review architecture risks.',
    ...overrides,
  }
}

describe('parseShadowDefinition', () => {
  it('parses every supported field and normalizes CRLF', () => {
    const definition = parseShadowDefinition([
      '---',
      'id: audit',
      'name: Audit',
      'enabled: false',
      'debug: true',
      'activation_probability: 0.75',
      'active_for_models: ["mock/*"]',
      'run_with_model: mock/shadow',
      'reasoning_effort: low',
      'timeout_seconds: 9',
      'tools: [web_search]',
      'capture: since-compaction',
      'context: minimal',
      'think_first: true',
      'holdout: true',
      '---',
      '',
      'Inspect the design.',
    ].join('\r\n'), 'C:/defs/audit.md')
    expect(definition).toMatchObject({
      id: 'audit', name: 'Audit', enabled: false, debug: true,
      activationProbability: 0.75, runWithModel: 'mock/shadow',
      reasoningEffort: 'low', timeoutSeconds: 9,
      capture: 'since-compaction', context: 'minimal', thinkFirst: true,
      holdout: true,
      prompt: 'Inspect the design.',
    })
    expect(definition.activeForModels).toEqual(['mock/*'])
    expect(definition.tools).toEqual(['web_search'])
  })

  it('tolerates legacy predicate frontmatter keys without applying them', () => {
    const definition = parseShadowDefinition([
      '---',
      'id: legacy',
      'pre_filter: [tool-failure]',
      'boost_filter: [long-output]',
      'boost_factor: 2.5',
      '---',
      '',
      'Legacy prompt.',
    ].join('\n'), 'C:/defs/legacy.md')
    expect(definition.id).toBe('legacy')
    expect(definition).not.toHaveProperty('preFilters')
    expect(definition).not.toHaveProperty('boostFilters')
    expect(definition).not.toHaveProperty('boostFactor')
  })

  it.each([
    ['body only', 'definition must start'],
    ['---\nid: a\nbody', 'closing ---'],
    ['---\n- list\n---\nbody', 'YAML mapping'],
    ['---\nid: A\n---\nbody', 'id must match'],
    ['---\nid: a\nunknown: true\n---\nbody', 'unknown frontmatter'],
    ['---\nid: a\nactivation_probability: 2\n---\nbody', 'activation_probability'],
    ['---\nid: a\ntimeout_seconds: 0\n---\nbody', 'timeout_seconds'],
    ['---\nid: a\ntools: [Bad Tool]\n---\nbody', 'tool'],
    ['---\nid: a\nname: 1\n---\nbody', 'name must be a non-empty string'],
    ['---\nid: a\nname: |\n  first\n  second\n---\nbody', 'name must be a single line'],
    ['---\nid: a\nenabled: yes\n---\nbody', 'enabled must be a boolean'],
    ['---\nid: a\ntools: value\n---\nbody', 'array of non-empty strings'],
    ['---\nid: a\ntools: [read, ""]\n---\nbody', 'array of non-empty strings'],
    ['---\nid: a\ntools: [read, read]\n---\nbody', 'must not contain duplicates'],
    ['---\nid: a\nactivation_probability: .nan\n---\nbody', 'activation_probability'],
    ['---\nid: a\ntimeout_seconds: .inf\n---\nbody', 'timeout_seconds'],
    ['---\nid: a\nrun_with_model: model-only\n---\nbody', 'provider/model'],
    ['---\nid: a\ncapture: recent\n---\nbody', 'capture must be one of'],
    ['---\nid: a\ncontext: inherited\n---\nbody', 'context must be one of'],
    ['---\nid: a\nthink_first: yes\n---\nbody', 'think_first must be a boolean'],
    ['---\nid: a\nholdout: yes\n---\nbody', 'holdout must be a boolean'],
    ['---\nid: [\n---\nbody', 'invalid YAML frontmatter'],
    ['---\nid: a\n---\n   ', 'body must be non-empty'],
  ])('rejects invalid documents', (source, message) => {
    expect(() => parseShadowDefinition(source, '/defs/a.md')).toThrow(message)
  })
})

describe('Shadow settings', () => {
  it('defaults the Shadow deadline to 10 minutes so deep reviews stop timing out', () => {
    expect(Config({}).defaultShadowTimeoutSeconds).toBe(600)
  })

  it('validates frugal model routes before the runtime starts', () => {
    expect(Config({
      sessionShadowSoftBudgetChars: 100,
      sessionShadowHardBudgetChars: 1_000,
      frugalShadowModel: 'provider/org/model',
    }).frugalShadowModel).toBe('provider/org/model')
    expect(() => Config({
      sessionShadowSoftBudgetChars: 100,
      sessionShadowHardBudgetChars: 1_000,
      frugalShadowModel: 'model-only',
    })).toThrow()
    expect(() => Config({ frugalShadowModel: 'provider/org/model' })).toThrow('sessionShadowSoftBudgetChars')
  })

  it('validates stagnation windows, effort ladders, and the frugal budget tier', () => {
    expect(() => Config({ reviewWindowSize: 3, oscillationPeriods: 2 })).toThrow('reviewWindowSize')
    expect(() => Config({ reasoningEffortLadder: ['high', 'high'] })).toThrow('unique')
    expect(() => Config({ frugalShadowModel: 'mock/frugal' })).toThrow('sessionShadowSoftBudgetChars')
    expect(() => Config({
      sessionShadowSoftBudgetChars: 100,
      sessionShadowHardBudgetChars: 1_000,
    })).toThrow('frugalShadowModel')
    expect(() => Config({
      sessionShadowSoftBudgetChars: 1_000,
      sessionShadowHardBudgetChars: 100,
      frugalShadowModel: 'mock/frugal',
    })).toThrow('less than')
    expect(Config({
      sessionShadowSoftBudgetChars: 100,
      sessionShadowHardBudgetChars: 1_000,
      frugalShadowModel: 'mock/frugal',
    })).toMatchObject({
      sessionShadowSoftBudgetChars: 100,
      sessionShadowHardBudgetChars: 1_000,
      frugalShadowModel: 'mock/frugal',
    })
  })
})

describe('ShadowRegistry', () => {
  it('auto-creates the default definition with the 70% product probability', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-shadow-registry-'))
    try {
      const registry = new ShadowRegistry(home)
      const created = await registry.defaultDefinition()
      expect(created).toMatchObject({
        id: DEFAULT_SHADOW_ID,
        name: 'Shadow',
        enabled: true,
        activationProbability: 0.7,
        capture: 'full',
        context: 'standard',
        thinkFirst: false,
        holdout: false,
        prompt: DEFAULT_SHADOW_PROMPT,
      })
      expect(await readFile(join(registry.root, `${DEFAULT_SHADOW_ID}.md`), 'utf8'))
        .toContain('activation_probability: 0.7')
      expect((await registry.defaultDefinition()).prompt).toBe(DEFAULT_SHADOW_PROMPT)
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it('seeds the default from the first legacy definition while converging probability to 70%', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-shadow-registry-'))
    try {
      const registry = new ShadowRegistry(home)
      await mkdir(registry.root, { recursive: true })
      await writeFile(join(registry.root, 'a-legacy.md'), [
        '---',
        'id: contrarian',
        'name: Contrarian',
        'enabled: true',
        'activation_probability: 0.3',
        'timeout_seconds: 300',
        'capture: since-compaction',
        '---',
        '',
        'Challenge the strongest claim.',
      ].join('\n'))
      await writeFile(join(registry.root, 'b-legacy.md'), [
        '---',
        'id: hacker',
        'name: Hacker',
        'activation_probability: 0.2',
        '---',
        '',
        'Inspect failure paths.',
      ].join('\n'))
      const created = await registry.defaultDefinition()
      expect(created).toMatchObject({
        id: DEFAULT_SHADOW_ID,
        name: 'Contrarian',
        activationProbability: 0.7,
        capture: 'since-compaction',
        prompt: 'Challenge the strongest claim.',
      })
      // A stale legacy timeout must not override the new 10-minute default.
      expect(created).not.toHaveProperty('timeoutSeconds')
      // Legacy files stay on disk, read-only, and never scheduled.
      const catalog = await registry.list()
      expect(catalog.definitions.map(item => item.id).sort()).toEqual(['contrarian', DEFAULT_SHADOW_ID, 'hacker'])
      expect(await readFile(join(registry.root, 'a-legacy.md'), 'utf8')).toContain('activation_probability: 0.3')
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it('round-trips the complete default definition through saveDefault', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-shadow-registry-'))
    try {
      const registry = new ShadowRegistry(home)
      await registry.defaultDefinition()
      const saved = await registry.saveDefault(input({
        name: 'Auditor',
        enabled: false,
        debug: true,
        activationProbability: 0.4,
        capture: 'since-compaction',
        context: 'minimal',
        thinkFirst: true,
      }))
      expect(saved).toMatchObject({
        id: DEFAULT_SHADOW_ID,
        name: 'Auditor',
        enabled: false,
        debug: true,
        activationProbability: 0.4,
        capture: 'since-compaction',
        context: 'minimal',
        thinkFirst: true,
      })
      const reloaded = (await registry.list()).definitions
        .find(item => item.id === DEFAULT_SHADOW_ID)
      expect(reloaded).toMatchObject({ name: 'Auditor', enabled: false })
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it('rejects non-default ids and preserves file-level holdout on save', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-shadow-registry-'))
    try {
      const registry = new ShadowRegistry(home)
      await mkdir(registry.root, { recursive: true })
      await writeFile(registry.holdoutKeysPath, JSON.stringify({ [DEFAULT_SHADOW_ID]: ['SECRET'] }))
      await writeFile(join(registry.root, `${DEFAULT_SHADOW_ID}.md`), [
        '---',
        'id: default',
        'holdout: true',
        '---',
        '',
        'Held prompt.',
      ].join('\n'))
      await expect(registry.saveDefault(input({ id: 'other' }))).rejects.toThrow('only the default Shadow')
      const saved = await registry.saveDefault(input({ name: 'Kept', prompt: 'New prompt.' }))
      expect(saved.holdout).toBe(true)
      expect(await readFile(join(registry.root, `${DEFAULT_SHADOW_ID}.md`), 'utf8')).toContain('holdout: true')
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it('uses filename defaults and rethrows a definition-directory read failure', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-shadow-registry-'))
    try {
      const registry = new ShadowRegistry(home)
      expect(parseShadowDefinition('---\n{}\n---\nbody', join(registry.root, 'default-id.md'))).toMatchObject({
        id: 'default-id',
        name: 'default-id',
        enabled: true,
        debug: false,
        activationProbability: 0.7,
        activeForModels: [],
        tools: [],
      })
      await mkdir(home, { recursive: true })
      await writeFile(registry.root, 'not a directory')
      await expect(registry.list()).rejects.toThrow()
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it('isolates invalid files and deterministic duplicate ids', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-shadow-registry-'))
    try {
      const registry = new ShadowRegistry(home)
      await mkdir(registry.root, { recursive: true })
      await writeFile(join(registry.root, 'a.md'), '---\nid: same\n---\nfirst\n')
      await writeFile(join(registry.root, 'b.md'), '---\nid: same\n---\nsecond\n')
      await writeFile(join(registry.root, 'bad.md'), 'not frontmatter')
      const catalog = await registry.list()
      expect(catalog.definitions.map(item => item.prompt)).toEqual(['first'])
      expect(catalog.diagnostics).toHaveLength(2)
      expect(catalog.diagnostics.map(item => item.error).join('\n')).toMatch(/duplicate id[\s\S]*must start/)
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it('appends metadata-only value-loop records across registry instances', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-shadow-registry-'))
    try {
      const first = new ShadowRegistry(home)
      await first.appendValueLoop({ runId: 'run-1', classification: 'challenge_adopted' })
      const restarted = new ShadowRegistry(home)
      await restarted.appendValueLoop({ runId: 'run-2', classification: 'ignored' })
      const records = (await readFile(restarted.valueLoopPath, 'utf8')).trim().split('\n')
        .map(line => JSON.parse(line) as Record<string, unknown>)
      expect(records).toEqual([
        { runId: 'run-1', classification: 'challenge_adopted' },
        { runId: 'run-2', classification: 'ignored' },
      ])
      expect(records.some(record => 'content' in record || 'report' in record || 'trajectory' in record)).toBe(false)
      if (process.platform !== 'win32') {
        expect((await stat(first.root)).mode & 0o077).toBe(0)
        expect((await stat(restarted.valueLoopPath)).mode & 0o077).toBe(0)
      }
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it('requires a valid owner-only sidecar for holdout definitions without exposing its keys', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-shadow-registry-'))
    try {
      const registry = new ShadowRegistry(home)
      await mkdir(registry.root, { recursive: true })
      await writeFile(join(registry.root, 'manual.md'), '---\nid: manual\nholdout: true\n---\nmanual prompt\n')
      expect((await registry.list()).diagnostics[0]?.error).toContain('needs')

      for (const invalid of [
        '{',
        '[]',
        `{"${DEFAULT_SHADOW_ID}": []}`,
        `{"${DEFAULT_SHADOW_ID}": [""]}`,
        `{"${DEFAULT_SHADOW_ID}": ["   "]}`,
        `{"${DEFAULT_SHADOW_ID}": ["secret", "secret"]}`,
      ]) {
        await writeFile(registry.holdoutKeysPath, invalid)
        await expect(registry.saveDefault(input({ holdout: true }))).rejects.toThrow()
      }

      await writeFile(registry.holdoutKeysPath, JSON.stringify({
        [DEFAULT_SHADOW_ID]: ['SCORING_COMMAND', 'EXPECTED_OUTPUT'],
        manual: ['MANUAL_SECRET'],
      }))
      const saved = await registry.saveDefault(input({ holdout: true }))
      expect(saved).toMatchObject({ id: DEFAULT_SHADOW_ID, holdout: true })
      expect(saved).not.toHaveProperty('holdoutKeys')
      expect(await registry.holdoutKeys(DEFAULT_SHADOW_ID)).toEqual(['SCORING_COMMAND', 'EXPECTED_OUTPUT'])
      expect(await readFile(saved.sourcePath, 'utf8')).toContain('holdout: true')
      expect((await registry.list()).definitions).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: DEFAULT_SHADOW_ID, holdout: true }),
        expect.objectContaining({ id: 'manual', holdout: true }),
      ]))
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it('rethrows non-missing holdout sidecar read failures', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-shadow-registry-'))
    try {
      const registry = new ShadowRegistry(home)
      await mkdir(registry.holdoutKeysPath, { recursive: true })
      await expect(registry.holdoutKeys(DEFAULT_SHADOW_ID)).rejects.toThrow()
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })
})
