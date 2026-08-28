/** Small human-shaped form controls for the Shadow Mind settings tab. */

import type { ReactNode } from 'react'
import css from './ShadowMindSettingsTab.module.css'

/** Accessible on/off switch rendered as a labelled toggle button. */
export function Switch(props: {
  readonly id: string
  readonly label: string
  readonly checked: boolean
  readonly disabled?: boolean
  readonly onChange: (checked: boolean) => void
}): ReactNode {
  return (
    <label className={css.switch} htmlFor={props.id}>
      <span>{props.label}</span>
      <button
        id={props.id}
        type="button"
        role="switch"
        aria-checked={props.checked}
        disabled={props.disabled}
        className={css.switchTrack}
        data-on={props.checked}
        onClick={() => { props.onChange(!props.checked) }}
      >
        <span className={css.switchThumb} />
      </button>
    </label>
  )
}

/** 10%–100% probability slider stepping by 10 with a live value bubble. */
export function ProbabilitySlider(props: {
  readonly id: string
  readonly label: string
  readonly value: number
  readonly disabled?: boolean
  readonly onChange: (percent: number) => void
}): ReactNode {
  return (
    <label className={css.sliderField} htmlFor={props.id}>
      <span>{props.label}</span>
      <span className={css.sliderRow}>
        <input
          id={props.id}
          type="range"
          min={10}
          max={100}
          step={10}
          value={props.value}
          disabled={props.disabled}
          aria-valuemin={10}
          aria-valuemax={100}
          aria-valuenow={props.value}
          aria-valuetext={`${props.value}%`}
          onChange={(event) => { props.onChange(Number(event.currentTarget.value)) }}
        />
        <output className={css.sliderValue}>{props.value}%</output>
      </span>
    </label>
  )
}

/** Localized two-value radio group rendered as labelled option buttons. */
export function RadioGroup<T extends string>(props: {
  readonly label: string
  readonly value: T
  readonly options: readonly { readonly value: T; readonly label: string }[]
  readonly disabled?: boolean
  readonly onChange: (value: T) => void
}): ReactNode {
  return (
    <div className={css.radioGroup} role="radiogroup" aria-label={props.label}>
      <span className={css.radioGroupLabel}>{props.label}</span>
      <span className={css.radioOptions}>
        {props.options.map(option => (
          <label key={option.value} className={css.radioOption}>
            <input
              type="radio"
              name={props.label}
              value={option.value}
              checked={props.value === option.value}
              disabled={props.disabled}
              onChange={() => { props.onChange(option.value) }}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </span>
    </div>
  )
}
