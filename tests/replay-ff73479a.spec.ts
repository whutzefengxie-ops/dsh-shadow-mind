/**
 * Headless replay of the ff73479a failure against the current runtime: a
 * Shadow child returns status "silent" with a long explanatory body. Pre-fix
 * this settled as INVALID_STRUCTURED_OUTPUT ("Shadow returned invalid
 * structured output"); the fix must settle it as silent, emit the discard
 * warning, and write a non-report-body-discarded debug record
 * (presence/length/hash, never the body).
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import { createUserMessage, createMessage, createToolResultMessage, CallId } from '@deepseek-ai/dsh-llm'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import SubagentRuntime from '@deepseek-ai/dsh-subagent'
import ShadowMindRuntime from '../src/runtime/index.ts'
import { MemorySettings } from './memory-settings.ts'

const dshHome = await mkdtemp(join(tmpdir(), 'dsh-shadow-replay-'))

afterAll(async () => {
  await rm(dshHome, { recursive: true, force: true })
})

describe('ff73479a replay: silent + long body', () => {
  it('settles as silent with discard warning and hash debug record, never INVALID_STRUCTURED_OUTPUT', async () => {
    const definitionRoot = join(dshHome, 'shadow-minds')
    await mkdir(definitionRoot, { recursive: true })
    await writeFile(join(definitionRoot, 'default.md'), `---
id: default
name: Reviewer
enabled: true
debug: true
activation_probability: 1
active_for_models:
  - '*'
tools: []
---

Review the completed tool-using turn.
`, 'utf8')

    const body = 'Completed root task reviewed. Prior acceptance rounds (seq 25504, 29541, 47299) accepted root answers 25497/29534/30127/47292 with source-level verification; independent re-check of the final closure answer 48700 claim matches both files exactly. No RELEASE.md scope exists in this session.'

    const ctx = new Context()
    const warn = vi.spyOn(ctx.logger, 'warn')
    await ctx.plugin(MemorySettings)
    await ctx.plugin(AgentRegistry)
    await ctx.plugin(SubagentRuntime)
    ctx.subagents.registerProvider({
      name: 'shadow-mind',
      capabilities: { outputSchema: true, depthLimit: true, toolFilter: true, persona: true },
      inheritsParentContext: false,
      start: () => Promise.resolve({
        id: SessionId('child-ff73479a'),
        localAgent: undefined,
        result: Promise.resolve({
          output: [],
          stopReason: 'completed',
          structured: { status: 'silent', content: body },
        }),
        dispose: () => Promise.resolve(),
      }),
    })
    await ctx.plugin(ShadowMindRuntime, {
      dshHome,
      resultBatchWindowMs: 0,
    })

    const session = Session.create(SessionId('root-session'))
    const deliveries: unknown[] = []
    const agent = {
      id: session.id,
      session,
      options: { provider: 'test', model: 'test-model' },
      status: 'idle',
      ctx,
      followup: (m: unknown) => { deliveries.push(m) },
      steer: (m: unknown) => { deliveries.push(m) },
    } as never
    ctx.agents.register(agent as never)

    session.append('turn/start', { turn: 1 })
    session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: 'Inspect the project.' }],
      source: { kind: 'user' },
    }), { surfaceOp: 'append' })
    session.append('step/start', { turn: 1, step: 1 })
    const callId = CallId('call-1')
    session.append('assistant/message', {
      turn: 1, step: 1,
      message: createMessage({
        role: 'assistant',
        content: [{ type: 'tool-call', id: callId, name: 'read', arguments: '{}' }],
        source: { kind: 'model', provider: 'test', model: 'test-model' },
      }),
    }, { surfaceOp: 'append' })
    session.append('tool/call', { turn: 1, step: 1, callId, name: 'read', arguments: '{}' })
    session.append('tool/result', {
      turn: 1, step: 1,
      message: createToolResultMessage({ callId, content: [{ type: 'text', text: 'file contents' }], isError: false }),
    }, { surfaceOp: 'append' })
    session.append('step/end', { turn: 1, step: 1 })
    const event = session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    ctx.emit('session/event', session, event)

    let run: { phase?: string; stage?: string; reasonCode?: string } | undefined
    await vi.waitFor(() => {
      run = (ctx.shadowMind.reviewCycles(agent as never)[0]?.runs[0]) as typeof run
      expect(['silent', 'not_relevant', 'failed', 'report']).toContain(run?.phase)
    })

    // The exact pre-fix failure must now settle as silent.
    expect(run?.phase).toBe('silent')
    expect(run?.stage).toBe('validate')
    expect(run?.reasonCode).not.toBe('INVALID_STRUCTURED_OUTPUT')
    expect(deliveries).toHaveLength(0)

    // Discard warning fires and names the shadow and status.
    expect(warn).toHaveBeenCalledWith(
      'dsh-shadow-mind: shadow %s returned %s with a non-empty content body; the body is not relayed and was discarded (run %s)',
      'default',
      'silent',
      expect.any(String),
    )

    // Debug record captures presence/length/hash, never the body text.
    const debugText = await readFile(join(dshHome, 'shadow-minds', 'logs', 'default.jsonl'), 'utf8')
    const records = debugText.trim().split('\n').map(line => JSON.parse(line) as Record<string, unknown>)
    const discarded = records.find(record => record['event'] === 'non-report-body-discarded')
    expect(discarded).toMatchObject({
      status: 'silent',
      discardedBodyChars: body.length,
    })
    expect(discarded?.['discardedBodyHash']).toBe(createHash('sha256').update(body).digest('hex'))
    expect(debugText).not.toContain('25497/29534')
  })
})
