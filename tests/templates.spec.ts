import { describe, expect, it } from 'vitest'
import { definitionInput, templateDraft } from '../src/client/ShadowMindSettingsTab.tsx'
import { en, zh } from '../src/client/locales.ts'
import { SHADOW_TEMPLATES } from '../src/client/templates.ts'

describe('Shadow Mind reference templates', () => {
  it('ships unique, well-formed, adoptable templates', () => {
    expect(SHADOW_TEMPLATES.length).toBeGreaterThanOrEqual(6)
    const ids = SHADOW_TEMPLATES.map(template => template.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const template of SHADOW_TEMPLATES) {
      expect(template.id).toMatch(/^[a-z0-9][a-z0-9_-]*$/u)
      expect(template.prompt.trim()).not.toBe('')
      expect(template.activationProbability).toBeGreaterThanOrEqual(0)
      expect(template.activationProbability).toBeLessThanOrEqual(1)
      expect(template.capture === 'full' || template.capture === 'since-compaction').toBe(true)
    }
  })

  it('keeps every template name and description present in both dictionaries', () => {
    for (const template of SHADOW_TEMPLATES) {
      expect(zh[template.nameKey]).toBeTruthy()
      expect(zh[template.descriptionKey]).toBeTruthy()
      expect(en[template.nameKey]).toBeTruthy()
      expect(en[template.descriptionKey]).toBeTruthy()
    }
  })

  it('prefills a valid create draft that keeps holdout off', () => {
    for (const template of SHADOW_TEMPLATES) {
      const draft = templateDraft(template, zh[template.nameKey])
      const input = definitionInput(draft)
      expect(input).toBeDefined()
      expect(input?.id).toBe(template.id)
      expect(input?.name).toBe(zh[template.nameKey])
      expect(input?.prompt).toBe(template.prompt.trim())
      expect(input?.capture).toBe(template.capture)
      expect(input?.activationProbability).toBe(template.activationProbability)
      expect(input?.holdout).toBe(false)
    }
  })

  it('keeps template prompts probe-checklist aligned with the shipped probe library', () => {
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
