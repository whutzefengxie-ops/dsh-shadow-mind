/**
 * Three linked provider/model/effort dropdowns plus an agent-preset dropdown,
 * all bound to the live DSH directory served by the `catalog` remote. The
 * wire format stays the legacy `provider/model` route string: this component
 * composes and decomposes it, so stored definitions and the model-facing
 * management tools keep their unchanged contract.
 */

import type { ReactNode } from 'react'
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

/** Render the four linked dropdowns. */
export function ModelRouteSelect(props: ModelRouteSelectProps): ReactNode {
  const { catalog, labels, effortFallback = [] } = props
  const { provider, model } = splitRoute(props.value.route)
  const groups = catalog?.groups ?? []
  const failures = catalog?.failures ?? []
  const presets = catalog?.agentPresets ?? []
  const group = groups.find(candidate => candidate.id === provider)
  const modelEntry = group?.models.find(candidate => candidate.id === model)
  const advertisedEfforts = modelEntry?.reasoning?.efforts.map(effort => effort.id) ?? effortFallback
  const effortKnown = props.value.effort === '' || advertisedEfforts.includes(props.value.effort)
  const controlsDisabled = props.disabled === true || catalog === null

  const setRoute = (route: string): void => {
    const next = splitRoute(route)
    // A route change invalidates an effort the new model does not advertise.
    const effort = props.value.effort
    const efforts = groups.find(candidate => candidate.id === next.provider)
      ?.models.find(candidate => candidate.id === next.model)
      ?.reasoning?.efforts.map(candidate => candidate.id) ?? effortFallback
    props.onChange({
      route,
      effort: effort !== '' && !efforts.includes(effort) ? '' : effort,
      preset: props.value.preset,
    })
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
            setRoute(next === '' ? '' : nextModel === '' ? '' : `${next}/${nextModel}`)
          }}
        >
          <option value="">—</option>
          {groups.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
          {provider !== '' && group === undefined
            ? <option value={provider} disabled>{provider}</option>
            : null}
          {failures.map(candidate => <option key={candidate.id} value={candidate.id} disabled>{candidate.name}</option>)}
        </select>
        <small>{labels.provider}</small>
      </label>
      <label className={css.field}>
        <span>{labels.model}</span>
        <select
          disabled={controlsDisabled || provider === '' || group === undefined}
          value={model}
          onChange={(event) => {
            const next = event.currentTarget.value
            setRoute(next === '' ? '' : `${provider}/${next}`)
          }}
        >
          <option value="">—</option>
          {group?.models.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>) ?? null}
          {model !== '' && modelEntry === undefined
            ? <option value={model} disabled>{model}</option>
            : null}
        </select>
        <small>{labels.model}</small>
      </label>
      {props.hideEffort === true ? null : (
        <label className={css.field}>
          <span>{labels.effort}</span>
          <select
            disabled={controlsDisabled}
            value={props.value.effort}
            onChange={(event) => {
              props.onChange({ ...props.value, effort: event.currentTarget.value })
            }}
          >
            <option value="">—</option>
            {advertisedEfforts.map(effort => <option key={effort} value={effort}>{effort}</option>)}
            {props.value.effort !== '' && !effortKnown
              ? <option value={props.value.effort}>{props.value.effort}</option>
              : null}
          </select>
          <small>{labels.effort}</small>
        </label>
      )}
      {props.hidePreset === true ? null : (
        <label className={css.field}>
          <span>{labels.preset}</span>
          <select
            disabled={controlsDisabled}
            value={props.value.preset}
            onChange={(event) => {
              props.onChange({ ...props.value, preset: event.currentTarget.value })
            }}
          >
            <option value="">—</option>
            {presets.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
            {props.value.preset !== '' && !presets.some(candidate => candidate.id === props.value.preset)
              ? <option value={props.value.preset} disabled>{props.value.preset}</option>
              : null}
          </select>
          <small>{labels.preset}</small>
        </label>
      )}
    </>
  )
}
