import { describe, expect, it } from 'vitest'
import { CallId, createMessage, createToolResultMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import { CompactionId } from '@deepseek-ai/dsh-compaction'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import {
  buildShadowPrompt,
  projectTrajectory,
  projectTrajectoryWithAnchors,
  summarizeToolResult,
} from '../src/runtime/index.ts'
import type { ShadowDefinition } from '../src/runtime/index.ts'

const SURFACE = { surfaceOp: 'append' as const }

function definition(): ShadowDefinition {
  return {
    id: 'audit', name: 'Audit', enabled: true, debug: false,
    activationProbability: 1, activeForModels: [], tools: [],
    capture: 'full', context: 'standard', thinkFirst: false,
    preFilters: [], boostFilters: [], boostFactor: 1,
    holdout: false,
    prompt: 'Find risks.', sourcePath: '/defs/audit.md',
  }
}

function trajectorySession(): Session {
  const session = Session.create(SessionId('root'))
  session.append('turn/start', { turn: 1 })
  session.append('step/start', { turn: 1, step: 1 })
  session.append('user/message', createUserMessage({
    content: [{ type: 'text', text: 'Review this.' }], source: { kind: 'user' },
  }), SURFACE)
  session.append('assistant/message', {
    turn: 1,
    step: 1,
    message: createMessage({
      role: 'assistant',
      content: [
        { type: 'reasoning', text: 'SECRET THINKING' },
        { type: 'text', text: 'I will inspect it.' },
      ],
      source: { kind: 'model', provider: 'mock', model: 'root' },
    }),
  }, SURFACE)
  const call = session.append('tool/call', {
    turn: 1, step: 1, callId: CallId('read-1'), name: 'read', arguments: '{"secret":"ARGUMENT"}',
  })
  session.append('tool/result', {
    turn: 1,
    step: 1,
    message: createToolResultMessage({
      callId: CallId('read-1'),
      content: [{ type: 'text', text: 'TOP SECRET\nsecond line' }],
      isError: false,
    }),
  }, { surfaceOp: 'append', sourceEventSeqs: [call.seq] })
  session.append('step/end', { turn: 1, step: 1 })
  session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  return session
}

describe('trajectory projection', () => {
  it('keeps visible text while removing reasoning, arguments, and raw tool output', () => {
    const session = trajectorySession()
    const projected = projectTrajectory(session.events, session.events.at(-1)!.seq, 'redacted')
    expect(projected).toContain('Review this.')
    expect(projected).toContain('I will inspect it.')
    expect(projected).toContain('arguments=[redacted]')
    expect(projected).toContain('read success: 2 non-empty lines, 22 text characters')
    expect(projected).not.toMatch(/SECRET THINKING|ARGUMENT|TOP SECRET/)
  })

  it('discloses raw arguments only under the explicit full policy and obeys the watermark', () => {
    const session = trajectorySession()
    const call = session.events.find(event => event.type === 'tool/call')!
    const projected = projectTrajectory(session.events, call.seq, 'full')
    expect(projected).toContain('{"secret":"ARGUMENT"}')
    expect(projected).not.toContain('tool result]')
  })

  it('includes durable compaction summaries without reasoning blocks', () => {
    const session = trajectorySession()
    session.append('compaction/summary', {
      compactionId: CompactionId('compact-1'),
      summary: [
        { type: 'text', text: 'COMPACTED DECISIONS' },
        { type: 'reasoning', text: 'COMPACTION SECRET' },
      ],
      shadowedRange: { start: 1, end: 2 },
      shadowedSeqs: [1, 2],
      shadowedTokenCount: 20,
      provider: 'mock',
      model: 'compact-model',
    })
    const projected = projectTrajectory(session.events, session.events.at(-1)!.seq, 'redacted')
    expect(projected).toMatch(/\[seq=\d+ compaction summary\]\nCOMPACTED DECISIONS/u)
    expect(projected).not.toContain('COMPACTION SECRET')
  })

  it('projects only the current successful compaction epoch while retaining summaries and exact anchors', () => {
    const session = trajectorySession()
    const compactionId = CompactionId('compact-epoch')
    session.append('compaction/start', { compactionId, turn: null })
    const summary = session.append('compaction/summary', {
      compactionId,
      summary: [{ type: 'text', text: 'EARLIER WORK SUMMARY' }],
      shadowedRange: { start: 1, end: 2 },
      shadowedSeqs: [1, 2],
      shadowedTokenCount: 20,
      provider: 'mock',
      model: 'compact-model',
    })
    session.append('compaction/end', { compactionId, turn: null })
    const current = session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: 'Current epoch task.' }], source: { kind: 'user' },
    }), SURFACE)
    const watermark = session.events.at(-1)!.seq
    const full = projectTrajectory(session.events, watermark, 'redacted', 'full')
    const projected = projectTrajectoryWithAnchors(session.events, watermark, 'redacted', 'since-compaction')

    expect(full).toContain('Review this.')
    expect(projected.text).not.toContain('Review this.')
    expect(projected.text).toContain('EARLIER WORK SUMMARY')
    expect(projected.text).toContain('Current epoch task.')
    expect([...projected.seqs]).toEqual([summary.seq, current.seq])
  })

  it('summarizes known and unknown tools without previews', () => {
    expect(summarizeToolResult('read', [{ type: 'text', text: '<path>/platform/path</path>' }], false, {
      lines: [{ number: 1, text: 'stable' }, { number: 2, text: '' }],
    })).toBe('read success: 1 non-empty lines, 6 text characters')
    expect(summarizeToolResult('read', [{ type: 'text', text: 'fallback' }], false, {
      lines: [{ number: 1 }],
    })).toBe('read success: 1 non-empty lines, 8 text characters')
    for (const meta of [null, [], { lines: 'invalid' }, { lines: [null] }, { lines: [[]] }]) {
      expect(summarizeToolResult('read', [{ type: 'text', text: 'fallback' }], false, meta))
        .toBe('read success: 1 non-empty lines, 8 text characters')
    }
    expect(summarizeToolResult('read', [{
      type: 'tool-result',
      toolCallId: CallId('nested-read'),
      content: [{ type: 'text', text: 'a\n\nb' }],
    }], false)).toBe('read success: 2 non-empty lines, 4 text characters')
    expect(summarizeToolResult('grep', [{ type: 'text', text: 'a\nb' }], true)).toBe('grep error: 2 result lines, 3 text characters')
    expect(summarizeToolResult('grep', [{ type: 'reasoning', text: 'hidden' }], false))
      .toBe('grep success: 0 result lines, 6 text characters')
    expect(summarizeToolResult('glob', [{ type: 'text', text: 'a\n\nb' }], false)).toBe('glob success: 2 paths, 4 text characters')
    expect(summarizeToolResult('custom', [
      { type: 'text', text: 'private' },
      { type: 'reasoning', text: 'hidden' },
      { type: 'tool-result', toolCallId: CallId('nested'), content: [{ type: 'text', text: 'nested' }] },
      { type: 'image', attachment: {} as never },
    ], false)).toBe('custom success: 19 text characters; blocks image=1, reasoning=1, text=2, tool-result=1')
    expect(summarizeToolResult('custom', [], false)).toBe('custom success: 0 text characters; blocks none')
  })

  it('projects image markers, skips empty visible blocks, and classifies unpaired failures', () => {
    const session = Session.create(SessionId('edge-root'))
    session.append('user/message', createUserMessage({
      content: [{ type: 'image', attachment: {} as never }],
      source: { kind: 'user' },
    }), SURFACE)
    session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: '   ' }],
      source: { kind: 'user' },
    }), SURFACE)
    session.append('assistant/message', {
      turn: 1,
      step: 1,
      message: createMessage({
        role: 'assistant',
        content: [{ type: 'reasoning', text: 'hidden only' }],
        source: { kind: 'model', provider: 'mock', model: 'root' },
      }),
    }, SURFACE)
    session.append('compaction/summary', {
      compactionId: CompactionId('empty-summary'),
      summary: [{ type: 'reasoning', text: 'hidden summary' }],
      shadowedRange: { start: 0, end: 0 },
      shadowedSeqs: [0],
      shadowedTokenCount: 1,
      provider: 'mock',
      model: 'compact-model',
    })
    session.append('tool/result', {
      turn: 1,
      step: 1,
      message: createToolResultMessage({
        callId: CallId('unknown'),
        content: [{ type: 'text', text: 'failure text' }],
        isError: true,
      }),
    }, SURFACE)
    const call = session.append('tool/call', {
      turn: 1, step: 2, callId: CallId('known'), name: 'glob', arguments: '{}',
    })
    session.append('tool/result', {
      turn: 1,
      step: 2,
      message: createToolResultMessage({
        callId: CallId('known'),
        content: [{ type: 'text', text: 'failure path' }],
        isError: false,
      }),
      error: { name: 'Error', code: 'UNKNOWN' },
    }, { surfaceOp: 'append', sourceEventSeqs: [call.seq] })

    const projected = projectTrajectory(session.events, session.events.at(-1)!.seq, 'redacted')
    expect(projected).toContain('[seq=0 user:user]\n[image omitted]')
    expect(projected).not.toContain('hidden only')
    expect(projected).toContain('unknown-tool error')
    expect(projected).toContain('glob error')
  })

  it('frames the full prompt and fails closed instead of truncating', () => {
    const prompt = buildShadowPrompt(definition(), 'trajectory', 7, 10_000)
    expect(prompt).toContain('Find risks.')
    expect(prompt).toContain('captured through session seq 7')
    expect(prompt).toContain('For "not_relevant" and "silent", content must be an empty string')
    expect(buildShadowPrompt(definition(), '', 0, 10_000)).toContain('[no model-visible trajectory content]')
    expect(() => buildShadowPrompt(definition(), 'trajectory', 7, 10)).toThrow('above maxPromptChars')
  })

  it('treats a non-positive bound as unlimited', () => {
    const huge = 'x'.repeat(200_000)
    const prompt = buildShadowPrompt(definition(), huge, 7, 0)
    expect(prompt).toContain(huge)
    expect(buildShadowPrompt(definition(), huge, 7, -1)).toContain(huge)
  })
})
