/** Shared Shadow model-route validation. @module @whutzefengxie-ops/dsh-shadow-mind/model-route */
/** A non-empty provider followed by a non-empty model. Model ids may contain additional slashes. */
export declare const SHADOW_MODEL_ROUTE_PATTERN: RegExp;
/**
 * Validate and normalize one optional Shadow model route.
 * @param value Route supplied by configuration or a definition.
 * @param key Field name used in diagnostics.
 * @returns The trimmed route, or `undefined` when omitted.
 */
export declare function optionalModelRoute(value: string | undefined, key: string): string | undefined;
