import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import {
  estimateTextTokens,
  resolveModelPromptTokenBudget,
  SHADOW_PROMPT_NON_CJK_CHARS_PER_TOKEN,
  SHADOW_PROMPT_RESERVE_TOKENS,
} from '../src/runtime/model-context.ts'

function contextWith(llm: unknown): Context {
  return { get: () => llm } as unknown as Context
}

describe('estimateTextTokens', () => {
  it('counts plain text at two characters per token, above the published English density', () => {
    expect(SHADOW_PROMPT_NON_CJK_CHARS_PER_TOKEN).toBe(2)
    expect(estimateTextTokens('a'.repeat(40))).toBe(20)
    expect(estimateTextTokens('')).toBe(0)
    expect(estimateTextTokens('abcd')).toBe(2)
  })

  it('counts each CJK character as one token, which overestimates for Chinese', () => {
    // DeepSeek's tokenizer averages roughly 0.6 tokens per Chinese character,
    // so one token per character is the conservative upper bound.
    expect(estimateTextTokens('汉'.repeat(100))).toBe(100)
    expect(estimateTextTokens('你好世界')).toBe(4)
    expect(estimateTextTokens('全角标点，句号。')).toBe(8)
  })

  it('counts CJK extension characters (two UTF-16 units) as two tokens', () => {
    // 𠮷 (U+20BB7, Extension B) tokenizes to at least two byte-fallback tokens;
    // counting its two UTF-16 units keeps the estimate on the safe side.
    expect(estimateTextTokens('𠮷')).toBe(2)
    expect(estimateTextTokens('𠮷a')).toBe(3)
    expect(estimateTextTokens('𠮷'.repeat(10))).toBe(20)
    expect(estimateTextTokens('普通汉字𠮷扩展')).toBe(6 + 2)
  })

  it('mixes dense and sparse scripts additively', () => {
    // 2 CJK chars + 3 ASCII chars: 2 + ceil(3/2) = 4.
    expect(estimateTextTokens('abc中文')).toBe(4)
  })

  it('stays above the published reference densities for prose', () => {
    // DeepSeek's token-usage reference: ≈0.3 tokens per English character and
    // ≈0.6 tokens per Chinese character. The estimate must be at least that
    // dense for representative prose so it can only overestimate.
    const english = 'The trajectory shows a read result followed by an assistant message. '.repeat(20)
    expect(estimateTextTokens(english)).toBeGreaterThanOrEqual(Math.ceil(english.length * 0.3))
    const chinese = '轨迹显示先有一次读取结果，随后是一条助手消息。'.repeat(20)
    expect(estimateTextTokens(chinese)).toBeGreaterThanOrEqual(Math.ceil(chinese.length * 0.6))
  })

  it('never exceeds the character count', () => {
    const samples = ['中文轨迹内容', 'mixed 中英文 content', 'x'.repeat(500) + '汉'.repeat(500), '𠮷'.repeat(20)]
    for (const sample of samples) {
      expect(estimateTextTokens(sample)).toBeLessThanOrEqual(sample.length)
    }
  })
})

describe('resolveModelPromptTokenBudget', () => {
  it('returns 0 when no route, no LLM service, or a malformed route is supplied', async () => {
    expect(await resolveModelPromptTokenBudget(contextWith(undefined), undefined)).toBe(0)
    expect(await resolveModelPromptTokenBudget(contextWith(undefined), 'provider/model')).toBe(0)
    expect(await resolveModelPromptTokenBudget(contextWith({}), 'model-only')).toBe(0)
    expect(await resolveModelPromptTokenBudget(contextWith({}), 'provider/')).toBe(0)
  })

  it('returns 0 when the model advertises no context window', async () => {
    const llm = {
      resolveModelInfo: async () => ({ context: undefined }),
    }
    expect(await resolveModelPromptTokenBudget(contextWith(llm), 'provider/model')).toBe(0)
  })

  it('returns 0 when the adapter lookup fails instead of failing the run', async () => {
    const llm = {
      resolveModelInfo: async () => { throw new Error('adapter offline') },
    }
    expect(await resolveModelPromptTokenBudget(contextWith(llm), 'provider/model')).toBe(0)
  })

  it('derives the budget as the context window minus the fallback reserve', async () => {
    const llm = {
      resolveModelInfo: async (provider: string, model: string) => {
        expect(provider).toBe('provider')
        expect(model).toBe('org/model')
        return { context: { contextWindow: 128_000 } }
      },
    }
    expect(await resolveModelPromptTokenBudget(contextWith(llm), 'provider/org/model'))
      .toBe(128_000 - SHADOW_PROMPT_RESERVE_TOKENS)
  })

  it('prefers the adapter-disclosed output cap as the reserved response side', async () => {
    const llm = {
      resolveModelInfo: async () => ({ context: { contextWindow: 128_000 }, defaultMaxTokens: 16_384 }),
    }
    expect(await resolveModelPromptTokenBudget(contextWith(llm), 'provider/model')).toBe(128_000 - 16_384)
  })

  it('returns 0 for a window no larger than the reserve', async () => {
    const tiny = {
      resolveModelInfo: async () => ({ context: { contextWindow: 1_000 } }),
    }
    expect(await resolveModelPromptTokenBudget(contextWith(tiny), 'provider/model')).toBe(0)
    const exact = {
      resolveModelInfo: async () => ({ context: { contextWindow: 128_000 }, defaultMaxTokens: 128_000 }),
    }
    expect(await resolveModelPromptTokenBudget(contextWith(exact), 'provider/model')).toBe(0)
  })
})
