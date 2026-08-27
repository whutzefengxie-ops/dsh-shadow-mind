/** Privacy-preserving root-session projection for fresh Shadow runs. @module @whutzefengxie-ops/dsh-shadow-mind/trajectory */

import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-compaction'
import type { ShadowDefinition, ShadowMindSettings } from './types.ts'

/** One projected transcript plus the exact durable anchors visible in it. */
export interface ProjectedTrajectory {
  /** Model-visible trajectory text. */
  readonly text: string
  /** Sequence numbers rendered into the text. */
  readonly seqs: ReadonlySet<number>
}

/** Count text characters recursively without retaining content. */
function contentChars(blocks: readonly ContentBlock[]): number {
  let count = 0
  for (const block of blocks) {
    if (block.type === 'text' || block.type === 'reasoning') count += block.text.length
    else if (block.type === 'tool-result') count += contentChars(block.content)
  }
  return count
}

/** Collect model-visible plain text while excluding reasoning and tool payloads. */
function visibleText(blocks: readonly ContentBlock[]): string {
  const parts: string[] = []
  for (const block of blocks) {
    if (block.type === 'text') parts.push(block.text)
    else if (block.type === 'image') parts.push('[image omitted]')
  }
  return parts.join('\n').trim()
}

/** Count non-empty lines in all nested text blocks. */
function contentLines(blocks: readonly ContentBlock[]): number {
  let count = 0
  for (const block of blocks) {
    if (block.type === 'text') count += block.text.split(/\r?\n/gu).filter(line => line.trim() !== '').length
    else if (block.type === 'tool-result') count += contentLines(block.content)
  }
  return count
}

/** Stable type counts for an unknown tool result. */
function contentKinds(blocks: readonly ContentBlock[], counts = new Map<string, number>()): Map<string, number> {
  for (const block of blocks) {
    counts.set(block.type, (counts.get(block.type) ?? 0) + 1)
    if (block.type === 'tool-result') contentKinds(block.content, counts)
  }
  return counts
}

/** Read semantic line counts from the filesystem tool's durable result metadata. */
function readMetaCounts(meta: unknown): { readonly lines: number; readonly chars: number } | undefined {
  if (meta === null || typeof meta !== 'object' || Array.isArray(meta)) return undefined
  const lines = (meta as Record<string, unknown>)['lines']
  if (!Array.isArray(lines)) return undefined
  let nonEmpty = 0
  let chars = 0
  for (const line of lines) {
    if (line === null || typeof line !== 'object' || Array.isArray(line)) return undefined
    const text = (line as Record<string, unknown>)['text']
    if (typeof text !== 'string') return undefined
    if (text.trim() !== '') nonEmpty += 1
    chars += text.length
  }
  return { lines: nonEmpty, chars }
}

/**
 * Summarize a tool result without disclosing its text.
 * @param toolName Tool name paired from the durable call event.
 * @param content Model-facing result content.
 * @param failed Whether the result carries a tool error.
 * @param meta Optional durable result metadata used only when its known fields validate.
 * @returns Deterministic compact summary.
 */
export function summarizeToolResult(
  toolName: string,
  content: readonly ContentBlock[],
  failed: boolean,
  meta?: unknown,
): string {
  const outcome = failed ? 'error' : 'success'
  const chars = contentChars(content)
  if (toolName === 'read') {
    const counts = readMetaCounts(meta) ?? { lines: contentLines(content), chars }
    return `read ${outcome}: ${String(counts.lines)} non-empty lines, ${String(counts.chars)} text characters`
  }
  if (toolName === 'grep') return `grep ${outcome}: ${String(contentLines(content))} result lines, ${String(chars)} text characters`
  if (toolName === 'glob') return `glob ${outcome}: ${String(contentLines(content))} paths, ${String(chars)} text characters`
  const kinds = [...contentKinds(content)].sort(([left], [right]) => left.localeCompare(right))
    .map(([kind, count]) => `${kind}=${String(count)}`).join(', ')
  return `${toolName} ${outcome}: ${String(chars)} text characters; blocks ${kinds === '' ? 'none' : kinds}`
}

/**
 * Project a session prefix into a stable, reasoning-free text transcript.
 * @param events Complete root session events.
 * @param capturedThroughSeq Inclusive event sequence watermark.
 * @param argumentDisclosure Tool argument policy.
 * @param capture Root trajectory window policy.
 * @returns Plain-text trajectory.
 */
export function projectTrajectoryWithAnchors(
  events: readonly SessionEvent[],
  capturedThroughSeq: number,
  argumentDisclosure: ShadowMindSettings['argumentDisclosure'],
  capture: ShadowDefinition['capture'] = 'full',
): ProjectedTrajectory {
  const lines: string[] = []
  const seqs = new Set<number>()
  const calls = new Map<string, string>()
  const boundary = capture === 'since-compaction'
    ? events.findLast(event => event.seq <= capturedThroughSeq
      && event.type === 'compaction/end'
      && event.data.error === undefined)?.seq
    : undefined
  for (const event of events) {
    if (event.seq > capturedThroughSeq) break
    if (boundary !== undefined && event.seq < boundary && event.type !== 'compaction/summary') continue
    const lineCount = lines.length
    switch (event.type) {
      case 'user/message': {
        const text = visibleText(event.data.content)
        if (text !== '') lines.push(`[seq=${String(event.seq)} user:${event.data.source.kind}]\n${text}`)
        break
      }
      case 'assistant/message': {
        const text = visibleText(event.data.message.content)
        if (text !== '') lines.push(`[seq=${String(event.seq)} assistant]\n${text}`)
        break
      }
      case 'compaction/summary': {
        const text = visibleText(event.data.summary)
        if (text !== '') lines.push(`[seq=${String(event.seq)} compaction summary]\n${text}`)
        break
      }
      case 'tool/call':
        calls.set(String(event.data.callId), event.data.name)
        lines.push(`[seq=${String(event.seq)} tool call] ${event.data.name} arguments=${argumentDisclosure === 'full' ? event.data.arguments : '[redacted]'}`)
        break
      case 'tool/result': {
        const block = event.data.message.content[0]
        const toolName = calls.get(String(block.toolCallId)) ?? 'unknown-tool'
        lines.push(`[seq=${String(event.seq)} tool result] ${summarizeToolResult(
          toolName,
          block.content,
          block.isError === true || event.data.error !== undefined,
          event.data.meta,
        )}`)
        break
      }
      default:
        break
    }
    if (lines.length > lineCount) seqs.add(event.seq)
  }
  return { text: lines.join('\n\n'), seqs }
}

/**
 * Project a session prefix into a stable, reasoning-free text transcript.
 * @param events Complete root session events.
 * @param capturedThroughSeq Inclusive event sequence watermark.
 * @param argumentDisclosure Tool argument policy.
 * @param capture Root-log range to project.
 * @returns Plain-text trajectory.
 */
export function projectTrajectory(
  events: readonly SessionEvent[],
  capturedThroughSeq: number,
  argumentDisclosure: ShadowMindSettings['argumentDisclosure'],
  capture: ShadowDefinition['capture'] = 'full',
): string {
  return projectTrajectoryWithAnchors(events, capturedThroughSeq, argumentDisclosure, capture).text
}

/**
 * Build the complete fresh-child prompt and fail closed above its configured
 * bound; a bound of zero (or less) disables the limit.
 * @param definition Selected Shadow definition.
 * @param trajectory Projected root trajectory.
 * @param capturedThroughSeq Inclusive root sequence watermark.
 * @param maxPromptChars Complete prompt bound; 0 = unlimited.
 * @returns Framed Shadow task.
 */
export function buildShadowPrompt(
  definition: ShadowDefinition,
  trajectory: string,
  capturedThroughSeq: number,
  maxPromptChars: number,
): string {
  const prompt = [
    `You are the independent Shadow \"${definition.name}\" (${definition.id}).`,
    'Review the captured root-agent trajectory. Do not assume access to hidden reasoning or omitted tool output.',
    'Return status "not_relevant" when your specialty does not apply, "silent" when it applies but adds nothing actionable, or "report" with a concise self-contained finding.',
    'For "not_relevant" and "silent", content must be an empty string; only a "report" carries body text.',
    'Every report must set verdict to "challenge", "gap", "confirm", or "uncertain"; refs is an ascending unique list of at most eight rendered seq values, and optional severity is from 0 through 1.',
    'A report must help the root agent decide or act; do not narrate that you reviewed the trajectory.',
    ...definition.thinkFirst
      ? ['Before using tools, write a numbered plan naming the rendered seq values you intend to challenge or verify.']
      : [],
    '',
    '## Shadow instructions',
    definition.prompt,
    '',
    `## Root trajectory (captured through session seq ${String(capturedThroughSeq)})`,
    trajectory === '' ? '[no model-visible trajectory content]' : trajectory,
  ].join('\n')
  if (maxPromptChars > 0 && prompt.length > maxPromptChars) {
    throw new Error(`shadow prompt has ${String(prompt.length)} characters, above maxPromptChars ${String(maxPromptChars)}`)
  }
  return prompt
}
