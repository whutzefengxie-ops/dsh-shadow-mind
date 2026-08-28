import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

interface Manifest {
  readonly name: string
  readonly scripts?: Record<string, string>
  readonly exports: Record<string, unknown>
  readonly dsh?: {
    readonly bundle?: { readonly patch?: string }
    readonly client?: { readonly platform?: string; readonly external?: readonly string[] }
  }
}

describe('installable bundle', () => {
  it('publishes prebuilt host, client, typert, and patch entries without an install-time build', () => {
    const manifest = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as Manifest
    expect(manifest.name).toBe('@whutzefengxie-ops/dsh-shadow-mind')
    expect(manifest.scripts).not.toHaveProperty('prepare')
    expect(manifest.exports).toMatchObject({
      '.': { default: './lib/index.js' },
      './tool': { default: './lib/tool.js' },
      './client': './lib/client.js',
      './typert': './lib/typert.js',
    })
    expect(manifest.dsh).toMatchObject({
      bundle: { patch: './cordis.patch.yml' },
      client: { platform: 'web' },
    })
    expect(manifest.dsh?.client).not.toHaveProperty('external')
  })

  it('mounts exactly the runtime and management plugin from the standalone package', () => {
    const patch = parse(readFileSync(resolve('cordis.patch.yml'), 'utf8')) as Array<{
      readonly insert: readonly { readonly id: string; readonly name: string }[]
    }>
    expect(patch).toEqual([{
      insert: [
        { id: 'shadow-mind-runtime', name: '@whutzefengxie-ops/dsh-shadow-mind' },
        { id: 'tool-shadow-mind', name: '@whutzefengxie-ops/dsh-shadow-mind/tool' },
      ],
    }])
  })
})
