import { describe, expect, it } from 'vitest'
import {
  DegenerateOutputGuard,
  MAX_CHARS_WITHOUT_TOOL_CALL,
  hasRepeatedSuffix,
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
    guard.observeChunk('I will now investigate the trajectory.\n')
    expect(guard.observeChunk('<tool_calls>\n'.repeat(3))).toBeUndefined()
    expect(guard.observeChunk('<tool_calls>\n')).toEqual({ reason: 'repetition' })
    expect(guard.observeChunk('<tool_calls>\n')).toBeUndefined()
  })

  it('keeps the repetition window bounded to the stream tail', () => {
    const guard = new DegenerateOutputGuard()
    // A long non-repetitive preamble: printable ASCII cycling with period 61,
    // which no block of at most 24 characters can repeat inside the 96-char tail.
    const preamble = Array.from({ length: 200 }, (_, index) => String.fromCharCode(33 + (index % 61))).join('')
    guard.observeChunk(preamble)
    guard.observeChunk('ab1 '.repeat(3))
    expect(guard.observeChunk('ab1 ')).toEqual({ reason: 'repetition' })
  })

  it('fires output-budget when too many characters stream without a tool call', () => {
    const guard = new DegenerateOutputGuard()
    const half = 'x'.repeat(Math.floor(MAX_CHARS_WITHOUT_TOOL_CALL / 2))
    guard.observeChunk(half)
    expect(guard.observeChunk(half)).toBeUndefined()
    expect(guard.observeChunk('y')).toEqual({ reason: 'output-budget' })
  })

  it('restarts the output budget on each tool call', () => {
    const guard = new DegenerateOutputGuard()
    const chunk = 'x'.repeat(Math.floor(MAX_CHARS_WITHOUT_TOOL_CALL / 2))
    guard.observeChunk(chunk)
    guard.observeToolCall()
    guard.observeChunk(chunk)
    guard.observeToolCall()
    expect(guard.observeChunk(chunk)).toBeUndefined()
  })

  it('does not fire the budget for empty chunks', () => {
    const guard = new DegenerateOutputGuard()
    expect(guard.observeChunk('')).toBeUndefined()
  })
})
