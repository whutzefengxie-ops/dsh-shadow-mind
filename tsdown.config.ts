/** Standalone Node and browser builds for the installable DSH bundle. */

import { readFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { transform } from 'lightningcss'
import type { UserConfig } from 'tsdown'

const PACKAGE_ID = '@whutzefengxie-ops/dsh-shadow-mind'
const CLIENT_EXTERNALS = new Set([
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/dsh-client-ui-primitives',
])
const CSS_VIRTUAL_PREFIX = '\0shadow-mind-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'
const cssFiles = new Map<string, string>()

/** Build one browser module that installs its stylesheet once and exports its CSS Modules map. */
function styleModule(file: string, css: string, classMap: Readonly<Record<string, string>>): string {
  return [
    `const css = ${JSON.stringify(css)};`,
    `const tagId = ${JSON.stringify(`${PACKAGE_ID}/${file.split(/[\\/]/u).at(-1)}`)};`,
    "if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {",
    "  const tag = document.createElement('style');",
    `  tag.dataset.plugin = ${JSON.stringify(PACKAGE_ID)};`,
    '  tag.dataset.pluginCss = tagId;',
    '  tag.textContent = css;',
    '  document.head.appendChild(tag);',
    '}',
    `export default ${JSON.stringify(classMap)};`,
  ].join('\n')
}

const node: UserConfig = {
  name: `${PACKAGE_ID}/host`,
  entry: {
    index: resolve('.build/index.js'),
    tool: resolve('.build/tool/index.js'),
    typert: 'src/generated/typert.host.js',
  },
  outDir: 'lib',
  format: 'esm',
  platform: 'node',
  target: 'node22',
  fixedExtension: false,
  clean: false,
  dts: false,
  deps: {
    neverBundle: specifier => specifier.startsWith('@deepseek-ai/') || specifier === 'yaml' || specifier === 'zod',
  },
  outputOptions: {
    entryFileNames: '[name].js',
    chunkFileNames: 'chunks/[name]-[hash].js',
  },
}

const client: UserConfig = {
  name: `${PACKAGE_ID}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2024',
  fixedExtension: false,
  clean: false,
  dts: false,
  sourcemap: false,
  deps: {
    neverBundle: specifier => CLIENT_EXTERNALS.has(specifier),
    alwaysBundle: specifier => !CLIENT_EXTERNALS.has(specifier),
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'import.meta.env.MODE': JSON.stringify('production'),
    'import.meta.env': JSON.stringify({ MODE: 'production' }),
  },
  plugins: [{
    name: 'shadow-mind-client-imports',
    resolveId(source: string) {
      if (!source.startsWith('@deepseek-ai/')
        || CLIENT_EXTERNALS.has(source)
        || source.startsWith('@deepseek-ai/dsh-session/')) return null
      throw new Error(`client bundle cannot import runtime value ${JSON.stringify(source)}`)
    },
  }, {
    name: 'shadow-mind-css-modules',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.module.css') || importer === undefined) return null
      const file = resolve(dirname(importer), source)
      const virtualId = CSS_VIRTUAL_PREFIX
        + relative(process.cwd(), file).split('\\').join('/')
        + CSS_VIRTUAL_SUFFIX
      cssFiles.set(virtualId, file)
      return virtualId
    },
    async load(virtualId: string) {
      if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const file = cssFiles.get(virtualId)
      if (file === undefined) throw new Error(`missing stylesheet for ${virtualId}`)
      this.addWatchFile(file)
      const result = transform({
        filename: file,
        code: await readFile(file),
        cssModules: { pattern: '[hash]_[local]' },
        minify: true,
      })
      const classMap: Record<string, string> = {}
      for (const [local, exported] of Object.entries(result.exports ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
        classMap[local] = exported.name
      }
      return styleModule(file, result.code.toString(), classMap)
    },
  }, {
    name: 'shadow-mind-release-whitespace',
    renderChunk(code: string) {
      return { code: code.replace(/[ \t]+(?=\r?\n)/gu, ''), map: null }
    },
  }],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default [node, client]
