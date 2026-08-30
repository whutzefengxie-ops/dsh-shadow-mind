import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { SessionId } from '@deepseek-ai/dsh-session'
import SubagentRuntime from '@deepseek-ai/dsh-subagent'
import type { ObjectJsonSchema } from '@deepseek-ai/dsh-tools'
import {
  installShadowMindProvider,
  SHADOW_MIND_SUBAGENT_PROVIDER,
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
  it('keeps think-first continuation, minimal context, routing, result, and disposal on one child', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await mountAgentLoopTestDependencies(ctx)
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
    const parent = ctx.agentLoop.create(SessionId('parent'), { provider: 'selected', model: 'root-model' })

    const run = await ctx.subagents.start(SHADOW_MIND_SUBAGENT_PROVIDER, {
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
    expect(run.localAgent?.session.events.filter(event => event.type === 'assistant/message')).toHaveLength(2)

    await run.dispose()
    expect(ctx.agents.get(run.id)).toBeUndefined()
  })

  it('resolves no-structured-output when the child completes without calling the structured tool', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await mountAgentLoopTestDependencies(ctx)
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
    const parent = ctx.agentLoop.create(SessionId('parent'), { provider: 'selected', model: 'root-model' })

    const run = await ctx.subagents.start(SHADOW_MIND_SUBAGENT_PROVIDER, {
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
    await mountAgentLoopTestDependencies(ctx)
    await ctx.plugin(AgentLoop, { agents: [] })
    await ctx.plugin(SubagentRuntime)
    installShadowMindProvider(ctx)

    const adapter = new MockAdapter([
      textResponse('1. Inspect the rendered sequence anchors.'),
      'hang',
    ])
    ctx.llm.registerAdapter(['selected'], adapter)
    const parent = ctx.agentLoop.create(SessionId('parent'), { provider: 'selected', model: 'root-model' })

    const controller = new AbortController()
    const run = await ctx.subagents.start(SHADOW_MIND_SUBAGENT_PROVIDER, {
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
    await mountAgentLoopTestDependencies(ctx)
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
    const parent = ctx.agentLoop.create(SessionId('parent'), { provider: 'selected', model: 'root-model' })

    const run = await ctx.subagents.start(SHADOW_MIND_SUBAGENT_PROVIDER, {
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
    await mountAgentLoopTestDependencies(ctx)
    await ctx.plugin(AgentLoop, { agents: [] })
    await ctx.plugin(SubagentRuntime)
    installShadowMindProvider(ctx)

    const adapter = new MockAdapter([
      textResponse('1. Inspect the rendered sequence anchors.'),
      () => { throw new Error('provider transport failed') },
    ])
    ctx.llm.registerAdapter(['selected'], adapter)
    const parent = ctx.agentLoop.create(SessionId('parent'), { provider: 'selected', model: 'root-model' })

    const run = await ctx.subagents.start(SHADOW_MIND_SUBAGENT_PROVIDER, {
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
    await mountAgentLoopTestDependencies(ctx)
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
    const parent = ctx.agentLoop.create(SessionId('parent'), { provider: 'selected', model: 'root-model' })

    const run = await ctx.subagents.start(SHADOW_MIND_SUBAGENT_PROVIDER, {
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
    const badResult = run.localAgent?.session.events.find(event =>
      event.type === 'tool/result' && event.data.message.content[0]?.isError === true)
    expect(badResult).toBeDefined()
    expect(JSON.stringify(badResult)).toContain('strictly ascending')

    await run.dispose()
    expect(ctx.agents.get(run.id)).toBeUndefined()
  })

  it('rejects an anchor outside the rendered window in-turn without a structuredAnchorSeqs match', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await mountAgentLoopTestDependencies(ctx)
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
    const parent = ctx.agentLoop.create(SessionId('parent'), { provider: 'selected', model: 'root-model' })

    const run = await ctx.subagents.start(SHADOW_MIND_SUBAGENT_PROVIDER, {
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
})
