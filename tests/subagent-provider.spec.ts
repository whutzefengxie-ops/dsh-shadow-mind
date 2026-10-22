import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { SessionId } from '@deepseek-ai/dsh-session'
import SubagentRuntime from '@deepseek-ai/dsh-subagent'
import { defineTool, type ObjectJsonSchema } from '@deepseek-ai/dsh-tools'
import {
  installShadowMindProvider,
  startShadowMindRun,
  STRUCTURED_OUTPUT_MISSING_DIAGNOSTIC,
} from '../src/runtime/subagent-provider.ts'
import { MockAdapter, textResponse, toolCallResponse } from './mock-adapter.ts'

const contexts: Context[] = []

afterEach(async () => {
  for (const ctx of contexts.splice(0).reverse()) await ctx.fiber.dispose()
})

const OUTPUT_SCHEMA: ObjectJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['report'] },
    content: { type: 'string' },
    verdict: { type: 'string', enum: ['challenge'] },
    refs: { type: 'array', items: { type: 'integer' } },
  },
  required: ['status', 'content', 'verdict', 'refs'],
}

describe('Shadow Mind conditioned subagent provider', () => {
  it('restores immediate tools after planning on addition-only model routes', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await mountAgentLoopTestDependencies(ctx, { workingDirectory: true })
    await ctx.plugin(AgentLoop, { agents: [] })
    await ctx.plugin(SubagentRuntime)
    installShadowMindProvider(ctx)
    class AdditionOnlyAdapter extends MockAdapter {
      override async resolveModel(provider: string, model: string) {
        return { ...await super.resolveModel(provider, model), toolUpdate: 'addition-only' as const }
      }
    }
    const adapter = new AdditionOnlyAdapter([
      textResponse('Plan the review.'),
      options => {
        expect(options.tools?.length).toBeGreaterThan(0)
        expect(options.tools?.every(tool => tool.deferLoading === true)).toBe(false)
        expect(options.tools?.find(tool => tool.name === 'structured_output')?.deferLoading).toBeUndefined()
        return toolCallResponse('structured', 'structured_output', {
          status: 'report', content: 'Verified.', verdict: 'challenge', refs: [],
        })
      },
    ])
    ctx.llm.registerAdapter(['selected'], adapter)
    const parent = await ctx.agentLoop.create(SessionId('parent'), { provider: 'selected', model: 'root' })
    const run = await startShadowMindRun(ctx, {
      parent, prompt: [{ type: 'text', text: 'Review.' }], signal: new AbortController().signal,
      maxDepth: 1, outputSchema: OUTPUT_SCHEMA, thinkFirst: true,
    })
    await expect(run.result).resolves.toMatchObject({ stopReason: 'completed', structured: { content: 'Verified.' } })
    expect(adapter.requests[0]?.tools ?? []).toEqual([])
    expect(run.localAgent?.session.snapshotEvents().filter(event => event.type === 'request/header')
      .some(event => event.data.startsSeries === true)).toBe(true)
    await run.dispose()
  })

  it('keeps think-first continuation, minimal context, routing, result, and disposal on one child', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await mountAgentLoopTestDependencies(ctx, { workingDirectory: true })
    await ctx.plugin(AgentLoop, { agents: [] })
    await ctx.plugin(SubagentRuntime)
    installShadowMindProvider(ctx)

    const adapter = new MockAdapter([
      textResponse('1. Inspect the rendered sequence anchors.'),
      toolCallResponse('structured', 'structured_output', {
        status: 'report',
        content: 'The anchored claim needs correction.',
        verdict: 'challenge',
        refs: [],
      }),
    ])
    ctx.llm.registerAdapter(['selected'], adapter)
    const parent = await ctx.agentLoop.create(SessionId('parent'), { provider: 'selected', model: 'root-model' })

    const run = await startShadowMindRun(ctx, {
      label: 'shadow:reviewer',
      parent,
      prompt: [{ type: 'text', text: 'Plan first, then review the numbered trajectory.' }],
      signal: new AbortController().signal,
      maxDepth: 1,
      outputSchema: OUTPUT_SCHEMA,
      contextInheritance: 'none',
      thinkFirst: true,
      modelSelection: { provider: 'selected', model: 'review-model' },
    })

    expect(run.localAgent?.id).toBe(run.id)
    await expect(run.result).resolves.toMatchObject({
      stopReason: 'completed',
      structured: {
        status: 'report',
        content: 'The anchored claim needs correction.',
        verdict: 'challenge',
        refs: [],
      },
    })
    expect(adapter.requests).toHaveLength(2)
    expect(adapter.requests.map(request => request.model)).toEqual(['review-model', 'review-model'])
    expect(adapter.requests[0]?.tools ?? []).toEqual([])
    expect(adapter.requests[1]?.tools?.map(tool => tool.name)).toContain('structured_output')
    expect(JSON.stringify(adapter.requests[0]?.messages)).not.toMatch(/delegated subagent/iu)
    expect(run.localAgent?.session.snapshotEvents().filter(event => event.type === 'assistant/message')).toHaveLength(2)

    await run.dispose()
    expect(ctx.agents.get(run.id)).toBeUndefined()
  })

  it('resolves no-structured-output when the child completes without calling the structured tool', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await mountAgentLoopTestDependencies(ctx, { workingDirectory: true })
    await ctx.plugin(AgentLoop, { agents: [] })
    await ctx.plugin(SubagentRuntime)
    installShadowMindProvider(ctx)

    const adapter = new MockAdapter([
      textResponse('1. Inspect the rendered sequence anchors.'),
      // The child finishes with a plain-text answer and never calls structured_output
      // — the exact failure that previously surfaced as "Subagent stopped with error".
      textResponse('Investigation complete; the finding is recorded here as prose.'),
    ])
    ctx.llm.registerAdapter(['selected'], adapter)
    const parent = await ctx.agentLoop.create(SessionId('parent'), { provider: 'selected', model: 'root-model' })

    const run = await startShadowMindRun(ctx, {
      label: 'shadow:reviewer',
      parent,
      prompt: [{ type: 'text', text: 'Plan first, then review the numbered trajectory.' }],
      signal: new AbortController().signal,
      maxDepth: 1,
      outputSchema: OUTPUT_SCHEMA,
      contextInheritance: 'none',
      thinkFirst: true,
      modelSelection: { provider: 'selected', model: 'review-model' },
    })

    const result = await run.result
    expect(result).toMatchObject({
      stopReason: 'no-structured-output',
      diagnostic: STRUCTURED_OUTPUT_MISSING_DIAGNOSTIC,
    })
    expect(result.structured).toBeUndefined()

    await run.dispose()
    expect(ctx.agents.get(run.id)).toBeUndefined()
  })

  it('still resolves aborted when a completed child is cancelled without a structured capture', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await mountAgentLoopTestDependencies(ctx, { workingDirectory: true })
    await ctx.plugin(AgentLoop, { agents: [] })
    await ctx.plugin(SubagentRuntime)
    installShadowMindProvider(ctx)

    const adapter = new MockAdapter([
      textResponse('1. Inspect the rendered sequence anchors.'),
      'hang',
    ])
    ctx.llm.registerAdapter(['selected'], adapter)
    const parent = await ctx.agentLoop.create(SessionId('parent'), { provider: 'selected', model: 'root-model' })

    const controller = new AbortController()
    const run = await startShadowMindRun(ctx, {
      label: 'shadow:reviewer',
      parent,
      prompt: [{ type: 'text', text: 'Plan first, then review the numbered trajectory.' }],
      signal: controller.signal,
      maxDepth: 1,
      outputSchema: OUTPUT_SCHEMA,
      contextInheritance: 'none',
      thinkFirst: true,
      modelSelection: { provider: 'selected', model: 'review-model' },
    })

    // Let the child reach the in-flight hang, then cancel it mid-turn.
    await new Promise(resolve => setTimeout(resolve, 50))
    controller.abort()
    await expect(run.result).resolves.toMatchObject({ stopReason: 'aborted' })

    await run.dispose()
    expect(ctx.agents.get(run.id)).toBeUndefined()
  })

  it('cancels a child stuck in a degenerate repetition loop as degenerate-output', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await mountAgentLoopTestDependencies(ctx, { workingDirectory: true })
    await ctx.plugin(AgentLoop, { agents: [] })
    await ctx.plugin(SubagentRuntime)
    installShadowMindProvider(ctx)

    const adapter = new MockAdapter([
      textResponse('1. Inspect the rendered sequence anchors.'),
      // The shipped failure: the child starts its tool-free planning step and
      // then collapses into streaming the bare <tool_calls> marker forever.
      {
        floodAfter: [{ type: 'block-start', index: 0, blockType: 'text' }],
        floodToken: '<tool_calls>\n',
      },
    ])
    ctx.llm.registerAdapter(['selected'], adapter)
    const parent = await ctx.agentLoop.create(SessionId('parent'), { provider: 'selected', model: 'root-model' })

    const run = await startShadowMindRun(ctx, {
      label: 'shadow:reviewer',
      parent,
      prompt: [{ type: 'text', text: 'Plan first, then review the numbered trajectory.' }],
      signal: new AbortController().signal,
      maxDepth: 1,
      outputSchema: OUTPUT_SCHEMA,
      contextInheritance: 'none',
      thinkFirst: true,
      modelSelection: { provider: 'selected', model: 'review-model' },
    })

    // The watchdog must cut the flood short within milliseconds instead of
    // letting the run occupy its slot until a wall-clock timeout.
    const result = await run.result
    expect(result).toMatchObject({
      stopReason: 'degenerate-output',
      diagnostic: expect.stringContaining('degenerate output loop'),
    })
    expect(result.structured).toBeUndefined()
    expect(adapter.requests).toHaveLength(2)

    await run.dispose()
    expect(ctx.agents.get(run.id)).toBeUndefined()
  })

  it('still resolves error when the child fails mid-turn rather than no-structured-output', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await mountAgentLoopTestDependencies(ctx, { workingDirectory: true })
    await ctx.plugin(AgentLoop, { agents: [] })
    await ctx.plugin(SubagentRuntime)
    installShadowMindProvider(ctx)

    const adapter = new MockAdapter([
      textResponse('1. Inspect the rendered sequence anchors.'),
      () => { throw new Error('provider transport failed') },
    ])
    ctx.llm.registerAdapter(['selected'], adapter)
    const parent = await ctx.agentLoop.create(SessionId('parent'), { provider: 'selected', model: 'root-model' })

    const run = await startShadowMindRun(ctx, {
      label: 'shadow:reviewer',
      parent,
      prompt: [{ type: 'text', text: 'Plan first, then review the numbered trajectory.' }],
      signal: new AbortController().signal,
      maxDepth: 1,
      outputSchema: OUTPUT_SCHEMA,
      contextInheritance: 'none',
      thinkFirst: true,
      modelSelection: { provider: 'selected', model: 'review-model' },
    })

    const result = await run.result
    expect(result).toMatchObject({ stopReason: 'error' })
    expect(result.structured).toBeUndefined()

    await run.dispose()
    expect(ctx.agents.get(run.id)).toBeUndefined()
  })

  it('rejects a non-ascending refs payload in-turn and captures the corrected retry', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await mountAgentLoopTestDependencies(ctx, { workingDirectory: true })
    await ctx.plugin(AgentLoop, { agents: [] })
    await ctx.plugin(SubagentRuntime)
    installShadowMindProvider(ctx)

    const adapter = new MockAdapter([
      textResponse('1. Inspect the rendered sequence anchors.'),
      // The exact shipped failure: refs out of ascending order passes the JSON
      // Schema subset but violates the cross-field contract.
      toolCallResponse('bad', 'structured_output', {
        status: 'report',
        content: 'The anchored claim needs correction.',
        verdict: 'challenge',
        refs: [15675, 15],
      }),
      toolCallResponse('good', 'structured_output', {
        status: 'report',
        content: 'The anchored claim needs correction.',
        verdict: 'challenge',
        refs: [15, 15675],
      }),
    ])
    ctx.llm.registerAdapter(['selected'], adapter)
    const parent = await ctx.agentLoop.create(SessionId('parent'), { provider: 'selected', model: 'root-model' })

    const run = await startShadowMindRun(ctx, {
      label: 'shadow:reviewer',
      parent,
      prompt: [{ type: 'text', text: 'Plan first, then review the numbered trajectory.' }],
      signal: new AbortController().signal,
      maxDepth: 1,
      outputSchema: OUTPUT_SCHEMA,
      structuredAnchorSeqs: new Set([15, 15675]),
      contextInheritance: 'none',
      thinkFirst: true,
      modelSelection: { provider: 'selected', model: 'review-model' },
    })

    const result = await run.result
    expect(result).toMatchObject({
      stopReason: 'completed',
      structured: {
        status: 'report',
        content: 'The anchored claim needs correction.',
        verdict: 'challenge',
        refs: [15, 15675],
      },
    })
    // Plan request, failed call, corrected retry: the same turn kept going.
    expect(adapter.requests).toHaveLength(3)
    const badResult = run.localAgent?.session.snapshotEvents().find(event =>
      event.type === 'tool/result' && event.data.error !== undefined)
    expect(badResult).toBeDefined()
    expect(JSON.stringify(badResult)).toContain('strictly ascending')

    await run.dispose()
    expect(ctx.agents.get(run.id)).toBeUndefined()
  })

  it('rejects an anchor outside the rendered window in-turn without a structuredAnchorSeqs match', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await mountAgentLoopTestDependencies(ctx, { workingDirectory: true })
    await ctx.plugin(AgentLoop, { agents: [] })
    await ctx.plugin(SubagentRuntime)
    installShadowMindProvider(ctx)

    const adapter = new MockAdapter([
      textResponse('1. Inspect the rendered sequence anchors.'),
      toolCallResponse('bad-window', 'structured_output', {
        status: 'report',
        content: 'The anchored claim needs correction.',
        verdict: 'challenge',
        refs: [999999],
      }),
      textResponse('The window check rejected the anchor; finishing without a valid capture.'),
    ])
    ctx.llm.registerAdapter(['selected'], adapter)
    const parent = await ctx.agentLoop.create(SessionId('parent'), { provider: 'selected', model: 'root-model' })

    const run = await startShadowMindRun(ctx, {
      label: 'shadow:reviewer',
      parent,
      prompt: [{ type: 'text', text: 'Plan first, then review the numbered trajectory.' }],
      signal: new AbortController().signal,
      maxDepth: 1,
      outputSchema: OUTPUT_SCHEMA,
      structuredAnchorSeqs: new Set([15, 15675]),
      contextInheritance: 'none',
      thinkFirst: true,
      modelSelection: { provider: 'selected', model: 'review-model' },
    })

    const result = await run.result
    expect(result).toMatchObject({
      stopReason: 'no-structured-output',
      diagnostic: STRUCTURED_OUTPUT_MISSING_DIAGNOSTIC,
    })
    expect(result.structured).toBeUndefined()

    await run.dispose()
    expect(ctx.agents.get(run.id)).toBeUndefined()
  })

  it('cancels the exact managed activation when its caller aborts after publication', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await mountAgentLoopTestDependencies(ctx, { workingDirectory: true })
    await ctx.plugin(AgentLoop, { agents: [] })
    await ctx.plugin(SubagentRuntime)
    installShadowMindProvider(ctx)
    const adapter = new MockAdapter(['hang-slow'])
    ctx.llm.registerAdapter(['selected'], adapter)
    const parent = await ctx.agentLoop.create(SessionId('parent'), { provider: 'selected', model: 'root-model' })
    const controller = new AbortController()
    const run = await startShadowMindRun(ctx, {
      parent, prompt: [{ type: 'text', text: 'Review.' }], signal: controller.signal, maxDepth: 1,
    })
    await vi.waitFor(() => { expect(adapter.requests).toHaveLength(1) })
    controller.abort()
    await expect(run.result).resolves.toMatchObject({ stopReason: 'aborted' })
    await Promise.all([run.dispose(), run.dispose()])
    expect(ctx.agents.get(run.id)).toBeUndefined()
    expect(ctx.agents.get(parent.id)).toBe(parent)
  })

  it('isolates concurrent review routes and delivers results only to the caller', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await mountAgentLoopTestDependencies(ctx, { workingDirectory: true })
    await ctx.plugin(AgentLoop, { agents: [] })
    await ctx.plugin(SubagentRuntime)
    installShadowMindProvider(ctx)
    const response = (request: import('@deepseek-ai/dsh-llm').GenerateOptions) => toolCallResponse(
      request.model, 'structured_output', {
        status: 'report', content: request.model, verdict: 'challenge', refs: [],
      },
    )
    const adapter = new MockAdapter([response, response])
    ctx.llm.registerAdapter(['selected'], adapter)
    const parent = await ctx.agentLoop.create(SessionId('parent'), { provider: 'selected', model: 'root-model' }, { cwd: process.cwd() })
    const before = parent.session.snapshotEvents()
    const runs = await Promise.all(['review-a', 'review-b'].map(model => startShadowMindRun(ctx, {
      parent, prompt: [{ type: 'text', text: 'Review.' }], signal: new AbortController().signal,
      maxDepth: 1, outputSchema: OUTPUT_SCHEMA, toolFilter: { allow: [] },
      modelSelection: { provider: 'selected', model }, contextInheritance: 'none',
    })))
    const results = await Promise.all(runs.map(run => run.result))
    expect(results.map(result => result.structured)).toEqual([
      { status: 'report', content: 'review-a', verdict: 'challenge', refs: [] },
      { status: 'report', content: 'review-b', verdict: 'challenge', refs: [] },
    ])
    expect(runs[0]?.id).not.toBe(runs[1]?.id)
    for (const run of runs) {
      expect(run.localAgent?.session.header.parentSession).toBe(parent.id)
      expect(run.localAgent?.session.header.cwd).toBe(process.cwd())
    }
    // Catalog records are expected; an automatic completion message would wake
    // the root outside Shadow's validation and report batching path.
    expect(parent.session.snapshotEvents().filter(event => event.type === 'user/message')).toEqual(
      before.filter(event => event.type === 'user/message'),
    )
    await Promise.all(runs.map(run => run.dispose()))
  })

  it('rejects unconditioned creation through the registered local provider', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await mountAgentLoopTestDependencies(ctx, { workingDirectory: true })
    await ctx.plugin(AgentLoop, { agents: [] })
    await ctx.plugin(SubagentRuntime)
    installShadowMindProvider(ctx)
    const parent = await ctx.agentLoop.create(SessionId('parent'))
    await expect(ctx.subagents.startActivation({
      provider: 'shadow-mind', label: 'unconditioned', signal: new AbortController().signal,
      delivery: 'caller', request: { parent, prompt: [{ type: 'text', text: 'Review.' }] },
    })).rejects.toThrow('Shadow reviews are one-shot')
    expect(ctx.agents.list().map(agent => agent.id)).toEqual([parent.id])
  })


  it('blocks tools registered by a preset in the child own layer', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await mountAgentLoopTestDependencies(ctx, { workingDirectory: true })
    await ctx.plugin(AgentLoop, { agents: [] })
    await ctx.plugin(SubagentRuntime)
    installShadowMindProvider(ctx)
    const parent = await ctx.agentLoop.create(SessionId('parent'), { provider: 'selected', model: 'root-model' })
    let executed = false
    ctx.on('agent/created', ({ agent }) => {
      if (agent.id === parent.id) return
      agent.ctx.tools.register(defineTool({
        name: 'preset_local_write', description: 'A child-local preset capability.', parameters: {},
        output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
        execute: async () => { executed = true; return 'must not run' },
      }))
    })
    const adapter = new MockAdapter([
      request => {
        expect(request.tools?.map(tool => tool.name)).toEqual(['structured_output'])
        return toolCallResponse('forbidden', 'preset_local_write', {})
      },
      toolCallResponse('result', 'structured_output', { status: 'report', content: 'Checked.', verdict: 'challenge', refs: [] }),
    ])
    ctx.llm.registerAdapter(['selected'], adapter)
    const run = await startShadowMindRun(ctx, {
      parent, prompt: [{ type: 'text', text: 'Review.' }], signal: new AbortController().signal,
      outputSchema: OUTPUT_SCHEMA, toolFilter: { allow: [] },
    })
    await expect(run.result).resolves.toMatchObject({ stopReason: 'completed', structured: { content: 'Checked.' } })
    expect(executed).toBe(false)
    expect(run.localAgent?.session.snapshotEvents().some(event => event.type === 'tool/result' && event.data.message.isError)).toBe(true)
    await run.dispose()
  })

})
