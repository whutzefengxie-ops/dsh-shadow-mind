import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Timer from '@deepseek-ai/cordis-plugin-timer'
import { boot, initProfile, readProfilePatches, type ProfileContext } from '@deepseek-ai/dsh-app-boot'
import ConfigEditor from '@deepseek-ai/dsh-config-editor'
import Hmr from '@deepseek-ai/dsh-hmr'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import SubagentRuntime from '@deepseek-ai/dsh-subagent'
import Settings from '@deepseek-ai/dsh-settings'
import ShadowMindRuntime, { SHADOW_MIND_SETTINGS_NAMESPACE } from '../src/runtime/index.ts'
import { SHADOW_MIND_CARD_SETTINGS_NAMESPACE } from '../src/client/card-preferences.ts'

const contexts: Context[] = []
const homes: string[] = []
afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
  for (const home of homes.splice(0)) await rm(home, { recursive: true, force: true })
})

describe('DSH 0.2.0-rc.2 profile settings', () => {
  it('saves live preferences without remounting and restores them on restart', async () => {
    const home = await mkdtemp(join(tmpdir(), 'shadow-profile-settings-'))
    homes.push(home)
    const dir = join(home, 'profiles', 'test')
    initProfile(dir, ['test-bundle'])
    const bundle = join(dir, 'node_modules', 'test-bundle')
    await mkdir(bundle, { recursive: true })
    await writeFile(join(home, 'package.json'), '{"name":"shadow-settings-test"}')
    await writeFile(join(bundle, 'package.json'), JSON.stringify({
      name: 'test-bundle', version: '1.0.0', dsh: { bundle: { patch: 'cordis.patch.yml' } },
    }))
    await writeFile(join(bundle, 'cordis.patch.yml'), JSON.stringify([{ insert: [
      { id: 'config-editor', name: 'cordis:editor' },
      { id: 'settings', name: 'cordis:settings' },
      { id: 'agents', name: 'cordis:agents' },
      { id: 'subagents', name: 'cordis:subagents' },
      { id: 'shadow-mind-runtime', name: 'cordis:shadow', config: { dshHome: home, defaultShadowTimeoutSeconds: 45 } },
    ] }]))
    await writeFile(join(dir, 'cordis.yml'), '[]\n')
    const profile: ProfileContext = {
      name: 'test', startedBundles: ['test-bundle'], dir, patchPath: join(dir, 'cordis.patch.yml'),
      installAnchor: join(home, 'package.json'), cwd: home, home, overlays: [], telemetryDisabledEnv: undefined,
    }
    const start = async () => {
      const ctx = await boot('test', join(dir, 'cordis.yml'), readProfilePatches('test', profile), ctx => {
        ctx.provide('profileContext', profile)
        ctx.provide('appReady', { onReady: (listener: () => void) => { listener(); return () => {} } })
        Object.assign(ctx.loader.builtins, {
          editor: ConfigEditor, settings: Settings, agents: AgentRegistry, subagents: SubagentRuntime, shadow: ShadowMindRuntime,
        })
      })
      contexts.push(ctx)
      await ctx.plugin(Timer)
      await ctx.plugin(Hmr, { root: [], ignored: [], debounce: 0 })
      await ctx.hmr.runExclusive(async () => {})
      return ctx
    }

    const ctx = await start()
    const runtime = ctx.shadowMind
    const fiber = ctx.configEditor.entries().find(entry => entry.options.id === SHADOW_MIND_SETTINGS_NAMESPACE)!.fiber
    expect(runtime.currentSettings().defaultShadowTimeoutSeconds).toBe(45)
    expect(SHADOW_MIND_CARD_SETTINGS_NAMESPACE).toBe(SHADOW_MIND_SETTINGS_NAMESPACE)
    const form = ctx.settings.describe().find(row => row.ns === SHADOW_MIND_SETTINGS_NAMESPACE)!
    expect(form.autoGenerate).toBe(false)
    expect(form.value).not.toHaveProperty('dshHome')
    await runtime.updateSettings({ defaultShadowTimeoutSeconds: 23, randomSeed: 7, collapsedByDefault: false })
    expect(ctx.configEditor.entries().find(entry => entry.options.id === SHADOW_MIND_SETTINGS_NAMESPACE)!.fiber === fiber).toBe(true)
    expect(runtime.currentSettings()).toMatchObject({ defaultShadowTimeoutSeconds: 23, randomSeed: 7, collapsedByDefault: false })
    expect(await readFile(profile.patchPath, 'utf8')).toContain('collapsedByDefault: false')
    await runtime.updateSettings({ randomSeed: null })
    expect(runtime.currentSettings()).not.toHaveProperty('randomSeed')
    await ctx.fiber.dispose()
    const restored = await start()
    expect(restored.shadowMind.currentSettings()).toMatchObject({ defaultShadowTimeoutSeconds: 23, collapsedByDefault: false })
    expect(restored.shadowMind.currentSettings()).not.toHaveProperty('randomSeed')
  }, 30_000)
})
