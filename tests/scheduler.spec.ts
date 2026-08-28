import { describe, expect, it } from 'vitest'
import { seededRandom, shouldRunShadow } from '../src/runtime/index.ts'

describe('shouldRunShadow', () => {
  it('admits the single scheduling roll strictly below the probability', () => {
    expect(shouldRunShadow(0.7, () => 0.699)).toBe(true)
    expect(shouldRunShadow(0.7, () => 0.7)).toBe(false)
    expect(shouldRunShadow(0.7, () => 0.9)).toBe(false)
  })

  it('never admits with probability zero and always admits with probability one', () => {
    expect(shouldRunShadow(0, () => 0)).toBe(false)
    expect(shouldRunShadow(1, () => 0.999)).toBe(true)
  })

  it('provides repeatable seeded draws', () => {
    const left = seededRandom(42)
    const right = seededRandom(42)
    expect([left(), left(), left()]).toEqual([right(), right(), right()])
  })
})
