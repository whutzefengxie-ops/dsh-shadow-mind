import { describe, expect, it } from 'vitest'
import { failureAt, safeError, sanitizeDiagnosticMessage } from '../src/runtime/run-diagnostics.ts'

describe('Shadow lifecycle diagnostics', () => {
  it('redacts credentials and absolute paths while preserving useful failure text', () => {
    const authorization = ['Author', 'ization: Bearer ', 'example-credential-value'].join('')
    const message = sanitizeDiagnosticMessage(
      'request failed at "C:\\Users\\operator\\My Secrets\\secret.json" '
        + `with api_key="production secret" and ${authorization}`,
    )

    expect(message).toContain('request failed at [absolute-path]')
    expect(message).not.toContain('operator')
    expect(message).not.toContain('My Secrets')
    expect(message).not.toContain('production secret')
    expect(message).not.toContain('example-credential-value')
  })

  it('retains safe aggregate causes without stack traces', () => {
    const nested = Object.assign(new Error('provider refused'), { code: 'E_PROVIDER' })
    const summary = safeError(new AggregateError([nested], 'run and dispose failed'))

    expect(summary).toEqual({
      name: 'AggregateError',
      message: 'run and dispose failed',
      causes: [{ name: 'Error', message: 'provider refused', code: 'E_PROVIDER' }],
    })
    expect(summary).not.toHaveProperty('stack')
  })

  it('retains a sanitized standard Error cause', () => {
    const summary = safeError(new Error('outer failure', {
      cause: new Error('failed at /srv/private/request.json with secret=hidden-value'),
    }))

    expect(summary).toEqual({
      name: 'Error',
      message: 'outer failure',
      causes: [{ name: 'Error', message: 'failed at [absolute-path] with [credential]' }],
    })
  })

  it('maps lifecycle stages to stable failure reasons', () => {
    expect(failureAt('start', new Error('unavailable'))).toMatchObject({
      stage: 'start',
      reasonCode: 'SUBAGENT_START_FAILED',
    })
    expect(failureAt('relay', new Error('closed'))).toMatchObject({
      stage: 'relay',
      reasonCode: 'REPORT_DELIVERY_FAILED',
    })
  })

  it('bounds aggregate diagnostics and breaks circular causes', () => {
    const aggregate = new AggregateError([], 'many failures')
    aggregate.errors.push(aggregate, ...Array.from({ length: 10 }, (_, index) => new Error(`failure ${String(index)}`)))

    const summary = safeError(aggregate)

    expect(summary.causes).toHaveLength(8)
    expect(summary.causes?.[0]).toEqual({ name: 'CircularError', message: 'Circular error cause omitted' })
  })
})
