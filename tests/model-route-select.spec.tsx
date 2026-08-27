// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ShadowModelCatalog } from '../src/runtime/types.ts'
import { ModelRouteSelect, splitRoute, type ModelRouteValue } from '../src/client/ModelRouteSelect.tsx'

afterEach(() => {
  cleanup()
})

const CATALOG: ShadowModelCatalog = {
  groups: [
    {
      id: 'deepseek-official',
      name: 'DeepSeek Official',
      models: [
        {
          id: 'deepseek-v4-pro',
          name: 'DeepSeek V4 Pro',
          reasoning: {
            efforts: [
              { id: 'low', name: 'Low' },
              { id: 'high', name: 'High' },
            ],
            defaultEffort: 'high',
          },
        },
        { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
      ],
    },
    {
      id: 'other-vendor',
      name: 'Other Vendor',
      models: [{ id: 'other-model', name: 'Other Model' }],
    },
  ],
  failures: [{ id: 'broken', name: 'Broken Route', message: 'unreachable' }],
}

const LABELS = { provider: 'Provider', model: 'Model', effort: 'Effort' }

/** Controlled render harness: every onChange commits the value and re-renders. */
function mount(initial: ModelRouteValue, props: Partial<Parameters<typeof ModelRouteSelect>[0]> = {}) {
  const calls: ModelRouteValue[] = []
  let current = initial
  const commit = (next: ModelRouteValue): void => {
    current = next
    calls.push(next)
    utils.rerender(renderElement())
  }
  const renderElement = () => (
    <ModelRouteSelect
      catalog={CATALOG}
      labels={LABELS}
      value={current}
      onChange={commit}
      {...props}
    />
  )
  const utils = render(renderElement())
  const value = (): ModelRouteValue => current
  const setExternal = (next: ModelRouteValue): void => {
    current = next
    utils.rerender(renderElement())
  }
  const select = (label: string): HTMLSelectElement => screen.getByLabelText(label) as HTMLSelectElement
  return { calls, value, setExternal, select }
}

describe('ModelRouteSelect', () => {
  it('splits a route string into provider and model halves', () => {
    expect(splitRoute('')).toEqual({ provider: '', model: '' })
    expect(splitRoute('provider')).toEqual({ provider: '', model: '' })
    expect(splitRoute('deepseek-official/deepseek-v4-pro')).toEqual({
      provider: 'deepseek-official',
      model: 'deepseek-v4-pro',
    })
    expect(splitRoute('vendor/models/with/slashes')).toEqual({
      provider: 'vendor',
      model: 'models/with/slashes',
    })
  })

  it('lists every provider group plus failure rows', () => {
    const { calls, select } = mount({ route: '', effort: '' })
    expect(calls).toHaveLength(0)
    const options = [...select('Provider').options].map(option => ({
      value: option.value,
      disabled: option.disabled,
    }))
    expect(options).toContainEqual({ value: 'deepseek-official', disabled: false })
    expect(options).toContainEqual({ value: 'other-vendor', disabled: false })
    expect(options).toContainEqual({ value: 'broken', disabled: true })
  })

  it('links model options to the selected provider and composes the route', () => {
    const harness = mount({ route: '', effort: '' })
    expect(harness.select('Model').disabled).toBe(true)

    fireEvent.change(harness.select('Provider'), { target: { value: 'deepseek-official' } })
    // Half-selection travels as a trailing-slash route so the parent can
    // distinguish it from the genuinely empty route on a later reset.
    expect(harness.value().route).toBe('deepseek-official/')
    expect(harness.select('Model').disabled).toBe(false)
    expect([...harness.select('Model').options].map(option => option.value))
      .toEqual(['', 'deepseek-v4-pro', 'deepseek-v4-flash'])

    fireEvent.change(harness.select('Model'), { target: { value: 'deepseek-v4-pro' } })
    expect(harness.value().route).toBe('deepseek-official/deepseek-v4-pro')
  })

  it('adopts an external reset and drops the pending provider selection', () => {
    const harness = mount({ route: '', effort: '' })
    fireEvent.change(harness.select('Provider'), { target: { value: 'deepseek-official' } })
    expect((harness.select('Provider')).value).toBe('deepseek-official')
    // Simulate a discard/reload that restores the stored (empty) value.
    harness.setExternal({ route: '', effort: '' })
    expect((harness.select('Provider')).value).toBe('')
    expect(harness.select('Model').disabled).toBe(true)
  })

  it('clearing the model clears the whole selection', () => {
    const harness = mount({ route: 'deepseek-official/deepseek-v4-pro', effort: '' })
    fireEvent.change(harness.select('Model'), { target: { value: '' } })
    expect(harness.value()).toEqual({ route: '', effort: '' })
    expect((harness.select('Provider')).value).toBe('')
  })

  it('advertises only the selected model\'s reasoning efforts and resets a stale effort', () => {
    const harness = mount({ route: 'deepseek-official/deepseek-v4-pro', effort: '' })
    expect([...harness.select('Effort').options].map(option => option.value))
      .toEqual(['', 'low', 'high'])

    fireEvent.change(harness.select('Effort'), { target: { value: 'low' } })
    expect(harness.value().effort).toBe('low')

    // Switching to a model without reasoning metadata clears the effort.
    fireEvent.change(harness.select('Model'), { target: { value: 'deepseek-v4-flash' } })
    expect(harness.value()).toEqual({
      route: 'deepseek-official/deepseek-v4-flash',
      effort: '',
    })
    expect([...harness.select('Effort').options].map(option => option.value)).toEqual([''])
  })

  it('keeps an unknown stored effort visible as a disabled current option', () => {
    const harness = mount({ route: 'deepseek-official/deepseek-v4-pro', effort: 'ultra' })
    const options = [...harness.select('Effort').options].map(option => ({
      value: option.value,
      disabled: option.disabled,
    }))
    expect(options).toEqual([
      { value: '', disabled: false },
      { value: 'low', disabled: false },
      { value: 'high', disabled: false },
      { value: 'ultra', disabled: true },
    ])
  })

  it('uses the effort fallback ladder for models without reasoning metadata', () => {
    const harness = mount(
      { route: 'deepseek-official/deepseek-v4-flash', effort: 'low' },
      { effortFallback: ['low', 'medium', 'high'] },
    )
    const options = [...harness.select('Effort').options].map(option => ({
      value: option.value,
      disabled: option.disabled,
    }))
    expect(options).toEqual([
      { value: '', disabled: false },
      { value: 'low', disabled: false },
      { value: 'medium', disabled: false },
      { value: 'high', disabled: false },
    ])
  })

  it('hides the effort dropdown when asked', () => {
    render(
      <ModelRouteSelect
        catalog={CATALOG}
        labels={LABELS}
        value={{ route: '', effort: '' }}
        hideEffort
        onChange={() => undefined}
      />,
    )
    expect(screen.queryByLabelText('Effort')).toBeNull()
    expect(screen.getByLabelText('Provider')).toBeDefined()
    expect(screen.getByLabelText('Model')).toBeDefined()
  })

  it('disables every dropdown while the catalog is unavailable', () => {
    render(
      <ModelRouteSelect
        catalog={null}
        labels={LABELS}
        value={{ route: '', effort: '' }}
        onChange={() => undefined}
      />,
    )
    expect((screen.getByLabelText('Provider') as HTMLSelectElement).disabled).toBe(true)
    expect((screen.getByLabelText('Model') as HTMLSelectElement).disabled).toBe(true)
    expect((screen.getByLabelText('Effort') as HTMLSelectElement).disabled).toBe(true)
  })
})
