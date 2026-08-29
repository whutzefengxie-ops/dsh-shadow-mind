import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import {
  effectivePromptCapChars,
  resolveModelPromptCapChars,
  SHADOW_PROMPT_CHARS_PER_TOKEN,
  SHADOW_PROMPT_RESERVE_CHARS,
} from '../src/runtime/model-context.ts'

function contextWith(llm: unknown): Context {
  return { get: () => llm } as unknown as Context
}

describe('resolveModelPromptCapChars', () => {
  it('returns 0 when no route, no LLM service, or a malformed route is supplied', async () => {
    expect(await resolveModelPromptCapChars(contextWith(undefined), undefined)).toBe(0)
    expect(await resolveModelPromptCapChars(contextWith(undefined), 'provider/model')).toBe(0)
    expect(await resolveModelPromptCapChars(contextWith({}), 'model-only')).toBe(0)
    expect(await resolveModelPromptCapChars(contextWith({}), 'provider/')).toBe(0)
  })

  it('returns 0 when the model advertises no context window', async () => {
    const llm = {
      resolveModelInfo: async () => ({ context: undefined }),
    }
    expect(await resolveModelPromptCapChars(contextWith(llm), 'provider/model')).toBe(0)
  })

  it('returns 0 when the adapter lookup fails instead of failing the run', async () => {
    const llm = {
      resolveModelInfo: async () => { throw new Error('adapter offline') },
    }
    expect(await resolveModelPromptCapChars(contextWith(llm), 'provider/model')).toBe(0)
  })

  it('derives a conservative char cap from the context window with response headroom', async () => {
    const llm = {
      resolveModelInfo: async (provider: string, model: string) => {
        expect(provider).toBe('provider')
        expect(model).toBe('org/model')
        return { context: { contextWindow: 128_000 } }
      },
    }
    expect(await resolveModelPromptCapChars(contextWith(llm), 'provider/org/model'))
      .toBe(128_000 * SHADOW_PROMPT_CHARS_PER_TOKEN - SHADOW_PROMPT_RESERVE_CHARS)
  })

  it('clamps a tiny context window to no cap at all', async () => {
    const llm = {
      resolveModelInfo: async () => ({ context: { contextWindow: 1_000 } }),
    }
    expect(await resolveModelPromptCapChars(contextWith(llm), 'provider/model')).toBe(0)
  })
})

describe('effectivePromptCapChars', () => {
  it('combines the user bound with the model cap so the stricter one applies', () => {
    expect(effectivePromptCapChars(0, 0)).toBe(0)
    expect(effectivePromptCapChars(0, 400_000)).toBe(400_000)
    expect(effectivePromptCapChars(220_000, 0)).toBe(220_000)
    expect(effectivePromptCapChars(220_000, 400_000)).toBe(220_000)
    expect(effectivePromptCapChars(500_000, 400_000)).toBe(400_000)
  })
})
