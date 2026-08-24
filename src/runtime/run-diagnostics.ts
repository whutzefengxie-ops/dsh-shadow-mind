/** Stable Shadow lifecycle diagnostics that never expose model inputs. */

import type {
  ShadowCancellationSource,
  ShadowRunReasonCode,
  ShadowRunStage,
  ShadowSafeError,
} from './types.ts'

const MAX_ERROR_MESSAGE_CHARS = 500
const MAX_AGGREGATE_CAUSES = 8
const CREDENTIAL = /(?:\bBearer\s+|\bsk-)[A-Za-z0-9._~+/=-]{8,}/giu
const QUOTED_NAMED_SECRET = /\b(?:api[_-]?key|authorization|token|secret)\b\s*[:=]\s*(?:"[^"]*"|'[^']*')/giu
const NAMED_SECRET = /\b(?:api[_-]?key|authorization|token|secret)\b\s*[:=]\s*[^\s,;]+/giu
const QUOTED_WINDOWS_ABSOLUTE_PATH = /(["'])[A-Za-z]:[\\/][\s\S]*?\1/gu
const WINDOWS_ABSOLUTE_PATH = /\b[A-Za-z]:[\\/][^\s"'<>|]*/gu
const QUOTED_POSIX_ABSOLUTE_PATH = /(["'])\/(?:[^\r\n"']+\/)*[^\r\n"']*\1/gu
const POSIX_ABSOLUTE_PATH = /(^|[\s("'])\/(?:[^\s/"'<>]+\/)+[^\s"'<>]*/gu

/** Cancellation metadata retained before an AbortSignal is fired. */
export interface ShadowCancellation {
  readonly reasonCode: ShadowRunReasonCode
  readonly source: ShadowCancellationSource
}

/** Failure captured at one owned lifecycle stage. */
export interface ShadowFailure {
  readonly stage: ShadowRunStage
  readonly reasonCode: ShadowRunReasonCode
  readonly error: ShadowSafeError
}

/** Remove common credential and absolute-path forms from one diagnostic string. */
export function sanitizeDiagnosticMessage(input: string): string {
  return input
    .replace(CREDENTIAL, '[credential]')
    .replace(QUOTED_NAMED_SECRET, '[credential]')
    .replace(NAMED_SECRET, '[credential]')
    .replace(QUOTED_WINDOWS_ABSOLUTE_PATH, '[absolute-path]')
    .replace(WINDOWS_ABSOLUTE_PATH, '[absolute-path]')
    .replace(QUOTED_POSIX_ABSOLUTE_PATH, '[absolute-path]')
    .replace(POSIX_ABSOLUTE_PATH, '$1[absolute-path]')
    .slice(0, MAX_ERROR_MESSAGE_CHARS)
}

/** Convert an unknown thrown value into a bounded Remote- and JSON-safe summary. */
export function safeError(error: unknown): ShadowSafeError {
  return summarizeError(error, new Set())
}

function summarizeError(error: unknown, seen: Set<object>): ShadowSafeError {
  if (!(error instanceof Error)) {
    return { name: 'NonError', message: sanitizeDiagnosticMessage(String(error)) }
  }
  if (seen.has(error)) return { name: 'CircularError', message: 'Circular error cause omitted' }
  seen.add(error)
  const candidateCode = (error as Error & { code?: unknown }).code
  const code = typeof candidateCode === 'string' || typeof candidateCode === 'number'
    ? sanitizeDiagnosticMessage(String(candidateCode))
    : undefined
  const causes = error instanceof AggregateError
    ? error.errors.slice(0, MAX_AGGREGATE_CAUSES).map(cause => summarizeError(cause, seen))
    : error.cause === undefined ? undefined : [summarizeError(error.cause, seen)]
  return {
    name: sanitizeDiagnosticMessage(error.name),
    message: sanitizeDiagnosticMessage(error.message),
    ...code === undefined ? {} : { code },
    ...causes === undefined || causes.length === 0 ? {} : { causes },
  }
}

/** Classify a thrown failure by the stage that owned the operation. */
export function failureAt(stage: ShadowRunStage, error: unknown): ShadowFailure {
  const reasonCode: ShadowRunReasonCode = (() => {
    switch (stage) {
      case 'prepare': return 'TRAJECTORY_BUILD_FAILED'
      case 'start': return 'SUBAGENT_START_FAILED'
      case 'run': return 'SUBAGENT_RESULT_FAILED'
      case 'dispose': return 'SUBAGENT_DISPOSE_FAILED'
      case 'validate': return 'INVALID_STRUCTURED_OUTPUT'
      case 'relay': return 'REPORT_DELIVERY_FAILED'
    }
  })()
  return { stage, reasonCode, error: safeError(error) }
}
