/** Pure challenge-response classification for diagnostic Shadow value telemetry. @module @whutzefengxie-ops/dsh-shadow-mind/value-loop */

import type { SessionEvent } from '@deepseek-ai/dsh-session'

/** Terminal diagnostic classification for one accepted challenge. */
export type ShadowValueClassification = 'challenge_adopted' | 'challenge_rejected' | 'ignored'

/** Accepted challenge awaiting evidence from later root events. */
export interface ValueLoopChallenge {
  /** Runtime-generated Shadow run id. */
  readonly runId: string
  /** Shadow definition id. */
  readonly shadowId: string
  /** Sequence of the relay message delivered to the root. */
  readonly relayedAtSeq: number
  /** Root event anchors challenged by the report. */
  readonly refs: readonly number[]
}

/** Evidence reduced from a durable root trajectory. */
export interface ChallengeObservation {
  /** Root assistant text after the relay. */
  readonly responseText: string
  /** File-like artifacts named by challenged events. */
  readonly challengedArtifacts: readonly string[]
  /** File-like artifacts targeted by later root tool calls. */
  readonly toolTargets: readonly string[]
  /** Completed root turns after the relay. */
  readonly completedTurns: number
}

const ARTIFACT_PATTERN = new RegExp([
  String.raw`(?:[A-Za-z]:[\\/])?(?:[A-Za-z0-9_.-]+[\\/])+[A-Za-z0-9_.-]+`,
  String.raw`[A-Za-z0-9_-]+\.[A-Za-z0-9]{1,12}`,
].join('|'), 'gu')
const REVIEW_MENTION = new RegExp([
  String.raw`\b(?:challenge|finding|report|review|shadow)\b`,
  '质疑|审查|报告|影子',
].join('|'), 'iu')
const ADOPTION_ACTION = new RegExp([
  String.raw`\b(?:accept(?:ed)?|address(?:ed)?|adopt(?:ed)?|chang(?:e|ed)|fix(?:ed)?|follow(?:ed)?|revis(?:e|ed)|updat(?:e|ed))\b`,
  '采纳|接受|已修复|已修改|已更新|已调整',
].join('|'), 'iu')
const REJECTION = new RegExp([
  String.raw`\b(?:challenge|finding|report|review|shadow)\b.{0,80}\b(?:incorrect|invalid|mistaken|not applicable|reject(?:ed)?|wrong)\b`,
  String.raw`\b(?:incorrect|invalid|mistaken|not applicable|reject(?:ed)?|wrong)\b.{0,80}\b(?:challenge|finding|report|review|shadow)\b`,
  '不采纳|拒绝.*(?:质疑|报告|审查)',
  '(?:质疑|报告|审查).*(?:不正确|不适用|错误)',
].join('|'), 'iu')

/** Extract normalized file-like artifact identifiers from model-visible or tool data. */
function artifacts(value: unknown): string[] {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return [...text.matchAll(ARTIFACT_PATTERN)].map(match => match[0].replace(/\\/gu, '/').toLowerCase())
}

/**
 * Reduce durable events to the evidence used by the classifier.
 * @param events Root session events through the current turn.
 * @param challenge Accepted challenge metadata.
 * @returns Classification evidence without report or trajectory text.
 */
export function observeChallenge(
  events: readonly SessionEvent[],
  challenge: ValueLoopChallenge,
): ChallengeObservation {
  const refs = new Set(challenge.refs)
  const challengedArtifacts = new Set<string>()
  const toolTargets = new Set<string>()
  const response: string[] = []
  let completedTurns = 0
  for (const event of events) {
    if (refs.has(event.seq)) {
      for (const artifact of artifacts(event.data)) challengedArtifacts.add(artifact)
    }
    if (event.seq <= challenge.relayedAtSeq) continue
    if (event.type === 'tool/call') {
      for (const artifact of artifacts(event.data.arguments)) toolTargets.add(artifact)
    } else if (event.type === 'assistant/message') {
      for (const block of event.data.message.content) {
        if (block.type === 'text') response.push(block.text)
      }
    } else if (event.type === 'turn/end') {
      completedTurns += 1
    }
  }
  return {
    responseText: response.join('\n'),
    challengedArtifacts: [...challengedArtifacts],
    toolTargets: [...toolTargets],
    completedTurns,
  }
}

/**
 * Classify one reduced challenge trajectory without changing runtime behavior.
 * @param observation Durable evidence after a relay.
 * @param windowTurns Completed turns required before an unanswered challenge is ignored.
 * @returns Terminal classification, or undefined while the observation window remains open.
 */
export function classifyChallengeObservation(
  observation: ChallengeObservation,
  windowTurns: number,
): ShadowValueClassification | undefined {
  if (REJECTION.test(observation.responseText)) return 'challenge_rejected'
  const challenged = new Set(observation.challengedArtifacts)
  if (observation.toolTargets.some(target => challenged.has(target))) return 'challenge_adopted'
  if (REVIEW_MENTION.test(observation.responseText) && ADOPTION_ACTION.test(observation.responseText)) {
    return 'challenge_adopted'
  }
  return observation.completedTurns >= windowTurns ? 'ignored' : undefined
}

/**
 * Classify one accepted challenge directly from durable root events.
 * @param events Root session events through the current turn.
 * @param challenge Accepted challenge metadata.
 * @param windowTurns Completed turns required before an unanswered challenge is ignored.
 * @returns Terminal classification, or undefined while the observation window remains open.
 */
export function classifyChallenge(
  events: readonly SessionEvent[],
  challenge: ValueLoopChallenge,
  windowTurns: number,
): ShadowValueClassification | undefined {
  return classifyChallengeObservation(observeChallenge(events, challenge), windowTurns)
}
