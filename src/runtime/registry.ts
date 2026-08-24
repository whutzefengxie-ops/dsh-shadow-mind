/**
 * Markdown/YAML Shadow definition registry with isolated diagnostics and atomic writes.
 * @module @whutzefengxie-ops/dsh-shadow-mind/registry
 */

import { appendFile, lstat, mkdir, readFile, readdir, rm } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { optionalModelRoute } from './model-route.ts'
import type {
  CreateShadowDefinition,
  ShadowCatalog,
  ShadowDefinition,
  ShadowDiagnostic,
  UpdateShadowDefinition,
} from './types.ts'

/** Valid Shadow identifiers and canonical definition filenames. */
export const SHADOW_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/u
const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_-]*$/u
const FRONTMATTER_KEYS = new Set([
  'id',
  'name',
  'enabled',
  'debug',
  'activation_probability',
  'active_for_models',
  'run_with_model',
  'reasoning_effort',
  'timeout_seconds',
  'tools',
])

/** Return whether a parsed YAML value is a plain mapping. */
function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value) as unknown
  /* v8 ignore else -- YAML mappings use Object.prototype; retain null-prototype acceptance for direct parser callers. */
  if (prototype === Object.prototype) return true
  /* v8 ignore next -- YAML mappings use Object.prototype; retain null-prototype acceptance for direct parser callers. */
  return prototype === null
}

/** Parse one optional non-empty string field. */
function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${key} must be a non-empty string`)
  return value.trim()
}

/** Parse one optional boolean field. */
function optionalBoolean(record: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = record[key]
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') throw new Error(`${key} must be a boolean`)
  return value
}

/** Parse a string-array field and reject duplicates. */
function stringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key]
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some(entry => typeof entry !== 'string' || entry.trim() === '')) {
    throw new Error(`${key} must be an array of non-empty strings`)
  }
  const entries = value.map(entry => (entry as string).trim())
  if (new Set(entries).size !== entries.length) throw new Error(`${key} must not contain duplicates`)
  return entries
}

/**
 * Parse one complete definition document.
 * @param source Markdown source.
 * @param sourcePath Absolute source path used for defaults and diagnostics.
 * @returns Validated immutable definition.
 */
export function parseShadowDefinition(source: string, sourcePath: string): ShadowDefinition {
  const normalized = source.replace(/\r\n/gu, '\n')
  if (!normalized.startsWith('---\n')) throw new Error('definition must start with YAML frontmatter')
  const closing = normalized.indexOf('\n---\n', 4)
  if (closing < 0) throw new Error('definition frontmatter needs a closing --- line')
  let parsed: unknown
  try {
    parsed = parseYaml(normalized.slice(4, closing))
  } catch (cause: unknown) {
    /* v8 ignore else -- yaml parse failures are Error instances. */
    if (cause instanceof Error) throw new Error(`invalid YAML frontmatter: ${cause.message}`)
    /* v8 ignore next -- yaml does not throw non-Error values. */
    throw new Error(`invalid YAML frontmatter: ${String(cause)}`)
  }
  if (!isRecord(parsed)) throw new Error('frontmatter must be a YAML mapping')
  const unknown = Object.keys(parsed).filter(key => !FRONTMATTER_KEYS.has(key))
  if (unknown.length > 0) throw new Error(`unknown frontmatter field(s): ${unknown.sort().join(', ')}`)

  const stem = basename(sourcePath, '.md')
  const id = optionalString(parsed, 'id') ?? stem
  if (!SHADOW_ID_PATTERN.test(id)) throw new Error(`id must match ${String(SHADOW_ID_PATTERN)}`)
  const name = optionalString(parsed, 'name') ?? id
  const prompt = normalized.slice(closing + '\n---\n'.length).trim()
  if (prompt === '') throw new Error('Markdown body must be non-empty')

  const probability = parsed['activation_probability'] ?? 0.3
  if (typeof probability !== 'number' || !Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new Error('activation_probability must be a finite number from 0 through 1')
  }
  const timeout = parsed['timeout_seconds']
  if (timeout !== undefined && (typeof timeout !== 'number' || !Number.isFinite(timeout) || timeout <= 0)) {
    throw new Error('timeout_seconds must be a positive finite number')
  }
  const tools = stringArray(parsed, 'tools')
  for (const tool of tools) {
    if (!TOOL_NAME_PATTERN.test(tool)) throw new Error(`tool ${JSON.stringify(tool)} must match ${String(TOOL_NAME_PATTERN)}`)
  }

  const runWithModel = optionalModelRoute(optionalString(parsed, 'run_with_model'), 'run_with_model')
  const reasoningEffort = optionalString(parsed, 'reasoning_effort')
  return Object.freeze({
    id,
    name,
    enabled: optionalBoolean(parsed, 'enabled', true),
    debug: optionalBoolean(parsed, 'debug', false),
    activationProbability: probability,
    activeForModels: Object.freeze(stringArray(parsed, 'active_for_models')),
    ...runWithModel === undefined ? {} : { runWithModel },
    ...reasoningEffort === undefined ? {} : { reasoningEffort },
    ...timeout === undefined ? {} : { timeoutSeconds: timeout },
    tools: Object.freeze(tools),
    prompt,
    sourcePath: resolve(sourcePath),
  })
}

/** Render one definition in the canonical on-disk form. */
function serializeDefinition(definition: CreateShadowDefinition): string {
  const metadata: Record<string, unknown> = {
    id: definition.id,
    name: definition.name,
    enabled: definition.enabled,
    debug: definition.debug,
    activation_probability: definition.activationProbability,
  }
  if (definition.activeForModels.length > 0) metadata['active_for_models'] = [...definition.activeForModels]
  if (definition.runWithModel !== undefined) metadata['run_with_model'] = definition.runWithModel
  if (definition.reasoningEffort !== undefined) metadata['reasoning_effort'] = definition.reasoningEffort
  if (definition.timeoutSeconds !== undefined) metadata['timeout_seconds'] = definition.timeoutSeconds
  if (definition.tools.length > 0) metadata['tools'] = [...definition.tools]
  return `---\n${stringifyYaml(metadata, { sortMapEntries: true }).trimEnd()}\n---\n\n${definition.prompt.trim()}\n`
}

/** Convert a loaded definition to the authoring form used by atomic updates. */
function editable(definition: ShadowDefinition): CreateShadowDefinition {
  return {
    id: definition.id,
    name: definition.name,
    enabled: definition.enabled,
    debug: definition.debug,
    activationProbability: definition.activationProbability,
    activeForModels: [...definition.activeForModels],
    ...definition.runWithModel === undefined ? {} : { runWithModel: definition.runWithModel },
    ...definition.reasoningEffort === undefined ? {} : { reasoningEffort: definition.reasoningEffort },
    ...definition.timeoutSeconds === undefined ? {} : { timeoutSeconds: definition.timeoutSeconds },
    tools: [...definition.tools],
    prompt: definition.prompt,
  }
}

/** Apply an update while omitting execution overrides that were explicitly cleared. */
function updatedDefinition(current: ShadowDefinition, patch: UpdateShadowDefinition): CreateShadowDefinition {
  const merged = { ...editable(current), ...patch }
  return {
    id: current.id,
    name: merged.name,
    enabled: merged.enabled,
    debug: merged.debug,
    activationProbability: merged.activationProbability,
    activeForModels: merged.activeForModels,
    ...merged.runWithModel === undefined ? {} : { runWithModel: merged.runWithModel },
    ...merged.reasoningEffort === undefined ? {} : { reasoningEffort: merged.reasoningEffort },
    ...merged.timeoutSeconds === undefined ? {} : { timeoutSeconds: merged.timeoutSeconds },
    tools: merged.tools,
    prompt: merged.prompt,
  }
}

/** Local Shadow definition store rooted under one Harness home. */
export class ShadowRegistry {
  /** Definition directory. */
  readonly root: string
  /** Debug-log directory preserved when definitions are deleted. */
  readonly logRoot: string
  private readonly mutations = new Map<string, Promise<void>>()

  /** @param dshHome Resolved Harness home. */
  constructor(dshHome: string) {
    this.root = resolve(dshHome, 'shadow-minds')
    this.logRoot = join(this.root, 'logs')
  }

  /**
   * Load all readable definition files while isolating per-file failures.
   * @returns Current valid definitions and file-local diagnostics.
   */
  async list(): Promise<ShadowCatalog> {
    let names: string[]
    try {
      const entries = await readdir(this.root, { withFileTypes: true })
      names = entries.filter(entry => entry.isFile() && entry.name.endsWith('.md')).map(entry => entry.name).sort()
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { definitions: [], diagnostics: [] }
      throw error
    }
    const definitions: ShadowDefinition[] = []
    const diagnostics: ShadowDiagnostic[] = []
    const ids = new Map<string, string>()
    for (const name of names) {
      const path = join(this.root, name)
      try {
        const definition = parseShadowDefinition(await readFile(path, 'utf8'), path)
        const first = ids.get(definition.id)
        if (first !== undefined) {
          diagnostics.push({ path, error: `duplicate id ${JSON.stringify(definition.id)}; first valid source is ${first}` })
          continue
        }
        ids.set(definition.id, path)
        definitions.push(definition)
      } catch (error: unknown) {
        /* v8 ignore else -- filesystem and parser failures are Error instances. */
        if (error instanceof Error) diagnostics.push({ path, error: error.message })
        else diagnostics.push({ path, error: String(error) })
      }
    }
    return { definitions: Object.freeze(definitions), diagnostics: Object.freeze(diagnostics) }
  }

  /**
   * Create a new canonical `<id>.md` definition.
   * @param input Complete definition fields.
   * @returns Validated definition with its source path.
   */
  async create(input: CreateShadowDefinition): Promise<ShadowDefinition> {
    return this.mutate(input.id, async () => {
      const path = join(this.root, `${input.id}.md`)
      const catalog = await this.list()
      if (catalog.definitions.some(definition => definition.id === input.id)) {
        throw new Error(`shadow ${JSON.stringify(input.id)} already exists`)
      }
      try {
        await lstat(path)
        throw new Error(`shadow definition path already exists: ${path}`)
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
      const parsed = parseShadowDefinition(serializeDefinition(input), path)
      await writeFileAtomic(path, serializeDefinition(parsed), { mode: 0o600, dirMode: 0o700 })
      return parsed
    })
  }

  /**
   * Update one existing definition and preserve its source path.
   * @param id Existing definition id.
   * @param patch Fields to replace.
   * @returns Updated validated definition.
   */
  async update(id: string, patch: UpdateShadowDefinition): Promise<ShadowDefinition> {
    return this.mutate(id, async () => {
      const current = await this.expect(id)
      const next = updatedDefinition(current, patch)
      const parsed = parseShadowDefinition(serializeDefinition(next), current.sourcePath)
      await writeFileAtomic(current.sourcePath, serializeDefinition(parsed), { mode: 0o600, dirMode: 0o700 })
      return parsed
    })
  }

  /**
   * Set one existing definition's enabled flag.
   * @param id Existing definition id.
   * @param enabled Next scheduling state.
   * @returns Updated validated definition.
   */
  setEnabled(id: string, enabled: boolean): Promise<ShadowDefinition> {
    return this.update(id, { enabled })
  }

  /**
   * Delete one definition file while preserving its debug log.
   * @param id Existing definition id.
   */
  async delete(id: string): Promise<void> {
    await this.mutate(id, async () => {
      const current = await this.expect(id)
      await rm(current.sourcePath)
    })
  }

  /**
   * Append one JSON Lines debug record for a definition that opted in.
   * @param id Definition id used as the log filename.
   * @param record Diagnostic record to append.
   */
  async appendDebug(id: string, record: Record<string, unknown>): Promise<void> {
    if (!SHADOW_ID_PATTERN.test(id)) throw new Error(`shadow id must match ${String(SHADOW_ID_PATTERN)}`)
    await mkdir(this.logRoot, { recursive: true, mode: 0o700 })
    await appendFile(join(this.logRoot, `${id}.jsonl`), `${JSON.stringify(record)}\n`, { encoding: 'utf8', mode: 0o600 })
  }

  /** Find one current winning definition or fail loud. */
  private async expect(id: string): Promise<ShadowDefinition> {
    const definition = (await this.list()).definitions.find(candidate => candidate.id === id)
    if (definition === undefined) throw new Error(`shadow ${JSON.stringify(id)} does not exist`)
    return definition
  }

  /** Serialize same-id mutations while allowing independent ids to overlap. */
  private async mutate<T>(id: string, operation: () => Promise<T>): Promise<T> {
    if (!SHADOW_ID_PATTERN.test(id)) throw new Error(`shadow id must match ${String(SHADOW_ID_PATTERN)}`)
    const previous = this.mutations.get(id) ?? Promise.resolve()
    let release!: () => void
    const current = new Promise<void>((resolveRelease) => { release = resolveRelease })
    const tail = previous.then(() => current)
    this.mutations.set(id, tail)
    await previous
    try {
      return await operation()
    } finally {
      release()
      if (this.mutations.get(id) === tail) this.mutations.delete(id)
    }
  }
}
