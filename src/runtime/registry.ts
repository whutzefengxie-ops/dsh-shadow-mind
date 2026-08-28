/**
 * Markdown/YAML Shadow definition registry with isolated diagnostics and atomic writes.
 * The runtime schedules exactly one Shadow definition (`default`); every other
 * Markdown file is kept read-only for diagnostics and never participates in scheduling.
 * @module @whutzefengxie-ops/dsh-shadow-mind/registry
 */

import { appendFile, lstat, mkdir, readFile, readdir } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { optionalModelRoute } from './model-route.ts'
import { DEFAULT_ACTIVATION_PROBABILITY } from './config.ts'
import { DEFAULT_SHADOW_ID } from './types.ts'
import type {
  CreateShadowDefinition,
  ShadowCatalog,
  ShadowDefinition,
  ShadowDefinitionInput,
  ShadowDiagnostic,
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
  // Accepted but ignored: definitions written while the removed agent-preset
  // binding was shipped must keep loading instead of failing the catalog.
  'agent_preset',
  'timeout_seconds',
  'tools',
  'capture',
  'context',
  'think_first',
  // Accepted but ignored: the skip/boost predicate library was removed; legacy
  // definition files carrying these keys must keep loading instead of failing.
  'pre_filter',
  'boost_filter',
  'boost_factor',
  'holdout',
])

/** Built-in duty prompt used when `default.md` is created from scratch. */
export const DEFAULT_SHADOW_PROMPT = [
  'Review the root agent\'s latest turn against its task and the rendered trajectory.',
  '',
  'Priority checks:',
  '',
  '1. Did the root miss an explicit requirement, constraint, or acceptance condition from the user?',
  '2. Does a conclusion contradict tool results, file contents, test output, or recorded errors?',
  '3. Did the changes introduce a functional defect, security issue, data-loss risk, concurrency problem, or platform-specific breakage?',
  '4. Did the root claim completion without required verification?',
  '5. Did the root repeat the same failing action without changing its input or addressing the cause?',
  '',
  'Rules:',
  '',
  '- Report only issues directly supported by the rendered trajectory and worth the user\'s action.',
  '- Never report style preferences, naming opinions, or generic improvements.',
  '- Never guess hidden reasoning, redacted arguments, or omitted tool results.',
  '- Every report must state the problem, the evidence, the impact, and a suggested fix.',
  '- `refs` must only contain rendered sequence numbers from the current trajectory.',
  '- Return `report` with a verdict (challenge/gap/confirm/uncertain) for actionable findings, `silent` when the review found nothing actionable, and `not_relevant` when the turn does not suit a review.',
].join('\n')

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

/** Parse one optional closed string value. */
function optionalChoice<const T extends string>(
  record: Record<string, unknown>,
  key: string,
  values: readonly T[],
  fallback: T,
): T {
  const value = record[key]
  if (value === undefined) return fallback
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new Error(`${key} must be one of ${values.join(', ')}`)
  }
  return value as T
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
  if (/\r|\n/u.test(name)) throw new Error('name must be a single line')
  const prompt = normalized.slice(closing + '\n---\n'.length).trim()
  if (prompt === '') throw new Error('Markdown body must be non-empty')

  const probability = parsed['activation_probability'] ?? DEFAULT_ACTIVATION_PROBABILITY
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
    capture: optionalChoice(parsed, 'capture', ['full', 'since-compaction'] as const, 'full'),
    context: optionalChoice(parsed, 'context', ['standard', 'minimal'] as const, 'standard'),
    thinkFirst: optionalBoolean(parsed, 'think_first', false),
    holdout: optionalBoolean(parsed, 'holdout', false),
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
  if (definition.capture !== undefined && definition.capture !== 'full') metadata['capture'] = definition.capture
  if (definition.context !== undefined && definition.context !== 'standard') metadata['context'] = definition.context
  if (definition.thinkFirst === true) metadata['think_first'] = true
  if (definition.holdout === true) metadata['holdout'] = true
  return `---\n${stringifyYaml(metadata, { sortMapEntries: true }).trimEnd()}\n---\n\n${definition.prompt.trim()}\n`
}

/** Build the definition seeded when no `default.md` exists yet. */
function defaultSeed(legacy: readonly ShadowDefinition[]): CreateShadowDefinition {
  // Migration: adopt the first legacy definition's duty so an existing user's
  // reviewer persona survives, while the probability converges to the new 70%
  // product default.
  const first = legacy[0]
  if (first === undefined) {
    return {
      id: DEFAULT_SHADOW_ID,
      name: 'Shadow',
      enabled: true,
      debug: false,
      activationProbability: DEFAULT_ACTIVATION_PROBABILITY,
      activeForModels: [],
      tools: [],
      capture: 'full',
      context: 'standard',
      thinkFirst: false,
      holdout: false,
      prompt: DEFAULT_SHADOW_PROMPT,
    }
  }
  return {
    id: DEFAULT_SHADOW_ID,
    name: first.name,
    enabled: first.enabled,
    debug: first.debug,
    activationProbability: DEFAULT_ACTIVATION_PROBABILITY,
    activeForModels: [],
    ...first.runWithModel === undefined ? {} : { runWithModel: first.runWithModel },
    ...first.reasoningEffort === undefined ? {} : { reasoningEffort: first.reasoningEffort },
    // timeoutSeconds is deliberately NOT inherited: the user asked for the new
    // 10-minute global default to govern migration, so a legacy definition's
    // stale timeout must not override it. The user can still set a timeout on
    // the default Shadow through the settings page advanced field.
    tools: [...first.tools],
    capture: first.capture,
    context: first.context,
    thinkFirst: first.thinkFirst,
    holdout: false,
    prompt: first.prompt,
  }
}

/** Local Shadow definition store rooted under one Harness home. */
export class ShadowRegistry {
  /** Definition directory. */
  readonly root: string
  /** Debug-log directory preserved when definitions are deleted. */
  readonly logRoot: string
  /** Metadata-only value-loop journal shared across sessions. */
  readonly valueLoopPath: string
  /** Owner-only literal sidecar for holdout definitions. */
  readonly holdoutKeysPath: string
  private readonly mutations = new Map<string, Promise<void>>()

  /** @param dshHome Resolved Harness home. */
  constructor(dshHome: string) {
    this.root = resolve(dshHome, 'shadow-minds')
    this.logRoot = join(this.root, 'logs')
    this.valueLoopPath = join(this.root, 'value-loop.jsonl')
    this.holdoutKeysPath = join(this.root, 'holdout-keys.json')
  }

  /**
   * Append one metadata-only challenge outcome.
   * @param record Classification metadata without trajectory or report text.
   */
  async appendValueLoop(record: Record<string, unknown>): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 })
    await appendFile(this.valueLoopPath, `${JSON.stringify(record)}\n`, { encoding: 'utf8', mode: 0o600 })
  }

  /**
   * Load and validate operator-managed literal keys for one holdout definition.
   * @param id Definition id.
   * @returns Non-empty unique literal keys.
   */
  async holdoutKeys(id: string): Promise<readonly string[]> {
    let source: string
    try {
      source = await readFile(this.holdoutKeysPath, 'utf8')
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(
          `holdout definition ${JSON.stringify(id)} needs ${this.holdoutKeysPath} containing `
          + `{"${id}": ["literal", ...]}; create the sidecar as the operator, or remove `
          + '"holdout: true" from the definition',
        )
      }
      throw error
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(source)
    } catch (cause: unknown) {
      throw new Error('invalid holdout key sidecar JSON', { cause })
    }
    if (!isRecord(parsed)) throw new Error('holdout key sidecar must be a JSON object')
    const keys = parsed[id]
    if (!Array.isArray(keys) || keys.length === 0
      || keys.some(key => typeof key !== 'string' || key.trim() === '')
      || new Set(keys).size !== keys.length) {
      throw new Error(`holdout definition ${JSON.stringify(id)} needs unique non-empty literal keys`)
    }
    return Object.freeze([...(keys as string[])])
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
        if (definition.holdout) await this.holdoutKeys(definition.id)
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
   * Load the single scheduled Shadow definition, creating `default.md` on first
   * access. When legacy definition files exist, the default is seeded from the
   * first one so an existing user's reviewer persona survives migration; its
   * activation probability always converges to the 70% product default.
   * @returns The validated default definition.
   */
  async defaultDefinition(): Promise<ShadowDefinition> {
    const path = join(this.root, `${DEFAULT_SHADOW_ID}.md`)
    const catalog = await this.list()
    const existing = catalog.definitions.find(definition => definition.id === DEFAULT_SHADOW_ID)
    if (existing !== undefined) return existing
    const legacy = catalog.definitions.filter(definition => definition.id !== DEFAULT_SHADOW_ID)
    const seeded = defaultSeed(legacy)
    try {
      await lstat(path)
      throw new Error(`shadow definition path already exists: ${path}`)
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    const parsed = parseShadowDefinition(serializeDefinition(seeded), path)
    await writeFileAtomic(path, serializeDefinition(parsed), { mode: 0o600, dirMode: 0o700 })
    return parsed
  }

  /**
   * Persist the complete single Shadow definition as `default.md`.
   * @param input Complete wire fields for the default Shadow.
   * @returns Validated definition with its source path.
   */
  async saveDefault(input: ShadowDefinitionInput): Promise<ShadowDefinition> {
    if (input.id !== DEFAULT_SHADOW_ID) {
      throw new Error(`only the default Shadow can be saved; expected id ${JSON.stringify(DEFAULT_SHADOW_ID)}`)
    }
    return this.mutate(DEFAULT_SHADOW_ID, async () => {
      if (input.holdout === true) await this.holdoutKeys(input.id)
      const path = join(this.root, `${DEFAULT_SHADOW_ID}.md`)
      const current = (await this.list()).definitions.find(definition => definition.id === DEFAULT_SHADOW_ID)
      const next: CreateShadowDefinition = {
        id: input.id,
        name: input.name,
        enabled: input.enabled,
        debug: input.debug,
        activationProbability: input.activationProbability,
        activeForModels: [...input.activeForModels],
        ...input.runWithModel === null ? {} : { runWithModel: input.runWithModel },
        ...input.reasoningEffort === null ? {} : { reasoningEffort: input.reasoningEffort },
        ...input.timeoutSeconds === null ? {} : { timeoutSeconds: input.timeoutSeconds },
        tools: [...input.tools],
        capture: input.capture,
        context: input.context,
        thinkFirst: input.thinkFirst,
        // The Web form cannot administer the operator-managed sidecar; saving
        // never silently enables holdout when the file did not ask for it.
        holdout: current?.holdout === true || input.holdout === true,
        prompt: input.prompt,
      }
      const parsed = parseShadowDefinition(serializeDefinition(next), path)
      await writeFileAtomic(path, serializeDefinition(parsed), { mode: 0o600, dirMode: 0o700 })
      return parsed
    })
  }

  /**
   * Append one JSON Lines debug record for a definition that opted in.
   * @param id Definition id used as the log filename.
   * @param record Diagnostic record to append.
   */
  async appendDebug(id: string, record: Record<string, unknown>): Promise<void> {
    await this.mutate(id, async () => {
      await mkdir(this.logRoot, { recursive: true, mode: 0o700 })
      await appendFile(
        join(this.logRoot, `${id}.jsonl`),
        `${JSON.stringify(record)}\n`,
        { encoding: 'utf8', mode: 0o600 },
      )
    })
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
