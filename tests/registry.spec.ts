import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Config, ShadowRegistry, parseShadowDefinition } from '../src/runtime/index.ts'
import type { CreateShadowDefinition } from '../src/runtime/index.ts'

function input(id: string): CreateShadowDefinition {
  return {
    id,
    name: `Shadow ${id}`,
    enabled: true,
    debug: false,
    activationProbability: 0.5,
    activeForModels: ['mock/*'],
    runWithModel: 'mock/shadow',
    reasoningEffort: 'low',
    timeoutSeconds: 12,
    tools: ['web_search'],
    prompt: 'Review architecture risks.',
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
      'pre_filter: [tool-failure]',
      'boost_filter: [long-output]',
      'boost_factor: 2.5',
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
      preFilters: ['tool-failure'], boostFilters: ['long-output'], boostFactor: 2.5,
      holdout: true,
      prompt: 'Inspect the design.',
    })
    expect(definition.activeForModels).toEqual(['mock/*'])
    expect(definition.tools).toEqual(['web_search'])
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
    ['---\nid: a\npre_filter: [unknown]\n---\nbody', 'unknown pre_filter'],
    ['---\nid: a\nboost_filter: [unknown]\n---\nbody', 'unknown boost_filter'],
    ['---\nid: a\nboost_factor: 0.5\n---\nbody', 'boost_factor'],
    ['---\nid: a\nholdout: yes\n---\nbody', 'holdout must be a boolean'],
    ['---\nid: [\n---\nbody', 'invalid YAML frontmatter'],
    ['---\nid: a\n---\n   ', 'body must be non-empty'],
  ])('rejects invalid documents', (source, message) => {
    expect(() => parseShadowDefinition(source, '/defs/a.md')).toThrow(message)
  })
})

describe('Shadow settings', () => {
  it('validates default model routes before the runtime starts', () => {
    expect(Config({ defaultShadowModel: 'provider/org/model' }).defaultShadowModel)
      .toBe('provider/org/model')
    expect(() => Config({ defaultShadowModel: 'model-only' })).toThrow()
    expect(() => Config({ defaultShadowModel: 'provider/has whitespace' })).toThrow()
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
  it('creates, updates, enables, deletes, and preserves debug logs', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-shadow-registry-'))
    try {
      const registry = new ShadowRegistry(home)
      await expect(registry.create(input('Bad'))).rejects.toThrow('shadow id must match')
      await expect(registry.update('missing', { prompt: 'none' })).rejects.toThrow('does not exist')
      const minimal = await registry.create({
        id: 'minimal',
        name: 'Minimal',
        enabled: true,
        debug: false,
        activationProbability: 0.3,
        activeForModels: [],
        tools: [],
        prompt: 'Minimal prompt.',
      })
      expect(minimal.id).toBe('minimal')
      expect(minimal).toMatchObject({
        capture: 'full', context: 'standard', thinkFirst: false,
        preFilters: [], boostFilters: [], boostFactor: 1, holdout: false,
      })
      const minimalUpdated = await registry.update('minimal', { name: 'Minimal updated' })
      expect(minimalUpdated.name).toBe('Minimal updated')
      expect(minimalUpdated).not.toHaveProperty('runWithModel')
      expect(minimalUpdated).not.toHaveProperty('reasoningEffort')
      expect(minimalUpdated).not.toHaveProperty('timeoutSeconds')
      await registry.delete('minimal')
      const created = await registry.create(input('audit'))
      expect(created.id).toBe('audit')
      await expect(registry.create(input('audit'))).rejects.toThrow('already exists')
      expect((await registry.list()).definitions).toHaveLength(1)
      const updated = await registry.update('audit', { prompt: 'Updated.', enabled: false })
      expect(updated).toMatchObject({ prompt: 'Updated.', enabled: false })
      const conditioned = await registry.update('audit', {
        capture: 'since-compaction',
        context: 'minimal',
        thinkFirst: true,
        preFilters: ['last-report-covers'],
        boostFilters: ['repeated-failure'],
        boostFactor: 3,
      })
      expect(conditioned).toMatchObject({
        capture: 'since-compaction',
        context: 'minimal',
        thinkFirst: true,
        preFilters: ['last-report-covers'],
        boostFilters: ['repeated-failure'],
        boostFactor: 3,
      })
      await registry.setEnabled('audit', true)
      await registry.appendDebug('audit', { status: 'report' })
      await expect(registry.appendDebug('../escape', { status: 'report' })).rejects.toThrow('shadow id must match')
      await registry.delete('audit')
      expect((await registry.list()).definitions).toEqual([])
      expect(await readFile(join(registry.logRoot, 'audit.jsonl'), 'utf8')).toContain('"status":"report"')
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
        activationProbability: 0.3,
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

  it('serializes same-id mutations and never overwrites an invalid existing path', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-shadow-registry-'))
    try {
      const registry = new ShadowRegistry(home)
      await registry.create(input('audit'))
      const first = registry.update('audit', { name: 'First' })
      const second = registry.update('audit', { prompt: 'Second' })
      await Promise.all([first, second])
      expect((await registry.list()).definitions[0]).toMatchObject({ name: 'First', prompt: 'Second' })
      await writeFile(join(registry.root, 'broken.md'), 'broken')
      await expect(registry.create(input('broken'))).rejects.toThrow('path already exists')
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
      const held = { ...input('held'), holdout: true }
      await expect(registry.create(held)).rejects.toThrow('needs')

      await mkdir(registry.root, { recursive: true })
      await writeFile(join(registry.root, 'manual.md'), '---\nid: manual\nholdout: true\n---\nmanual prompt\n')
      expect((await registry.list()).diagnostics[0]?.error).toContain('needs')

      for (const invalid of [
        '{',
        '[]',
        '{"held": []}',
        '{"held": [""]}',
        '{"held": ["   "]}',
        '{"held": ["secret", "secret"]}',
      ]) {
        await writeFile(registry.holdoutKeysPath, invalid)
        await expect(registry.create(held)).rejects.toThrow()
      }

      await writeFile(registry.holdoutKeysPath, JSON.stringify({
        held: ['SCORING_COMMAND', 'EXPECTED_OUTPUT'],
        manual: ['MANUAL_SECRET'],
      }))
      const created = await registry.create(held)
      expect(created).toMatchObject({ id: 'held', holdout: true })
      expect(created).not.toHaveProperty('holdoutKeys')
      expect(await registry.holdoutKeys('held')).toEqual(['SCORING_COMMAND', 'EXPECTED_OUTPUT'])
      expect(await readFile(created.sourcePath, 'utf8')).toContain('holdout: true')
      expect((await registry.list()).definitions).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'held', holdout: true }),
        expect.objectContaining({ id: 'manual', holdout: true }),
      ]))

      const plain = await registry.create(input('plain'))
      await expect(registry.update('plain', { holdout: true })).rejects.toThrow('needs')
      await writeFile(registry.holdoutKeysPath, JSON.stringify({
        held: ['SCORING_COMMAND'],
        manual: ['MANUAL_SECRET'],
        plain: ['PLAIN_SECRET'],
      }))
      await expect(registry.update(plain.id, { holdout: true }))
        .resolves.toMatchObject({ holdout: true })
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it('rethrows non-missing holdout sidecar read failures', async () => {
    const home = await mkdtemp(join(tmpdir(), 'dsh-shadow-registry-'))
    try {
      const registry = new ShadowRegistry(home)
      await mkdir(registry.holdoutKeysPath, { recursive: true })
      await expect(registry.holdoutKeys('held')).rejects.toThrow()
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })
})
