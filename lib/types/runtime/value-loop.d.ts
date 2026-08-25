/** Pure challenge-response classification for diagnostic Shadow value telemetry. @module @whutzefengxie-ops/dsh-shadow-mind/value-loop */
import type { SessionEvent } from '@deepseek-ai/dsh-session';
/** Terminal diagnostic classification for one accepted challenge. */
export type ShadowValueClassification = 'challenge_adopted' | 'challenge_rejected' | 'ignored';
/** Accepted challenge awaiting evidence from later root events. */
export interface ValueLoopChallenge {
    /** Runtime-generated Shadow run id. */
    readonly runId: string;
    /** Shadow definition id. */
    readonly shadowId: string;
    /** Sequence of the relay message delivered to the root. */
    readonly relayedAtSeq: number;
    /** Root event anchors challenged by the report. */
    readonly refs: readonly number[];
}
/** Evidence reduced from a durable root trajectory. */
export interface ChallengeObservation {
    /** Root assistant text after the relay. */
    readonly responseText: string;
    /** File-like artifacts named by challenged events. */
    readonly challengedArtifacts: readonly string[];
    /** File-like artifacts targeted by later root tool calls. */
    readonly toolTargets: readonly string[];
    /** Completed root turns after the relay. */
    readonly completedTurns: number;
}
/**
 * Reduce durable events to the evidence used by the classifier.
 * @param events Root session events through the current turn.
 * @param challenge Accepted challenge metadata.
 * @returns Classification evidence without report or trajectory text.
 */
export declare function observeChallenge(events: readonly SessionEvent[], challenge: ValueLoopChallenge): ChallengeObservation;
/**
 * Classify one reduced challenge trajectory without changing runtime behavior.
 * @param observation Durable evidence after a relay.
 * @param windowTurns Completed turns required before an unanswered challenge is ignored.
 * @returns Terminal classification, or undefined while the observation window remains open.
 */
export declare function classifyChallengeObservation(observation: ChallengeObservation, windowTurns: number): ShadowValueClassification | undefined;
/**
 * Classify one accepted challenge directly from durable root events.
 * @param events Root session events through the current turn.
 * @param challenge Accepted challenge metadata.
 * @param windowTurns Completed turns required before an unanswered challenge is ignored.
 * @returns Terminal classification, or undefined while the observation window remains open.
 */
export declare function classifyChallenge(events: readonly SessionEvent[], challenge: ValueLoopChallenge, windowTurns: number): ShadowValueClassification | undefined;
