/**
 * Dedicated fresh Shadow children under DSH activation ownership. Review hooks
 * are installed before first input; caller delivery keeps reports under Shadow
 * validation and batching rather than DSH automatic parent notification.
 * @module @whutzefengxie-ops/dsh-shadow-mind/subagent-provider
 */

import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import { foldConsumedWork, installModelSelection } from '@deepseek-ai/dsh-agent'
import type { Agent, ModelSelection } from '@deepseek-ai/dsh-agent'
import { SessionId, type Session, type SessionEvent, type TurnEndReason } from '@deepseek-ai/dsh-session'
import { createUserMessage, type ContentBlock } from '@deepseek-ai/dsh-llm'
import { finalAssistantOutput, foldSubagentDescriptor } from '@deepseek-ai/dsh-subagent'
import type {
  ContinuableCreateSpec,
  SubagentStartRequest,
  SubagentCapabilities,
  SubagentProvider,
  SubagentResult,
  SubagentRun,
  SubagentStopReason,
} from '@deepseek-ai/dsh-subagent'
import type { ToolRestriction } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-system-prompt'
import {
  attachStructuredRuntime,
  STRUCTURED_OUTPUT_TOOL,
  type StructuredAttachment,
} from './structured-output.ts'
import {
  DegenerateOutputGuard,
  resolveReasoningBudget,
  type DegenerateOutputReason,
} from './degenerate-output.ts'

export {
  STRUCTURED_OUTPUT_TOOL,
  STRUCTURED_OUTPUT_INSTRUCTION,
} from './structured-output.ts'

declare module '@deepseek-ai/dsh-subagent' {
  interface SubagentCapabilities {
    /** Shadow provider supports a per-review tool restriction. */
    readonly toolFilter?: boolean
    /** Shadow provider supports a per-review persona. */
    readonly persona?: boolean
    /** Complete per-run model selection; absence is equivalent to false. */
    readonly modelSelection?: boolean
    /** Per-run runtime-context inheritance policy; absence is equivalent to false. */
    readonly contextInheritance?: boolean
    /** Two-step tool-free planning before investigation; absence is equivalent to false. */
    readonly thinkFirst?: boolean
  }

  interface SubagentStartRequest {
    /** Shadow-specific composition applied before its initial prompt is delivered. */
    readonly toolFilter?: ToolRestriction
    readonly persona?: string
    /** Complete provider, model, and reasoning-effort selection for one child. */
    readonly modelSelection?: ModelSelection
    /** Runtime-context inheritance policy for one child. */
    readonly contextInheritance?: 'standard' | 'none'
    /** Whether this child plans once without tools before investigating. */
    readonly thinkFirst?: boolean
    /**
     * Rendered trajectory anchors the child may cite in structured `refs`;
     * the child-side `structured_output` tool rejects other seq values in-turn.
     */
    readonly structuredAnchorSeqs?: ReadonlySet<number>
  }

  interface SubagentStopReasonMap {
    /** The child's turn completed normally but never satisfied the structured-output contract. */
    'no-structured-output': 'no-structured-output'
    /** The child's stream collapsed into a degenerate repetition or a tool-free output flood and was cancelled. */
    'degenerate-output': 'degenerate-output'
  }
}

/** Provider name reserved for Shadow Mind's conditioned fresh children. */
export const SHADOW_MIND_SUBAGENT_PROVIDER = 'shadow-mind'

/** Reserved review identities whose initial conditioning is being installed. */
const pendingReviews = new Set<SessionId>()

/** Model-visible continuation injected after the tool-free planning request. */
export const THINK_FIRST_CONTINUATION
  = 'Planning is complete. Now investigate with the available tools and submit the required final result.'

/** Provider-authored reason for a turn that completed without the structured-output contract. */
export const STRUCTURED_OUTPUT_MISSING_DIAGNOSTIC
  = 'Shadow subagent completed its turn without calling the mandatory structured_output tool; no report was captured or relayed.'

/** Provider-authored diagnostics for children cancelled by the degenerate-output watchdog. */
export const DEGENERATE_OUTPUT_DIAGNOSTICS: Readonly<Record<DegenerateOutputReason, string>> = {
  repetition: 'Shadow subagent entered a degenerate output loop (the same short token repeated continuously) and was cancelled; no report was captured or relayed.',
  'output-budget': 'Shadow subagent streamed an excessive amount of output without any tool call or step/turn progress and was cancelled; no report was captured or relayed.',
}

/** Mutable degenerate-output state shared between the child scope and the settled run reader. */
export interface DegenerateOutputState {
  reason: DegenerateOutputReason | undefined
}

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

/** Remove ordinary runtime context and pre-step additions from one child scope. */
function attachMinimalContext(childCtx: Context): void {
  childCtx.systemPrompt.suppressRuntimeContext()
  childCtx.on('agent/pre-step', async ({ messages }, next) => {
    const decision = await next()
    return decision.kind === 'reject' ? decision : { ...decision, messages }
  })
}

/**
 * Keep the first live request tool-free, then steer exactly one investigation step.
 * A child cancelled by the degenerate-output watchdog must not be steered again:
 * the skip predicate keeps a cancelled run from restarting its own loop.
 * @param child - the unpublished Agent handed to setup; the composition boundary
 *   runs before publication, so the registry must never be consulted here.
 */
function attachThinkFirst(
  childCtx: Context,
  child: Agent,
  activationBoundary: number,
  skipSteer: () => boolean,
): void {
  let investigationStarted = false
  childCtx.on('agent/pre-step', async (_input, next) => {
    const decision = await next()
    if (decision.kind === 'reject' || investigationStarted) return decision
    const planned = child.session.snapshotEvents().some(event =>
      event.seq >= activationBoundary && event.type === 'assistant/message')
    if (!planned) return decision
    investigationStarted = true
    // Restored tools must be immediate declarations, not an all-deferred addition.
    return { ...decision, startsRequestSeries: true }
  })
  childCtx.on('system-prompt/assemble', async (_assembly, _context, next) => {
    const transformed = await next()
    const planned = child.session.snapshotEvents().some(event =>
      event.seq >= activationBoundary && event.type === 'assistant/message')
    return planned ? transformed : { ...transformed, tools: [] }
  })
  let continued = false
  childCtx.on('agent/turn-stopping', ({ agent }) => {
    if (continued || skipSteer()) return
    continued = true
    agent.steer(createUserMessage({
      content: [{ type: 'text', text: THINK_FIRST_CONTINUATION }],
      source: { kind: 'user' },
    }))
  })
}

/**
 * Watch one child's streamed output and cancel it the moment it degenerates
 * into a repeated-token loop or an unbounded output flood.
 *
 * The live `agent/assistant-stream` frames are the only pre-settlement view of
 * the stream: the durable `assistant/attempt` event commits once the whole
 * attempt has already streamed, which is far too late to cut a runaway loop
 * short. Frames are agent-scoped, so this listener sees exactly the child's own
 * chunks; the durable `session/event` bus still supplies the progress signals
 * (tool calls and step/turn boundaries) that reset the per-stretch budgets.
 * @param child - the unpublished Agent handed to setup. `ctx.agents` cannot be
 *   queried during setup: the factory awaits setup BEFORE inserting or announcing
 *   the session or agent, so a registry lookup here is always empty.
 * @param reasoningBudget - the child's reasoning-channel budget, resolved from
 *   its reasoning effort.
 */
function attachDegenerateOutputGuard(
  childCtx: Context,
  child: Agent,
  childId: SessionId,
  state: DegenerateOutputState,
  reasoningBudget: number,
): void {
  const guard = new DegenerateOutputGuard(reasoningBudget)
  const fire = (reason: DegenerateOutputReason): void => {
    state.reason = reason
    // Defer the cancel out of the event dispatch: the guard fires inside the
    // chunk publication path, and the child's cancel walks its own teardown.
    queueMicrotask(() => { child.cancel({ kind: 'parent' }) })
  }
  childCtx.on('agent/assistant-stream', ({ agent, frame }) => {
    if (state.reason !== undefined || agent.id !== childId) return
    if (frame.type === 'end') {
      guard.observeBoundary()
      return
    }
    if (frame.type !== 'chunk') return
    const chunk = frame.chunk
    if (chunk.type !== 'text-delta' && chunk.type !== 'reasoning-delta') return
    const detection = guard.observeChunk(chunk.text, chunk.type === 'text-delta' ? 'text' : 'reasoning')
    if (detection !== undefined) fire(detection.reason)
  })
  childCtx.on('session/event', (session: Session, event: SessionEvent) => {
    if (session.id !== childId || state.reason !== undefined) return
    if (event.type === 'tool/call') {
      guard.observeToolCall()
      return
    }
    if (event.type === 'step/end' || event.type === 'turn/end') {
      // A fresh step gets a fresh budget: a long but healthy tool-free
      // planning step must not bleed its text into the investigation step.
      guard.observeBoundary()
    }
  })
}

/** Constrain preset-local tools as well as inherited tools on DSH rc.2. */
function attachReviewToolRestriction(childCtx: Context, filter: ToolRestriction): void {
  childCtx.tools.restrict(filter)
  const allow = filter.allow === undefined ? undefined : new Set(filter.allow)
  const deny = new Set(filter.deny)
  const permitted = (name: string): boolean => name === STRUCTURED_OUTPUT_TOOL
    || name === 'run_code' // PTC transport; every nested end-capability still passes the guard.
    || ((allow === undefined || allow.has(name)) && !deny.has(name))
  // New presets may register tools directly in the child's own layer. DSH's
  // inherited-surface restriction deliberately exempts that layer, so enforce
  // the review allowlist both on the final prompt and at actual dispatch.
  childCtx.on('system-prompt/assemble', async (_assembly, _context, next) => {
    const transformed = await next()
    return { ...transformed, tools: transformed.tools.filter(tool => permitted(tool.name)) }
  })
  childCtx.tools.guard(exec => permitted(exec.name)
    ? undefined : 'This tool is outside the Shadow review allowlist.')
}

/** A caller-owned review receipt retaining its settled local evidence. */
export interface ShadowMindRun extends SubagentRun {
  readonly localAgent?: Agent | undefined
}

/**
 * Start a caller-delivered activation. DSH owns creation, policy inheritance,
 * directory selection, capacity, and teardown. The serial agent/created hook
 * installs review conditioning before the manager delivers the first prompt.
 */
export async function startShadowMindRun(ctx: Context, request: SubagentStartRequest): Promise<ShadowMindRun> {
  const provider = ctx.subagents.getProvider(SHADOW_MIND_SUBAGENT_PROVIDER)
  if (provider === undefined) throw new Error('Shadow Mind subagent provider is not registered')
  const local = provider.prepareContinuable !== undefined
  const childId = SessionId(randomUUID())
  let child: Agent | undefined
  let structured: StructuredAttachment | undefined
  const degenerateState: DegenerateOutputState = { reason: undefined }
  const detach = local ? ctx.on('agent/created', ({ agent }) => {
    if (agent.id !== childId) return
    child = agent
    const childCtx = agent.ctx
    if (request.persona !== undefined) {
      childCtx.systemPrompt.section({
        name: 'deployment:persona-prefix',
        order: childCtx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_PREFIX'),
        text: request.persona,
      })
    }
    if (request.toolFilter !== undefined) attachReviewToolRestriction(childCtx, request.toolFilter)
    if (request.modelSelection !== undefined) {
      installModelSelection(childCtx, { current: request.modelSelection, assembled: undefined })
    }
    if (request.outputSchema !== undefined) {
      structured = attachStructuredRuntime(childCtx, request.outputSchema, request.structuredAnchorSeqs)
    }
    if (request.contextInheritance === 'none') attachMinimalContext(childCtx)
    if (request.thinkFirst === true) {
      attachThinkFirst(childCtx, agent, 0, () => degenerateState.reason !== undefined)
    }
    attachDegenerateOutputGuard(childCtx, agent, childId, degenerateState,
      resolveReasoningBudget(request.modelSelection?.reasoningEffort))
  }) : () => {}
  const { signal, label, outputSchema, modelSelection, ...options } = request
  if (local) pendingReviews.add(childId)
  let activation
  try {
    activation = await ctx.subagents.startActivation({
      provider: SHADOW_MIND_SUBAGENT_PROVIDER,
      ...local ? { childId } : {},
      label: label ?? 'shadow',
      delivery: 'caller',
      signal,
      request: {
        ...options,
        ...!local && outputSchema !== undefined ? { outputSchema } : {},
        ...modelSelection === undefined ? {} : {
          modelSelection,
          agentOptions: { ...options.agentOptions, ...modelSelection },
        },
      },
    })
  } finally {
    pendingReviews.delete(childId)
    detach()
  }
  let cancelled = false
  const onAbort = (): void => {
    cancelled = true
    // The startup signal stops owning work after publication in DSH rc.2.
    // Keep the caller's cancellation connected to this exact activation.
    void activation.dispose().catch(() => {})
  }
  signal.addEventListener('abort', onAbort, { once: true })
  if (signal.aborted) onAbort()
  const result = activation.result.then(result => child === undefined ? result : readResult(
    child, 0, cancelled,
    structured === undefined ? undefined : { captured: structured.captured() },
    degenerateState.reason,
  )).finally(() => { signal.removeEventListener('abort', onAbort) })
  return {
    id: activation.childId,
    localAgent: child,
    result,
    async dispose(): Promise<void> {
      signal.removeEventListener('abort', onAbort)
      await activation.dispose()
    },
  }
}

/** Read one settled child's result from events after its activation boundary. */
function readResult(
  child: Agent,
  boundary: number,
  cancelled: boolean,
  structured?: { captured?: { value: unknown } | undefined },
  degenerateReason?: DegenerateOutputReason,
): SubagentResult {
  const own = child.session.snapshotEvents().slice(boundary)
  // `droppedUnrun` is deliberately unread: a one-shot prompt is claimed by its
  // awaited first turn almost immediately, and the owner's own teardown is the
  // `cancelled` flag below. A cancellation with no accounting turn resolves
  // `error` through `toStopReason(undefined)`, which never overstates success.
  const lastEnd = foldConsumedWork(own).end
  // The seam's canonical selection rule; a partial answer survives cancel and truncation.
  const output: ContentBlock[] = [...(finalAssistantOutput(own) ?? [])]
  const recorded = toStopReason(lastEnd?.data.reason)
  // Disposal can tear the owner down before the loop records its ordinary
  // `aborted` end, yielding `disposed` instead.
  const stopReason: SubagentStopReason = cancelled && recorded !== 'completed' ? 'aborted' : recorded
  // The degenerate-output watchdog wins over every other terminal reading: a
  // child whose stream collapsed was cancelled mid-generation, and the runtime
  // must fail the run with the watchdog's actionable diagnostic.
  if (degenerateReason !== undefined) {
    return {
      output,
      diagnostic: DEGENERATE_OUTPUT_DIAGNOSTICS[degenerateReason],
      stopReason: 'degenerate-output',
    }
  }
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
    agentPreset: false,
    outputSchema: true,
    depthLimit: true,
    toolFilter: true,
    persona: true,
    modelSelection: true,
    contextInheritance: true,
    thinkFirst: true,
  }
  readonly inheritsParentContext = false

  /** Let the DSH manager create a fresh session with no parent-history seed. */
  prepareContinuable(): Promise<ContinuableCreateSpec> {
    return Promise.resolve({})
  }
}

/** Register the provider in the calling plugin scope. */
export function installShadowMindProvider(ctx: Context): void {
  if (ctx.subagents.getProvider(SHADOW_MIND_SUBAGENT_PROVIDER) !== undefined) return
  // DSH local activations have a continuable descriptor. A settled review must
  // never cold-resume without its per-run tool, model, and output constraints.
  ctx.on('agent/created', ({ agent }) => {
    if (pendingReviews.has(agent.id)) return
    const descriptor = foldSubagentDescriptor(agent.session.snapshotEvents())
    if (descriptor?.provider === SHADOW_MIND_SUBAGENT_PROVIDER) {
      throw new Error('Shadow reviews are one-shot; start or retry a review from its parent session.')
    }
  })
  ctx.effect(
    () => ctx.subagents.registerProvider(new ShadowMindInProcessProvider()),
    'shadow-mind conditioned subagent provider',
  )
}
