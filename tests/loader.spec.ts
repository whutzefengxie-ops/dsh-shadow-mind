import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import { SettingsProvider } from '@deepseek-ai/dsh-settings'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import SubagentRuntime from '@deepseek-ai/dsh-subagent'
import ApprovalService from '@deepseek-ai/dsh-user-approval'

class MemorySettings extends SettingsProvider {
  readonly writable = true

  protected load(): Promise<Record<string, unknown>> {
    return Promise.resolve({})
  }

  protected persist(_ns: SettingsNamespace, _section: Record<string, unknown>): Promise<void> {
    return Promise.resolve()
  }
}

describe('built plugin entry points', () => {
  it('activates the runtime and management tools through a real Loader', async () => {
    const dshHome = await mkdtemp(join(tmpdir(), 'dsh-shadow-loader-'))
    const ctx = new Context()
    try {
      await mountAgentLoopTestDependencies(ctx)
      await ctx.plugin(MemorySettings)
      await ctx.plugin(SubagentRuntime)
      await ctx.plugin(CommandRuntime)
      await ctx.plugin(ApprovalService, { policy: 'never' })
      await ctx.plugin(Loader)

      const runtimeUrl = pathToFileURL(join(import.meta.dirname, '..', 'lib', 'index.js')).href
      const toolUrl = pathToFileURL(join(import.meta.dirname, '..', 'lib', 'tool.js')).href
      await ctx.loader.create({ name: runtimeUrl, config: { dshHome } })
      await ctx.loader.create({ name: toolUrl })
      await ctx.loader.await()

      expect(ctx.get('shadowMind')).toBeDefined()
      expect(ctx.tools.schemas().map(schema => schema.name)).toEqual([
        'list_shadows',
        'create_shadow',
        'update_shadow',
        'enable_shadow',
        'disable_shadow',
        'delete_shadow',
        'get_shadow_config',
        'update_shadow_config',
      ])
    } finally {
      await ctx.fiber.dispose()
      await rm(dshHome, { recursive: true, force: true })
    }
  })
})
