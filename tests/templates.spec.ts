import { describe, expect, it } from 'vitest'
import { definitionDraft, definitionInput } from '../src/client/ShadowMindSettingsTab.tsx'
import { en, zh } from '../src/client/locales.ts'
import { SHADOW_TEMPLATES } from '../src/client/templates.ts'

describe('Shadow Mind review-style presets', () => {
  it('ships unique, well-formed presets', () => {
    expect(SHADOW_TEMPLATES.length).toBeGreaterThanOrEqual(6)
    const ids = SHADOW_TEMPLATES.map(template => template.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const template of SHADOW_TEMPLATES) {
      expect(template.id).toMatch(/^[a-z0-9][a-z0-9_-]*$/u)
      expect(template.prompt.trim()).not.toBe('')
      expect(template.capture === 'full' || template.capture === 'since-compaction').toBe(true)
    }
  })

  it('keeps every preset name and description present in both dictionaries', () => {
    for (const template of SHADOW_TEMPLATES) {
      expect(zh[template.nameKey]).toBeTruthy()
      expect(zh[template.descriptionKey]).toBeTruthy()
      expect(en[template.nameKey]).toBeTruthy()
      expect(en[template.descriptionKey]).toBeTruthy()
    }
  })

  it('fills a valid default-definition draft that keeps holdout off and the preset probability untouched', () => {
    for (const template of SHADOW_TEMPLATES) {
      const draft = definitionDraft({
        id: 'default',
        name: 'Shadow',
        enabled: true,
        debug: false,
        activationProbability: 0.7,
        activeForModels: [],
        tools: [],
        capture: 'full',
        context: 'standard',
        thinkFirst: false,
        holdout: false,
        prompt: 'Placeholder.',
        sourcePath: '/defs/default.md',
      })
      const filled = { ...draft, prompt: template.prompt, capture: template.capture }
      const input = definitionInput(filled)
      expect(input).toBeDefined()
      expect(input?.id).toBe('default')
      expect(input?.prompt).toBe(template.prompt.trim())
      expect(input?.capture).toBe(template.capture)
      expect(input?.activationProbability).toBe(0.7)
      expect(input?.holdout).toBe(false)
    }
  })

  it('keeps preset prompts probe-checklist aligned with the shipped probe library', () => {
    for (const template of SHADOW_TEMPLATES.filter(candidate => candidate.id !== 'implementation-reviewer')) {
      expect(template.prompt).toContain('## Probe checklist')
      expect(template.prompt).toContain('evidence gap')
      expect(template.prompt).toContain('anchored verdict')
    }
    const implementationReviewer = SHADOW_TEMPLATES.find(template => template.id === 'implementation-reviewer')
    expect(implementationReviewer?.prompt).toContain('Priority checks')
    expect(implementationReviewer?.prompt).toContain('`refs` must only contain rendered sequence numbers')
  })
})
