import { describe, expect, it } from 'vitest'
import {
  preferIndependentCandidates,
  resolveIndependence,
  vendorFamily,
} from '../src/runtime/index.ts'

describe('Shadow reviewer vendor policy', () => {
  it('uses provider ownership before model markers and keeps unknown routes honest', () => {
    expect(vendorFamily('openai/gpt-5')).toBe('openai')
    expect(vendorFamily('openai')).toBe('openai')
    expect(vendorFamily('private-model')).toBe('unknown')
    expect(vendorFamily('bedrock/anthropic.claude-4')).toBe('amazon')
    expect(vendorFamily('custom/deepseek-v3')).toBe('deepseek')
    expect(vendorFamily('openai-compatible/private-model')).toBe('unknown')
  })

  it('distinguishes independent, same-vendor, unknown, and incomplete routes', () => {
    expect(resolveIndependence('openai/gpt-5', 'anthropic/claude-4')).toBe('independent')
    expect(resolveIndependence('openai/gpt-5', 'codex/gpt-5')).toBe('same_vendor')
    expect(resolveIndependence('custom/root', 'anthropic/claude-4')).toBe('unverified')
    expect(resolveIndependence(undefined, 'anthropic/claude-4')).toBe('unavailable')
  })

  it('never filters a viable jury below two candidates', () => {
    const routes = new Map([
      ['same', 'codex/gpt-5'],
      ['independent-a', 'anthropic/claude-4'],
      ['independent-b', 'google/gemini-2.5'],
    ])
    const routeFor = (candidate: string): string | undefined => routes.get(candidate)
    expect(preferIndependentCandidates(
      ['same', 'independent-a', 'independent-b'],
      'openai/gpt-5',
      routeFor,
    )).toEqual(['independent-a', 'independent-b'])
    expect(preferIndependentCandidates(
      ['same', 'independent-a'],
      'openai/gpt-5',
      routeFor,
    )).toEqual(['same', 'independent-a'])
  })
})
