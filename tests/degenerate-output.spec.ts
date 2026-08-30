import { describe, expect, it } from 'vitest'
import {
  DegenerateOutputGuard,
  MAX_CHARS_WITHOUT_TOOL_CALL,
  MAX_REASONING_CHARS_BASE,
  hasRepeatedSuffix,
  resolveReasoningBudget,
} from '../src/runtime/degenerate-output.ts'

describe('hasRepeatedSuffix', () => {
  it('detects the shipped failure: the bare <tool_calls> marker repeated forever', () => {
    expect(hasRepeatedSuffix('<tool_calls>\n'.repeat(4))).toBe(true)
    // The 12-char marker block qualifies even with a partial final copy pending.
    expect(hasRepeatedSuffix('<tool_calls>\n'.repeat(6) + '<too')).toBe(true)
  })

  it('detects other short meaningful blocks at the minimum period', () => {
    expect(hasRepeatedSuffix('ab1 '.repeat(4))).toBe(true)
  })

  it('detects two-token alternation once the combined period is covered', () => {
    const withNewline = '<tool_calls>\n'
    const bare = '<tool_calls>'
    expect(hasRepeatedSuffix((withNewline + bare).repeat(4))).toBe(true)
  })

  it('ignores punctuation-only and single-character repetition', () => {
    expect(hasRepeatedSuffix('======'.repeat(4))).toBe(false)
    expect(hasRepeatedSuffix('aaaaa'.repeat(4))).toBe(false)
    expect(hasRepeatedSuffix('....'.repeat(4))).toBe(false)
  })

  it('ignores ordinary prose that merely shares a short prefix', () => {
    expect(hasRepeatedSuffix('The reviewer checks the trajectory for omissions and contradictions.')).toBe(false)
    expect(hasRepeatedSuffix('one two three four five six seven eight nine ten.')).toBe(false)
  })

  it('requires at least four full copies of the block', () => {
    expect(hasRepeatedSuffix('<tool_calls>\n'.repeat(3))).toBe(false)
    expect(hasRepeatedSuffix('<tool_calls>\n'.repeat(4))).toBe(true)
  })
})

describe('DegenerateOutputGuard', () => {
  it('fires repetition once and then ignores later chunks', () => {
    const guard = new DegenerateOutputGuard()
    guard.observeChunk('I will now investigate the trajectory.\n', 'text')
    expect(guard.observeChunk('<tool_calls>\n'.repeat(3), 'text')).toBeUndefined()
    expect(guard.observeChunk('<tool_calls>\n', 'text')).toEqual({ reason: 'repetition' })
    expect(guard.observeChunk('<tool_calls>\n', 'text')).toBeUndefined()
  })

  it('cuts reasoning loops through the repetition rule, not the budget', () => {
    const guard = new DegenerateOutputGuard()
    expect(guard.observeChunk('<tool_calls>\n'.repeat(3), 'reasoning')).toBeUndefined()
    expect(guard.observeChunk('<tool_calls>\n', 'reasoning')).toEqual({ reason: 'repetition' })
  })

  it('keeps the repetition window bounded to the stream tail', () => {
    const guard = new DegenerateOutputGuard()
    // A long non-repetitive preamble: printable ASCII cycling with period 61,
    // which no block of at most 32 characters can repeat inside the 128-char tail.
    const preamble = Array.from({ length: 200 }, (_, index) => String.fromCharCode(33 + (index % 61))).join('')
    guard.observeChunk(preamble, 'text')
    guard.observeChunk('ab1 '.repeat(3), 'text')
    expect(guard.observeChunk('ab1 ', 'text')).toEqual({ reason: 'repetition' })
  })

  it('fires output-budget when too much visible text streams without progress', () => {
    const guard = new DegenerateOutputGuard()
    const half = 'x'.repeat(Math.floor(MAX_CHARS_WITHOUT_TOOL_CALL / 2))
    guard.observeChunk(half, 'text')
    expect(guard.observeChunk(half, 'text')).toBeUndefined()
    expect(guard.observeChunk('y', 'text')).toEqual({ reason: 'output-budget' })
  })

  it('scales the reasoning budget by the child reasoning effort', () => {
    expect(resolveReasoningBudget('low')).toBe(MAX_REASONING_CHARS_BASE)
    expect(resolveReasoningBudget('medium')).toBe(MAX_REASONING_CHARS_BASE)
    expect(resolveReasoningBudget('high')).toBe(MAX_REASONING_CHARS_BASE * 2)
    expect(resolveReasoningBudget('max')).toBe(MAX_REASONING_CHARS_BASE * 4)
    // Unknown or unrecognized efforts assume the heaviest tier so a healthy
    // inherited max-effort run can never be misclassified.
    expect(resolveReasoningBudget(undefined)).toBe(MAX_REASONING_CHARS_BASE * 4)
    expect(resolveReasoningBudget('ultra')).toBe(MAX_REASONING_CHARS_BASE * 4)
  })

  it('fires the reasoning budget at the configured size, separate from text', () => {
    const guard = new DegenerateOutputGuard(resolveReasoningBudget('max'))
    const step = 'r'.repeat(Math.floor(MAX_REASONING_CHARS_BASE / 2))
    // 8 halves of 96k reach the 4x reasoning budget exactly without firing;
    // one more character crosses it.
    for (let index = 0; index < 8; index++) {
      expect(guard.observeChunk(step, 'reasoning')).toBeUndefined()
    }
    expect(guard.observeChunk('r', 'reasoning')).toEqual({ reason: 'output-budget' })
  })

  it('keeps text and reasoning budgets independent', () => {
    const guard = new DegenerateOutputGuard(resolveReasoningBudget('max'))
    const textHalf = 'x'.repeat(Math.floor(MAX_CHARS_WITHOUT_TOOL_CALL / 2))
    const reasoningHalf = 'r'.repeat(Math.floor(MAX_REASONING_CHARS_BASE / 2))
    guard.observeChunk(textHalf, 'text')
    guard.observeChunk(textHalf, 'text')
    guard.observeChunk(reasoningHalf, 'reasoning')
    // Text sits exactly at its 96k budget while reasoning is far below its
    // scaled one: the next text character fires alone.
    expect(guard.observeChunk('y', 'text')).toEqual({ reason: 'output-budget' })
  })

  it('restarts the output budget on each tool call', () => {
    const guard = new DegenerateOutputGuard()
    const chunk = 'x'.repeat(Math.floor(MAX_CHARS_WITHOUT_TOOL_CALL / 2))
    guard.observeChunk(chunk, 'text')
    guard.observeToolCall()
    guard.observeChunk(chunk, 'text')
    guard.observeToolCall()
    expect(guard.observeChunk(chunk, 'text')).toBeUndefined()
  })

  it('restarts the output budget on each step or turn boundary', () => {
    const guard = new DegenerateOutputGuard()
    const chunk = 'x'.repeat(Math.floor(MAX_CHARS_WITHOUT_TOOL_CALL / 2))
    guard.observeChunk(chunk, 'text')
    guard.observeBoundary()
    guard.observeChunk(chunk, 'text')
    guard.observeBoundary()
    expect(guard.observeChunk(chunk, 'text')).toBeUndefined()
  })

  it('restarts the reasoning budget on boundaries too', () => {
    const guard = new DegenerateOutputGuard()
    const step = 'r'.repeat(Math.floor(MAX_REASONING_CHARS_BASE / 2))
    guard.observeChunk(step, 'reasoning')
    guard.observeBoundary()
    guard.observeChunk(step, 'reasoning')
    guard.observeBoundary()
    guard.observeChunk(step, 'reasoning')
    expect(guard.observeChunk(step, 'reasoning')).toBeUndefined()
    expect(guard.observeChunk('r', 'reasoning')).toEqual({ reason: 'output-budget' })
  })

  it('does not fire the budget for empty chunks', () => {
    const guard = new DegenerateOutputGuard()
    expect(guard.observeChunk('', 'text')).toBeUndefined()
    expect(guard.observeChunk('', 'reasoning')).toBeUndefined()
  })
})
