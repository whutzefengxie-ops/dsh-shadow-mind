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
})
