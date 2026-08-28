/**
 * Dedicated in-process provider for fresh Shadow children. The agent factory owns
 * unpublished setup and rollback; the returned run owns the published child through
 * result settlement and quiescent disposal.
 * @module @whutzefengxie-ops/dsh-shadow-mind/subagent-provider
 */

import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import { foldConsumedWork, installModelSelection } from '@deepseek-ai/dsh-agent'
import type { Agent, AgentHandle, ModelSelection } from '@deepseek-ai/dsh-agent'
import { SessionId, type TurnEndReason } from '@deepseek-ai/dsh-session'
import { createUserMessage, type ContentBlock } from '@deepseek-ai/dsh-llm'
import {
  appendDelegatedPolicyOverrides,
  applyChildComposition,
  assertSubagentMaxDepth,
  captureDelegatedPolicyOverrides,
  childSessionMeta,
  finalAssistantOutput,
  resolveChildAgentOptions,
  resolveChildDepth,
} from '@deepseek-ai/dsh-subagent'
import type {
  ResolvedSubagentStartRequest,
  SubagentCapabilities,
  SubagentDescriptorData,
  SubagentProvider,
  SubagentResult,
  SubagentRun,
  SubagentStopReason,
} from '@deepseek-ai/dsh-subagent'
import type {} from '@deepseek-ai/dsh-system-prompt'
import {
  attachStructuredRuntime,
  type StructuredAttachment,
} from './structured-output.ts'

export {
  STRUCTURED_OUTPUT_TOOL,
  STRUCTURED_OUTPUT_INSTRUCTION,
} from './structured-output.ts'

declare module '@deepseek-ai/dsh-subagent' {
  interface SubagentCapabilities {
    /** Complete per-run model selection; absence is equivalent to false. */
    readonly modelSelection?: boolean
    /** Per-run runtime-context inheritance policy; absence is equivalent to false. */
    readonly contextInheritance?: boolean
    /** Two-step tool-free planning before investigation; absence is equivalent to false. */
    readonly thinkFirst?: boolean
  }

  interface SubagentStartRequest {
    /** Complete provider, model, and reasoning-effort selection for one child. */
    readonly modelSelection?: ModelSelection
    /** Runtime-context inheritance policy for one child. */
    readonly contextInheritance?: 'standard' | 'none'
    /** Whether this child plans once without tools before investigating. */
    readonly thinkFirst?: boolean
  }

  interface SubagentStopReasonMap {
    /** The child's turn completed normally but never satisfied the structured-output contract. */
    'no-structured-output': 'no-structured-output'
  }
}

/** Provider name reserved for Shadow Mind's conditioned fresh children. */
export const SHADOW_MIND_SUBAGENT_PROVIDER = 'shadow-mind'

/** Model-visible continuation injected after the tool-free planning request. */
export const THINK_FIRST_CONTINUATION
  = 'Planning is complete. Now investigate with the available tools and submit the required final result.'

/** Provider-authored reason for a turn that completed without the structured-output contract. */
export const STRUCTURED_OUTPUT_MISSING_DIAGNOSTIC
  = 'Shadow subagent completed its turn without calling the mandatory structured_output tool; no report was captured or relayed.'

/** Map a session turn outcome to the subagent seam's terminal vocabulary. */
function toStopReason(reason: TurnEndReason | undefined): SubagentStopReason {
  switch (reason?.kind) {
    case 'completed':
      return 'completed'
    case 'max-tokens':
      return 'max-tokens'
    case 'aborted':
      return 'aborted'
    // A pre-step rejection discarded the claimed prompt: the task was
    // declined, and the caller must not read the run as done.
    case 'blocked':
      return 'refusal'
    case 'error':
    case 'interrupted':
    default:
      return 'error'
  }
}

/** Error used when cancellation wins before the child publication boundary. */
function prePublicationAbort(): Error {
  return new Error('subagent request was aborted before child publication')
}

/** Append one one-shot descriptor inside the child's initial turn before its first request. */
function attachDescriptorAppend(childCtx: Context, descriptor: SubagentDescriptorData): void {
  let appended = false
  childCtx.on('agent/pre-step', async ({ agent }, next) => {
    const decision = await next()
    if (!appended && decision.kind === 'enter') {
      appended = true
      agent.session.append('subagent/descriptor', descriptor)
    }
    return decision
  })
}

/** Remove ordinary runtime context and pre-step additions from one child scope. */
function attachMinimalContext(childCtx: Context): void {
  childCtx.systemPrompt.suppressRuntimeContext()
  childCtx.on('agent/pre-step', async ({ messages }, next) => {
    const decision = await next()
    return decision.kind === 'reject' ? decision : { ...decision, messages }
  })
}

/** Keep the first live request tool-free, then steer exactly one investigation step. */
function attachThinkFirst(childCtx: Context, activationBoundary: number): void {
  const child = childCtx.agent as Agent
  childCtx.on('system-prompt/assemble', async (_assembly, _context, next) => {
    const transformed = await next()
    const planned = child.session.events.some(event =>
      event.seq >= activationBoundary && event.type === 'assistant/message')
    return planned ? transformed : { ...transformed, tools: [] }
  })
  let continued = false
  childCtx.on('agent/turn-stopping', ({ agent }) => {
    if (continued) return
    continued = true
    agent.steer(createUserMessage({
      content: [{ type: 'text', text: THINK_FIRST_CONTINUATION }],
      source: { kind: 'plugin', plugin: '@whutzefengxie-ops/dsh-shadow-mind' },
    }))
  })
}

/**
 * Establish and drive one in-process one-shot child. Fulfillment means the agent
 * is already published in the registry and transfers its turn, cancellation,
 * and disposal work through the returned run. Rejection means the agent
 * factory's unpublished creation transaction reached quiescence without
 * publishing a child. Every start appends its resolved descriptor inside the
 * child's initial turn.
 * @param request - the trusted typed start request, including its required signal.
 * @param options - the optional fork seed.
 * @returns a published holder-owned run.
 */
async function startInProcessRun(request: ResolvedSubagentStartRequest): Promise<SubagentRun> {
  assertSubagentMaxDepth(request.maxDepth)
  if (request.signal.aborted) throw prePublicationAbort()
  const parent = request.parent
  const childDepth = resolveChildDepth(parent, request.maxDepth)

  const childId = SessionId(randomUUID())
  const activationBoundary = 0

  // Capture before the first await: a later parent switch belongs to the
  // parent's future.
  const inherited = captureDelegatedPolicyOverrides(parent)

  let structured: StructuredAttachment | undefined
  const setup = (childCtx: Context): void => {
    appendDelegatedPolicyOverrides((childCtx.agent as Agent).session, inherited)
    applyChildComposition(childCtx, parent, {
      persona: request.persona,
      toolFilter: request.toolFilter,
    })
    if (request.modelSelection !== undefined) {
      installModelSelection(childCtx, {
        current: request.modelSelection,
        assembled: undefined,
      })
    }
    if (request.outputSchema !== undefined) {
      structured = attachStructuredRuntime(childCtx, request.outputSchema)
    }
    if (request.contextInheritance === 'none') attachMinimalContext(childCtx)
    if (request.thinkFirst === true) attachThinkFirst(childCtx, activationBoundary)
    attachDescriptorAppend(childCtx, request.descriptor)
  }

  const handle = await parent.ctx.agents.create({
    sessionId: childId,
    meta: childSessionMeta(parent, childDepth, activationBoundary),
    agentOptions: resolveChildAgentOptions(parent, {
      ...request.agentOptions,
      ...request.modelSelection === undefined
        ? {}
        : { provider: request.modelSelection.provider, model: request.modelSelection.model },
    }, childDepth),
    signal: request.signal,
    setup,
  })
  return drivePublishedRun(
    handle,
    request.signal,
    request.prompt,
    childId,
    activationBoundary,
    structured,
  )
}

/**
 * Wrap a published child in the single run lifecycle that owns signal handoff,
 * one turn, result settlement, and quiescent disposal.
 */
function drivePublishedRun(
  handle: AgentHandle,
  signal: AbortSignal,
  prompt: ContentBlock[],
  childId: SessionId,
  boundary: number,
  structured: StructuredAttachment | undefined,
): SubagentRun {
  const child = handle.agent
  const flags = { cancelled: false }
  const onAbort = (): void => {
    flags.cancelled = true
    child.cancel({ kind: 'parent' })
  }
  signal.addEventListener('abort', onAbort, { once: true })
  // Agent creation detaches its creation-only listener before returning. The
  // post-registration check closes that handoff without treating an already
  // published child as a failed start.
  if (signal.aborted) onAbort()

  const result: Promise<SubagentResult> = (async () => {
    try {
      if (!flags.cancelled) {
        child.followup(createUserMessage({ content: prompt, source: { kind: 'user' } }))
        await child.whenIdle()
      }
      return readResult(
        child,
        boundary,
        flags.cancelled,
        structured ? { captured: structured.captured() } : undefined,
      )
    } finally {
      signal.removeEventListener('abort', onAbort)
    }
  })()

  return {
    id: childId,
    localAgent: child,
    result,
    async dispose(): Promise<void> {
      signal.removeEventListener('abort', onAbort)
      flags.cancelled = true
      const settlements = await Promise.allSettled([handle.dispose(), result])
      const disposal = settlements[0]
      // The result channel owns run faults; disposal reports only failure to
      // release the published handle after both operations settle.
      if (disposal.status === 'rejected') throw disposal.reason
    },
  }
}

/** Read one settled child's result from events after its activation boundary. */
function readResult(
  child: Agent,
  boundary: number,
  cancelled: boolean,
  structured?: { captured?: { value: unknown } | undefined },
): SubagentResult {
  const own = child.session.events.slice(boundary)
  // `droppedUnrun` is deliberately unread: a one-shot prompt is claimed by its
  // awaited first turn almost immediately, and the owner's own teardown is the
  // `cancelled` flag below. A cancellation with no accounting turn resolves
  // `error` through `toStopReason(undefined)`, which never overstates success.
  const lastEnd = foldConsumedWork(own).end
  // The seam's canonical selection rule; a partial answer survives cancel and truncation.
  const output: ContentBlock[] = finalAssistantOutput(own) ?? []
  const recorded = toStopReason(lastEnd?.data.reason)
  // Disposal can tear the owner down before the loop records its ordinary
  // `aborted` end, yielding `disposed` instead.
  const stopReason: SubagentStopReason = cancelled && recorded !== 'completed' ? 'aborted' : recorded
  if (structured !== undefined) {
    if (structured.captured !== undefined) {
      return { output, structured: structured.captured.value, stopReason }
    }
    // A completed turn that never satisfied the structured-output contract is NOT
    // a provider error: the child finished normally and simply ended with a
    // passthrough answer instead of the mandatory `structured_output` call. Report
    // the contract miss as its own reason so the shadow run can surface an
    // actionable, non-misleading failure instead of "Subagent stopped with error".
    // A cancelled run still wins as `aborted`.
    if (stopReason === 'completed') {
      if (cancelled) return { output, stopReason: 'aborted' }
      return { output, diagnostic: STRUCTURED_OUTPUT_MISSING_DIAGNOSTIC, stopReason: 'no-structured-output' }
    }
  }
  return { output, stopReason }
}

/** Dedicated fresh-child provider with Shadow Mind conditioning semantics. */
class ShadowMindInProcessProvider implements SubagentProvider {
  readonly name = SHADOW_MIND_SUBAGENT_PROVIDER
  readonly capabilities: SubagentCapabilities = {
    agentOptions: true,
    outputSchema: true,
    depthLimit: true,
    toolFilter: true,
    persona: true,
    modelSelection: true,
    contextInheritance: true,
    thinkFirst: true,
  }
  readonly inheritsParentContext = false

  /** Start one fresh, conditioned in-process child. */
  start(request: ResolvedSubagentStartRequest): Promise<SubagentRun> {
    return startInProcessRun(request)
  }
}

/** Register the provider in the calling plugin scope. */
export function installShadowMindProvider(ctx: Context): void {
  if (ctx.subagents.getProvider(SHADOW_MIND_SUBAGENT_PROVIDER) !== undefined) return
  ctx.effect(
    () => ctx.subagents.registerProvider(new ShadowMindInProcessProvider()),
    'shadow-mind conditioned subagent provider',
  )
}
