import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ShadowRegistry, parseShadowDefinition } from '../src/runtime/registry.ts'

const homes: string[] = []

afterEach(async () => {
  await Promise.all(homes.splice(0).map(home => rm(home, { recursive: true, force: true })))
})

async function home(): Promise<string> {
  const value = await mkdtemp(join(tmpdir(), 'dsh-shadow-mind-'))
  homes.push(value)
  return value
}

describe('Shadow definitions', () => {
  it('parses complete frontmatter and rejects unknown fields', () => {
    const parsed = parseShadowDefinition([
      '---',
      'id: reviewer',
      'name: Reviewer',
      'activation_probability: 1',
      'active_for_models: ["deepseek/*"]',
      'tools: [read]',
      '---',
      'Report concrete defects.',
    ].join('\n'), '/definitions/reviewer.md')
    expect(parsed).toMatchObject({
      id: 'reviewer',
      activationProbability: 1,
      activeForModels: ['deepseek/*'],
      tools: ['read'],
      prompt: 'Report concrete defects.',
    })
    expect(() => parseShadowDefinition(
      '---\nid: reviewer\nsecret: value\n---\nReview.',
      '/definitions/reviewer.md',
    )).toThrow('unknown frontmatter')
  })

  it('creates, updates, deletes, and preserves opt-in debug records', async () => {
    const registry = new ShadowRegistry(await home())
    await registry.create({
      id: 'reviewer',
      name: 'Reviewer',
      enabled: true,
      debug: true,
      activationProbability: 1,
      activeForModels: [],
      tools: [],
      prompt: 'Review.',
    })
    await registry.update('reviewer', { prompt: 'Review deeply.' })
    await registry.appendDebug('reviewer', { status: 'report' })
    await registry.delete('reviewer')
    expect((await registry.list()).definitions).toEqual([])
    expect(await readFile(join(registry.logRoot, 'reviewer.jsonl'), 'utf8')).toContain('"status":"report"')
  })

  it('isolates malformed files instead of hiding valid definitions', async () => {
    const registry = new ShadowRegistry(await home())
    await registry.create({
      id: 'valid',
      name: 'Valid',
      enabled: true,
      debug: false,
      activationProbability: 1,
      activeForModels: [],
      tools: [],
      prompt: 'Review.',
    })
    await writeFile(join(registry.root, 'broken.md'), 'not frontmatter')
    const catalog = await registry.list()
    expect(catalog.definitions.map(item => item.id)).toEqual(['valid'])
    expect(catalog.diagnostics).toHaveLength(1)
  })
})
