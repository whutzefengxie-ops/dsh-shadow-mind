// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ClientRemote } from '@deepseek-ai/dsh-api-gateway/client'
import * as gateway from '@deepseek-ai/dsh-api-gateway/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ShadowReportCardInjected } from '../src/client/ShadowReportCard.tsx'

const require = createRequire(import.meta.url)

interface ClientPlugin {
  readonly inject: string[]
  apply(ctx: Context): Promise<void>
}

/** Evaluate the shipped browser factory against the shell's external modules. */
function builtPlugin(): ClientPlugin {
  let plugin: ClientPlugin | undefined
  const window = {
    __ModuleLoader__: {
      load(registration: { factory(require: (id: string) => unknown): ClientPlugin }) {
        plugin = registration.factory(id => id === '@deepseek-ai/dsh-client-ui-primitives'
          ? { MarkdownText: () => null, IconTriangleRightFill14: () => null }
          : require(id))
      },
    },
  }
  new Function('window', readFileSync(resolve('lib/client.js'), 'utf8'))(window)
  if (plugin === undefined) throw new Error('Client bundle did not register its factory')
  return plugin
}

afterEach(() => { document.head.innerHTML = '' })

describe('shipped Shadow client activation', () => {
  it('mounts Remote codecs, registers UI seats, and opens child sessions through Workspace navigation', async () => {
    const ctx = new Context()
    const seats = new Map<string, { inject?: () => unknown }>()
    const openSession = vi.fn()
    const directory = { groups: [], failures: [] }
    const call = vi.fn(async () => ({ ok: true, value: directory }))
    try {
      await ctx.plugin(TypertRegistry)
      ctx.provide('connection', {
        rpc: { call, open: async function* () {} },
        registerGenerationSource: () => () => {},
        start: () => ({ stop() {} }),
      })
      await ctx.plugin(gateway)
      ctx.provide('slots', {
        inject: (_name: string, register: () => void) => register(),
        register: (seat: { key?: string; id?: string; inject?: () => unknown }) => {
          seats.set(seat.key ?? seat.id!, seat)
          return () => { seats.delete(seat.key ?? seat.id!) }
        },
      })
      ctx.provide('locale', { register: () => () => {}, bind: () => (key: string) => key })
      ctx.provide('sessions', { scope: () => undefined })
      ctx.provide('uiWorkspace', { openSession })
      ctx.provide('uiConversation', { events: { register: vi.fn() } })
      ctx.provide('settingsScope', { bind: () => ({}) })

      const fiber = ctx.plugin(builtPlugin())
      await fiber
      await vi.waitFor(() => { expect(seats.has('shadow-mind-review')).toBe(true) })
      expect(seats.has('shadow-mind')).toBe(true)
      const remote = ctx.get('remote') as ClientRemote
      await expect(remote.shadowMind.modelCatalog()).resolves.toEqual({ ok: true, value: directory })
      expect(call).toHaveBeenCalledOnce()
      const card = seats.get('shadow-mind-review')!.inject!() as ShadowReportCardInjected
      card.openSession('child-session' as SessionId)
      expect(openSession).toHaveBeenCalledWith('child-session')
      await fiber.dispose()
      expect(ctx.typert.remotes.list()).toEqual([])
    } finally {
      await ctx.fiber.dispose()
    }
  })
})
