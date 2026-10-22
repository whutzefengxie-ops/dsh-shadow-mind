import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { Context } from '@deepseek-ai/cordis'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { SessionId, pluginRecordOf } from '@deepseek-ai/dsh-session'
import SubagentRuntime from '@deepseek-ai/dsh-subagent'
import { ToolCallId, createUserMessage, type StreamChunk } from '@deepseek-ai/dsh-llm'
import { type ObjectJsonSchema } from '@deepseek-ai/dsh-tools'
import { installShadowMindProvider, startShadowMindRun } from '../src/runtime/subagent-provider.ts'
import { MockAdapter, textResponse, toolCallResponse } from './mock-adapter.ts'

const contexts: Context[] = []
afterEach(async () => { for (const ctx of contexts.splice(0).reverse()) await ctx.fiber.dispose() })
const fixture = JSON.parse(readFileSync(new URL('./fixtures/deepseek-dsml-leak.json', import.meta.url), 'utf8')) as { deltas: string[] }
const MESSAGE = 'DeepSeek Messages stream: tool input is invalid JSON'
const schema: ObjectJsonSchema = { type: 'object', properties: { status: { type: 'string' }, content: { type: 'string' }, verdict: { type: 'string' }, refs: { type: 'array', items: { type: 'integer' } } }, required: ['status', 'content', 'verdict', 'refs'] }
const report = () => toolCallResponse('result', 'structured_output', { status: 'report', content: 'Verified.', verdict: 'confirm', refs: [] })
function failure(args = fixture.deltas.join(''), code = 'MALFORMED_RESPONSE', message = MESSAGE): StreamChunk[] {
  const id = ToolCallId('malformed-call')
  return [
    { type: 'block-start', index: 0, blockType: 'reasoning' },
    { type: 'reasoning-delta', index: 0, text: 'Short review reasoning.' },
    { type: 'block-end', index: 0, block: { type: 'reasoning', text: 'Short review reasoning.' } },
    { type: 'block-start', index: 1, blockType: 'tool-call' },
    { type: 'tool-call-delta', index: 1, id, name: 'structured_output', argumentsDelta: args },
    { type: 'block-end', index: 1, block: { type: 'tool-call', id, name: 'structured_output', arguments: args } },
    { type: 'finish', reason: { kind: 'error', failure: { code, message } } },
  ]
}
async function setup(script: ConstructorParameters<typeof MockAdapter>[0]) {
  const ctx = new Context(); contexts.push(ctx)
  await mountAgentLoopTestDependencies(ctx, { workingDirectory: true })
  await ctx.plugin(AgentLoop, { agents: [] }); await ctx.plugin(SubagentRuntime)
  installShadowMindProvider(ctx)
  const adapter = new MockAdapter(script); ctx.llm.registerAdapter(['selected'], adapter)
  const parent = await ctx.agentLoop.create(SessionId('parent'), { provider: 'selected', model: 'review' })
  const start = (signal = new AbortController().signal, thinkFirst = false) => startShadowMindRun(ctx, { parent, prompt: [{ type: 'text', text: 'Review.' }], signal, maxDepth: 1, outputSchema: schema, thinkFirst })
  return { ctx, adapter, parent, start }
}
function retries(run: Awaited<ReturnType<typeof startShadowMindRun>>) {
  return run.localAgent!.session.snapshotEvents().map(pluginRecordOf).filter(r => r?.type === 'plugin:shadow-mind/request-retry')
}

describe('Shadow malformed tool JSON recovery', () => {
  it('does not apply the child recovery hook to the parent', async () => {
    const { adapter, parent } = await setup([failure(), report()])
    parent.followup(createUserMessage({ content: [{ type: 'text', text: 'Independent root.' }], source: { kind: 'user' } }))
    await parent.whenIdle()
    expect(adapter.requests).toHaveLength(1)
    expect(parent.session.snapshotEvents().map(pluginRecordOf).filter(Boolean)).toHaveLength(0)
  })

  it('does not retry a malformed response without a malformed tool block', async () => {
    const { adapter, start } = await setup([[failure().at(-1)!], report()])
    const run = await start()
    await expect(run.result).resolves.toMatchObject({ stopReason: 'error' })
    expect(adapter.requests).toHaveLength(1); expect(retries(run)).toHaveLength(0)
    await run.dispose()
  })

  it('retries the failed investigation request once, retaining the attempt without exposing it as model history', async () => {
    const { adapter, start } = await setup([textResponse('Plan.'), failure(), report()])
    const run = await start(undefined, true)
    await expect(run.result).resolves.toMatchObject({ stopReason: 'completed', structured: { content: 'Verified.' } })
    expect(adapter.requests).toHaveLength(3)
    expect(adapter.requests[0]!.tools ?? []).toEqual([])
    expect(adapter.requests[2]!.tools!.map(t => t.name)).toContain('structured_output')
    expect(adapter.requests[2]!.messages).toEqual(adapter.requests[1]!.messages)
    expect(JSON.stringify(adapter.requests[2]!.messages)).not.toContain('DSML')
    const events = run.localAgent!.session.snapshotEvents()
    expect(events.filter(e => e.type === 'assistant/attempt')).toHaveLength(1)
    expect(events.filter(e => e.type === 'tool/call')).toHaveLength(1)
    expect(events.filter(e => e.type === 'turn/end')).toHaveLength(1)
    expect(retries(run)).toEqual([expect.objectContaining({ data: expect.objectContaining({ retry: 1, code: 'MALFORMED_RESPONSE', step: 2 }) })])
    expect(JSON.stringify(retries(run))).not.toContain('DSML')
    await run.dispose()
  })

  it('ends with an actionable diagnostic after the one retry also fails', async () => {
    const { adapter, start } = await setup([failure(), failure(), report()])
    const run = await start()
    await expect(run.result).resolves.toMatchObject({ stopReason: 'error', diagnostic: expect.stringContaining('MALFORMED_RESPONSE') })
    expect(adapter.requests).toHaveLength(2)
    expect(retries(run)).toHaveLength(1)
    expect(run.localAgent!.session.snapshotEvents().filter(e => e.type === 'tool/call')).toHaveLength(0)
    await run.dispose()
  })

  it.each([
    ['{}', 'MALFORMED_RESPONSE', MESSAGE],
    ['{', 'AUTH', 'Invalid API key'],
    ['{', 'MALFORMED_RESPONSE', 'DeepSeek Messages SSE contains invalid JSON'],
  ])('does not broaden recovery for args=%s, code=%s, message=%s', async (args, code, message) => {
    const { adapter, start } = await setup([failure(args, code, message), report()])
    const run = await start()
    await expect(run.result).resolves.toMatchObject({ stopReason: 'error' })
    expect(adapter.requests).toHaveLength(1); expect(retries(run)).toHaveLength(0)
    await run.dispose()
  })

  it('keeps earlier successful tool effects and retries only the current step', async () => {
    const { ctx, adapter, start } = await setup([toolCallResponse('read-once', 'read_fixture', {}), failure(), report()])
    const execute = vi.fn(async () => 'fixture')
    ctx.tools.register({ name: 'read_fixture', description: 'Read fixture.', parameters: { type: 'object', properties: {} }, output: { schema: { type: 'string' }, render: value => [{ type: 'text', text: String(value) }] }, execute })
    const run = await start()
    await expect(run.result).resolves.toMatchObject({ stopReason: 'completed' })
    expect(execute).toHaveBeenCalledTimes(1); expect(adapter.requests).toHaveLength(3)
    expect(adapter.requests[2]!.messages).toEqual(adapter.requests[1]!.messages)
    await run.dispose()
  })

  it('shares the one-retry budget across later steps of the same review', async () => {
    const { ctx, adapter, start } = await setup([failure(), toolCallResponse('read-once', 'read_fixture', {}), failure(), report()])
    const execute = vi.fn(async () => 'fixture')
    ctx.tools.register({ name: 'read_fixture', description: 'Read fixture.', parameters: { type: 'object', properties: {} }, output: { schema: { type: 'string' }, render: value => [{ type: 'text', text: String(value) }] }, execute })
    const run = await start()
    await expect(run.result).resolves.toMatchObject({ stopReason: 'error' })
    expect(adapter.requests).toHaveLength(3); expect(retries(run)).toHaveLength(1)
    expect(execute).toHaveBeenCalledTimes(1)
    await run.dispose()
  })

  it('does not consume the upstream request recovery decision', async () => {
    const { ctx, adapter, start } = await setup([failure(), report()])
    let recovered = false
    ctx.on('agent/request-error', async (_input, next) => {
      if (recovered) return next()
      recovered = true
      return { kind: 'retry' }
    })
    const run = await start()
    await expect(run.result).resolves.toMatchObject({ stopReason: 'completed' })
    expect(adapter.requests).toHaveLength(2); expect(retries(run)).toHaveLength(0)
    await run.dispose()
  })

  it('does not retry a cancelled request', async () => {
    const abort = new AbortController()
    const { ctx, adapter, start } = await setup([failure(), report()])
    ctx.on('agent/request-error', async (_input, next) => { abort.abort(); return next() })
    const run = await start(abort.signal)
    await expect(run.result).resolves.toMatchObject({ stopReason: 'aborted' })
    expect(adapter.requests).toHaveLength(1); expect(retries(run)).toHaveLength(0)
    await run.dispose()
  })
})
