import { Service, type Context } from '@deepseek-ai/cordis'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'

/** Writable process-local settings provider for assembled tests. */
export class MemorySettings extends Service {
  static inject = []
  readonly writable = true
  private readonly values = new Map<string, Record<string, unknown>>()
  private readonly revisions = new Map<string, number>()

  constructor(ctx: Context) { super(ctx, 'settings') }

  configure(): () => void { return () => {} }

  describe(): Array<{ ns: SettingsNamespace; value: Record<string, unknown>; revision: number; schema: object; autoGenerate: boolean; applies: 'live' }> {
    return [...this.values].map(([ns, value]) => ({ ns: ns as SettingsNamespace, value, revision: this.revisions.get(ns) ?? 0, schema: {}, autoGenerate: true, applies: 'live' as const }))
  }

  async mutate(ns: SettingsNamespace | string, ops: readonly { op: 'set' | 'unset'; path: readonly string[]; value?: unknown }[]): Promise<void> {
    const key = String(ns)
    const value = { ...(this.values.get(key) ?? {}) }
    for (const op of ops) {
      const field = op.path[0]
      if (field === undefined) continue
      if (op.op === 'unset') delete value[field]
      else value[field] = op.value
    }
    this.values.set(key, value)
    const revision = (this.revisions.get(key) ?? 0) + 1
    this.revisions.set(key, revision)
    this.ctx.emit('settings/document-updated', ns as SettingsNamespace, revision)
  }
}
