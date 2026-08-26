/**
 * Three linked provider/model/effort dropdowns plus an agent-preset dropdown,
 * all bound to the live DSH directory served by the `catalog` remote. The
 * wire format stays the legacy `provider/model` route string: this component
 * composes and decomposes it, so stored definitions and the model-facing
 * management tools keep their unchanged contract.
 *
 * The dropdowns own local selection state so a user can pick a provider
 * before picking a model (a half-composed route is emitted as an empty
 * route). External value changes — a fresh load or a discard — are adopted
 * whenever they differ from what this component last emitted.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ShadowModelCatalog } from '../runtime/types.ts'
import css from './ShadowMindSettingsTab.module.css'

/** Selection state the component owns and reports back. */
export interface ModelRouteValue {
  /** `provider/model` route string; empty inherits. */
  route: string
  /** Adapter-owned reasoning effort id; empty inherits. */
  effort: string
  /** DSH agent-preset id; empty binds none. */
  preset: string
}

/** Display copy the host tab supplies from its locale dictionary. */
export interface ModelRouteSelectLabels {
  provider: string
  model: string
  effort: string
  preset: string
}

export interface ModelRouteSelectProps {
  /** Current selection. */
  value: ModelRouteValue
  /** Live DSH directory; null disables every dropdown. */
  catalog: ShadowModelCatalog | null
  disabled?: boolean
  labels: ModelRouteSelectLabels
  /** Effort fallback options when the adapter advertises none. */
  effortFallback?: readonly string[]
  /** Hide the effort dropdown (fields that have no effort of their own). */
  hideEffort?: boolean
  /** Hide the preset dropdown (fields that have no preset of their own). */
  hidePreset?: boolean
  onChange: (next: ModelRouteValue) => void
}

/** Split one route string into provider and model halves. */
export function splitRoute(route: string): { provider: string; model: string } {
  const slash = route.indexOf('/')
  if (slash <= 0) return { provider: '', model: '' }
  return { provider: route.slice(0, slash), model: route.slice(slash + 1) }
}

/** Shallow equality for the externally visible selection state. */
function sameValue(left: ModelRouteValue, right: ModelRouteValue): boolean {
  return left.route === right.route && left.effort === right.effort && left.preset === right.preset
}

/** Render the four linked dropdowns. */
export function ModelRouteSelect(props: ModelRouteSelectProps): ReactNode {
  const { catalog, labels, effortFallback = [] } = props
  const groups = catalog?.groups ?? []
  const failures = catalog?.failures ?? []
  const presets = catalog?.agentPresets ?? []
  const initial = splitRoute(props.value.route)
  const [provider, setProvider] = useState(initial.provider)
  const [model, setModel] = useState(initial.model)
  const [effort, setEffort] = useState(props.value.effort)
  const [preset, setPreset] = useState(props.value.preset)
  const lastEmitted = useRef(props.value)

  // Adopt an external change (load, discard, another field edit) that this
  // component did not emit itself; own emissions carry through untouched.
  useEffect(() => {
    if (sameValue(lastEmitted.current, props.value)) return
    lastEmitted.current = props.value
    const split = splitRoute(props.value.route)
    setProvider(split.provider)
    setModel(split.model)
    setEffort(props.value.effort)
    setPreset(props.value.preset)
  }, [props.value])

  const group = groups.find(candidate => candidate.id === provider)
  const modelEntry = group?.models.find(candidate => candidate.id === model)
  const advertisedEfforts = modelEntry?.reasoning?.efforts.map(entry => entry.id) ?? effortFallback
  const effortKnown = effort === '' || advertisedEfforts.includes(effort)
  const controlsDisabled = props.disabled === true || catalog === null
  const currentRoute = model === '' ? '' : `${provider}/${model}`

  const emit = (next: ModelRouteValue): void => {
    lastEmitted.current = next
    props.onChange(next)
  }

  const adoptRoute = (route: string): void => {
    // Callers set provider/model state themselves: a half-composed route
    // (provider picked, model still pending) must not erase that selection.
    const split = splitRoute(route)
    const efforts = groups.find(candidate => candidate.id === split.provider)
      ?.models.find(candidate => candidate.id === split.model)
      ?.reasoning?.efforts.map(entry => entry.id) ?? effortFallback
    const nextEffort = effort !== '' && !efforts.includes(effort) ? '' : effort
    setEffort(nextEffort)
    emit({ route, effort: nextEffort, preset })
  }

  return (
    <>
      <label className={css.field}>
        <span>{labels.provider}</span>
        <select
          disabled={controlsDisabled}
          value={provider}
          onChange={(event) => {
            const next = event.currentTarget.value
            const nextModels = groups.find(candidate => candidate.id === next)?.models ?? []
            const nextModel = next === '' || nextModels.some(candidate => candidate.id === model) ? model : ''
            setProvider(next)
            setModel(nextModel)
            adoptRoute(next === '' || nextModel === '' ? '' : `${next}/${nextModel}`)
          }}
        >
          <option value="">—</option>
          {groups.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
          {provider !== '' && group === undefined
            ? <option value={provider} disabled>{provider}</option>
            : null}
          {failures.map(candidate => <option key={candidate.id} value={candidate.id} disabled>{candidate.name}</option>)}
        </select>
      </label>
      <label className={css.field}>
        <span>{labels.model}</span>
        <select
          disabled={controlsDisabled || provider === '' || group === undefined}
          value={model}
          onChange={(event) => {
            const next = event.currentTarget.value
            setModel(next)
            adoptRoute(next === '' ? '' : `${provider}/${next}`)
          }}
        >
          <option value="">—</option>
          {group?.models.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>) ?? null}
          {model !== '' && modelEntry === undefined
            ? <option value={model} disabled>{model}</option>
            : null}
        </select>
      </label>
      {props.hideEffort === true ? null : (
        <label className={css.field}>
          <span>{labels.effort}</span>
          <select
            disabled={controlsDisabled}
            value={effort}
            onChange={(event) => {
              const next = event.currentTarget.value
              setEffort(next)
              emit({ route: currentRoute, effort: next, preset })
            }}
          >
            <option value="">—</option>
            {advertisedEfforts.map(entry => <option key={entry} value={entry}>{entry}</option>)}
            {effort !== '' && !effortKnown
              ? <option value={effort} disabled>{effort}</option>
              : null}
          </select>
        </label>
      )}
      {props.hidePreset === true ? null : (
        <label className={css.field}>
          <span>{labels.preset}</span>
          <select
            disabled={controlsDisabled}
            value={preset}
            onChange={(event) => {
              const next = event.currentTarget.value
              setPreset(next)
              emit({ route: currentRoute, effort, preset: next })
            }}
          >
            <option value="">—</option>
            {presets.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
            {preset !== '' && !presets.some(candidate => candidate.id === preset)
              ? <option value={preset} disabled>{preset}</option>
              : null}
          </select>
        </label>
      )}
    </>
  )
}
