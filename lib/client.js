window.__ModuleLoader__.load({
	id: "@whutzefengxie-ops/dsh-shadow-mind",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		var _a$1;
		function $constructor(name, initializer, params) {
			function init(inst, def) {
				if (!inst._zod) Object.defineProperty(inst, "_zod", {
					value: {
						def,
						constr: _,
						traits: /* @__PURE__ */ new Set()
					},
					enumerable: false
				});
				if (inst._zod.traits.has(name)) return;
				inst._zod.traits.add(name);
				initializer(inst, def);
				const proto = _.prototype;
				const keys = Object.keys(proto);
				for (let i = 0; i < keys.length; i++) {
					const k = keys[i];
					if (!(k in inst)) inst[k] = proto[k].bind(inst);
				}
			}
			const Parent = params?.Parent ?? Object;
			class Definition extends Parent {}
			Object.defineProperty(Definition, "name", { value: name });
			function _(def) {
				var _a;
				const inst = params?.Parent ? new Definition() : this;
				init(inst, def);
				(_a = inst._zod).deferred ?? (_a.deferred = []);
				for (const fn of inst._zod.deferred) fn();
				return inst;
			}
			Object.defineProperty(_, "init", { value: init });
			Object.defineProperty(_, Symbol.hasInstance, { value: (inst) => {
				if (params?.Parent && inst instanceof params.Parent) return true;
				return inst?._zod?.traits?.has(name);
			} });
			Object.defineProperty(_, "name", { value: name });
			return _;
		}
		var $ZodAsyncError = class extends Error {
			constructor() {
				super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
			}
		};
		var $ZodEncodeError = class extends Error {
			constructor(name) {
				super(`Encountered unidirectional transform during encode: ${name}`);
				this.name = "ZodEncodeError";
			}
		};
		(_a$1 = globalThis).__zod_globalConfig ?? (_a$1.__zod_globalConfig = {});
		const globalConfig = globalThis.__zod_globalConfig;
		function config(newConfig) {
			if (newConfig) Object.assign(globalConfig, newConfig);
			return globalConfig;
		}
		function getEnumValues(entries) {
			const numericValues = Object.values(entries).filter((v) => typeof v === "number");
			return Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
		}
		function jsonStringifyReplacer(_, value) {
			if (typeof value === "bigint") return value.toString();
			return value;
		}
		function cached(getter) {
			return { get value() {
				{
					const value = getter();
					Object.defineProperty(this, "value", { value });
					return value;
				}
			} };
		}
		function nullish(input) {
			return input === null || input === void 0;
		}
		function cleanRegex(source) {
			const start = source.startsWith("^") ? 1 : 0;
			const end = source.endsWith("$") ? source.length - 1 : source.length;
			return source.slice(start, end);
		}
		function floatSafeRemainder(val, step) {
			const ratio = val / step;
			const roundedRatio = Math.round(ratio);
			const tolerance = Number.EPSILON * Math.max(Math.abs(ratio), 1);
			if (Math.abs(ratio - roundedRatio) < tolerance) return 0;
			return ratio - roundedRatio;
		}
		const EVALUATING = /* @__PURE__*/ Symbol("evaluating");
		function defineLazy(object, key, getter) {
			let value = void 0;
			Object.defineProperty(object, key, {
				get() {
					if (value === EVALUATING) return;
					if (value === void 0) {
						value = EVALUATING;
						value = getter();
					}
					return value;
				},
				set(v) {
					Object.defineProperty(object, key, { value: v });
				},
				configurable: true
			});
		}
		function assignProp(target, prop, value) {
			Object.defineProperty(target, prop, {
				value,
				writable: true,
				enumerable: true,
				configurable: true
			});
		}
		function mergeDefs(...defs) {
			const mergedDescriptors = {};
			for (const def of defs) {
				const descriptors = Object.getOwnPropertyDescriptors(def);
				Object.assign(mergedDescriptors, descriptors);
			}
			return Object.defineProperties({}, mergedDescriptors);
		}
		function esc(str) {
			return JSON.stringify(str);
		}
		function slugify(input) {
			return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
		}
		const captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {};
		function isObject(data) {
			return typeof data === "object" && data !== null && !Array.isArray(data);
		}
		const allowsEval = /* @__PURE__*/ cached(() => {
			if (globalConfig.jitless) return false;
			if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) return false;
			try {
				new Function("");
				return true;
			} catch (_) {
				return false;
			}
		});
		function isPlainObject(o) {
			if (isObject(o) === false) return false;
			const ctor = o.constructor;
			if (ctor === void 0) return true;
			if (typeof ctor !== "function") return true;
			const prot = ctor.prototype;
			if (isObject(prot) === false) return false;
			if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) return false;
			return true;
		}
		function shallowClone(o) {
			if (isPlainObject(o)) return { ...o };
			if (Array.isArray(o)) return [...o];
			if (o instanceof Map) return new Map(o);
			if (o instanceof Set) return new Set(o);
			return o;
		}
		const propertyKeyTypes = /* @__PURE__*/ new Set([
			"string",
			"number",
			"symbol"
		]);
		function escapeRegex(str) {
			return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		}
		function clone(inst, def, params) {
			const cl = new inst._zod.constr(def ?? inst._zod.def);
			if (!def || params?.parent) cl._zod.parent = inst;
			return cl;
		}
		function normalizeParams(_params) {
			const params = _params;
			if (!params) return {};
			if (typeof params === "string") return { error: () => params };
			if (params?.message !== void 0) {
				if (params?.error !== void 0) throw new Error("Cannot specify both `message` and `error` params");
				params.error = params.message;
			}
			delete params.message;
			if (typeof params.error === "string") return {
				...params,
				error: () => params.error
			};
			return params;
		}
		function optionalKeys(shape) {
			return Object.keys(shape).filter((k) => {
				return shape[k]._zod.optin === "optional" && shape[k]._zod.optout === "optional";
			});
		}
		const NUMBER_FORMAT_RANGES = {
			safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
			int32: [-2147483648, 2147483647],
			uint32: [0, 4294967295],
			float32: [-34028234663852886e22, 34028234663852886e22],
			float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
		};
		function pick(schema, mask) {
			const currDef = schema._zod.def;
			const checks = currDef.checks;
			if (checks && checks.length > 0) throw new Error(".pick() cannot be used on object schemas containing refinements");
			return clone(schema, mergeDefs(schema._zod.def, {
				get shape() {
					const newShape = {};
					for (const key in mask) {
						if (!(key in currDef.shape)) throw new Error(`Unrecognized key: "${key}"`);
						if (!mask[key]) continue;
						newShape[key] = currDef.shape[key];
					}
					assignProp(this, "shape", newShape);
					return newShape;
				},
				checks: []
			}));
		}
		function omit(schema, mask) {
			const currDef = schema._zod.def;
			const checks = currDef.checks;
			if (checks && checks.length > 0) throw new Error(".omit() cannot be used on object schemas containing refinements");
			return clone(schema, mergeDefs(schema._zod.def, {
				get shape() {
					const newShape = { ...schema._zod.def.shape };
					for (const key in mask) {
						if (!(key in currDef.shape)) throw new Error(`Unrecognized key: "${key}"`);
						if (!mask[key]) continue;
						delete newShape[key];
					}
					assignProp(this, "shape", newShape);
					return newShape;
				},
				checks: []
			}));
		}
		function extend(schema, shape) {
			if (!isPlainObject(shape)) throw new Error("Invalid input to extend: expected a plain object");
			const checks = schema._zod.def.checks;
			if (checks && checks.length > 0) {
				const existingShape = schema._zod.def.shape;
				for (const key in shape) if (Object.getOwnPropertyDescriptor(existingShape, key) !== void 0) throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
			}
			return clone(schema, mergeDefs(schema._zod.def, { get shape() {
				const _shape = {
					...schema._zod.def.shape,
					...shape
				};
				assignProp(this, "shape", _shape);
				return _shape;
			} }));
		}
		function safeExtend(schema, shape) {
			if (!isPlainObject(shape)) throw new Error("Invalid input to safeExtend: expected a plain object");
			return clone(schema, mergeDefs(schema._zod.def, { get shape() {
				const _shape = {
					...schema._zod.def.shape,
					...shape
				};
				assignProp(this, "shape", _shape);
				return _shape;
			} }));
		}
		function merge(a, b) {
			if (a._zod.def.checks?.length) throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
			return clone(a, mergeDefs(a._zod.def, {
				get shape() {
					const _shape = {
						...a._zod.def.shape,
						...b._zod.def.shape
					};
					assignProp(this, "shape", _shape);
					return _shape;
				},
				get catchall() {
					return b._zod.def.catchall;
				},
				checks: b._zod.def.checks ?? []
			}));
		}
		function partial(Class, schema, mask) {
			const checks = schema._zod.def.checks;
			if (checks && checks.length > 0) throw new Error(".partial() cannot be used on object schemas containing refinements");
			return clone(schema, mergeDefs(schema._zod.def, {
				get shape() {
					const oldShape = schema._zod.def.shape;
					const shape = { ...oldShape };
					if (mask) for (const key in mask) {
						if (!(key in oldShape)) throw new Error(`Unrecognized key: "${key}"`);
						if (!mask[key]) continue;
						shape[key] = Class ? new Class({
							type: "optional",
							innerType: oldShape[key]
						}) : oldShape[key];
					}
					else for (const key in oldShape) shape[key] = Class ? new Class({
						type: "optional",
						innerType: oldShape[key]
					}) : oldShape[key];
					assignProp(this, "shape", shape);
					return shape;
				},
				checks: []
			}));
		}
		function required(Class, schema, mask) {
			return clone(schema, mergeDefs(schema._zod.def, { get shape() {
				const oldShape = schema._zod.def.shape;
				const shape = { ...oldShape };
				if (mask) for (const key in mask) {
					if (!(key in shape)) throw new Error(`Unrecognized key: "${key}"`);
					if (!mask[key]) continue;
					shape[key] = new Class({
						type: "nonoptional",
						innerType: oldShape[key]
					});
				}
				else for (const key in oldShape) shape[key] = new Class({
					type: "nonoptional",
					innerType: oldShape[key]
				});
				assignProp(this, "shape", shape);
				return shape;
			} }));
		}
		function aborted(x, startIndex = 0) {
			if (x.aborted === true) return true;
			for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue !== true) return true;
			return false;
		}
		function explicitlyAborted(x, startIndex = 0) {
			if (x.aborted === true) return true;
			for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue === false) return true;
			return false;
		}
		function prefixIssues(path, issues) {
			return issues.map((iss) => {
				var _a;
				(_a = iss).path ?? (_a.path = []);
				iss.path.unshift(path);
				return iss;
			});
		}
		function unwrapMessage(message) {
			return typeof message === "string" ? message : message?.message;
		}
		function finalizeIssue(iss, ctx, config) {
			const message = iss.message ? iss.message : unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config.customError?.(iss)) ?? unwrapMessage(config.localeError?.(iss)) ?? "Invalid input";
			const { inst: _inst, continue: _continue, input: _input, ...rest } = iss;
			rest.path ?? (rest.path = []);
			rest.message = message;
			if (ctx?.reportInput) rest.input = _input;
			return rest;
		}
		function getLengthableOrigin(input) {
			if (Array.isArray(input)) return "array";
			if (typeof input === "string") return "string";
			return "unknown";
		}
		function issue(...args) {
			const [iss, input, inst] = args;
			if (typeof iss === "string") return {
				message: iss,
				code: "custom",
				input,
				inst
			};
			return { ...iss };
		}
		const initializer$1 = (inst, def) => {
			inst.name = "$ZodError";
			Object.defineProperty(inst, "_zod", {
				value: inst._zod,
				enumerable: false
			});
			Object.defineProperty(inst, "issues", {
				value: def,
				enumerable: false
			});
			inst.message = JSON.stringify(def, jsonStringifyReplacer, 2);
			Object.defineProperty(inst, "toString", {
				value: () => inst.message,
				enumerable: false
			});
		};
		const $ZodError = $constructor("$ZodError", initializer$1);
		const $ZodRealError = $constructor("$ZodError", initializer$1, { Parent: Error });
		function flattenError(error, mapper = (issue) => issue.message) {
			const fieldErrors = {};
			const formErrors = [];
			for (const sub of error.issues) if (sub.path.length > 0) {
				fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
				fieldErrors[sub.path[0]].push(mapper(sub));
			} else formErrors.push(mapper(sub));
			return {
				formErrors,
				fieldErrors
			};
		}
		function formatError(error, mapper = (issue) => issue.message) {
			const fieldErrors = { _errors: [] };
			const processError = (error, path = []) => {
				for (const issue of error.issues) if (issue.code === "invalid_union" && issue.errors.length) issue.errors.map((issues) => processError({ issues }, [...path, ...issue.path]));
				else if (issue.code === "invalid_key") processError({ issues: issue.issues }, [...path, ...issue.path]);
				else if (issue.code === "invalid_element") processError({ issues: issue.issues }, [...path, ...issue.path]);
				else {
					const fullpath = [...path, ...issue.path];
					if (fullpath.length === 0) fieldErrors._errors.push(mapper(issue));
					else {
						let curr = fieldErrors;
						let i = 0;
						while (i < fullpath.length) {
							const el = fullpath[i];
							if (!(i === fullpath.length - 1)) curr[el] = curr[el] || { _errors: [] };
							else {
								curr[el] = curr[el] || { _errors: [] };
								curr[el]._errors.push(mapper(issue));
							}
							curr = curr[el];
							i++;
						}
					}
				}
			};
			processError(error);
			return fieldErrors;
		}
		const _parse = (_Err) => (schema, value, _ctx, _params) => {
			const ctx = _ctx ? {
				..._ctx,
				async: false
			} : { async: false };
			const result = schema._zod.run({
				value,
				issues: []
			}, ctx);
			if (result instanceof Promise) throw new $ZodAsyncError();
			if (result.issues.length) {
				const e = new ((_params?.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
				captureStackTrace(e, _params?.callee);
				throw e;
			}
			return result.value;
		};
		const _parseAsync = (_Err) => async (schema, value, _ctx, params) => {
			const ctx = _ctx ? {
				..._ctx,
				async: true
			} : { async: true };
			let result = schema._zod.run({
				value,
				issues: []
			}, ctx);
			if (result instanceof Promise) result = await result;
			if (result.issues.length) {
				const e = new ((params?.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
				captureStackTrace(e, params?.callee);
				throw e;
			}
			return result.value;
		};
		const _safeParse = (_Err) => (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				async: false
			} : { async: false };
			const result = schema._zod.run({
				value,
				issues: []
			}, ctx);
			if (result instanceof Promise) throw new $ZodAsyncError();
			return result.issues.length ? {
				success: false,
				error: new (_Err ?? $ZodError)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
			} : {
				success: true,
				data: result.value
			};
		};
		const safeParse$1 = /* @__PURE__*/ _safeParse($ZodRealError);
		const _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				async: true
			} : { async: true };
			let result = schema._zod.run({
				value,
				issues: []
			}, ctx);
			if (result instanceof Promise) result = await result;
			return result.issues.length ? {
				success: false,
				error: new _Err(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
			} : {
				success: true,
				data: result.value
			};
		};
		const safeParseAsync$1 = /* @__PURE__*/ _safeParseAsync($ZodRealError);
		const _encode = (_Err) => (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				direction: "backward"
			} : { direction: "backward" };
			return _parse(_Err)(schema, value, ctx);
		};
		const _decode = (_Err) => (schema, value, _ctx) => {
			return _parse(_Err)(schema, value, _ctx);
		};
		const _encodeAsync = (_Err) => async (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				direction: "backward"
			} : { direction: "backward" };
			return _parseAsync(_Err)(schema, value, ctx);
		};
		const _decodeAsync = (_Err) => async (schema, value, _ctx) => {
			return _parseAsync(_Err)(schema, value, _ctx);
		};
		const _safeEncode = (_Err) => (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				direction: "backward"
			} : { direction: "backward" };
			return _safeParse(_Err)(schema, value, ctx);
		};
		const _safeDecode = (_Err) => (schema, value, _ctx) => {
			return _safeParse(_Err)(schema, value, _ctx);
		};
		const _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
			const ctx = _ctx ? {
				..._ctx,
				direction: "backward"
			} : { direction: "backward" };
			return _safeParseAsync(_Err)(schema, value, ctx);
		};
		const _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
			return _safeParseAsync(_Err)(schema, value, _ctx);
		};
		/**
		* @deprecated CUID v1 is deprecated by its authors due to information leakage
		* (timestamps embedded in the id). Use {@link cuid2} instead.
		* See https://github.com/paralleldrive/cuid.
		*/
		const cuid = /^[cC][0-9a-z]{6,}$/;
		const cuid2 = /^[0-9a-z]+$/;
		const ulid = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
		const xid = /^[0-9a-vA-V]{20}$/;
		const ksuid = /^[A-Za-z0-9]{27}$/;
		const nanoid = /^[a-zA-Z0-9_-]{21}$/;
		/** ISO 8601-1 duration regex. Does not support the 8601-2 extensions like negative durations or fractional/negative components. */
		const duration$1 = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
		/** A regex for any UUID-like identifier: 8-4-4-4-12 hex pattern */
		const guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
		/** Returns a regex for validating an RFC 9562/4122 UUID.
		*
		* @param version Optionally specify a version 1-8. If no version is specified, all versions are supported. */
		const uuid = (version) => {
			if (!version) return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
			return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
		};
		/** Practical email validation */
		const email = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
		const _emoji$1 = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
		function emoji() {
			return new RegExp(_emoji$1, "u");
		}
		const ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
		const ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
		const cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
		const cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
		const base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
		const base64url = /^[A-Za-z0-9_-]*$/;
		const httpProtocol = /^https?$/;
		const e164 = /^\+[1-9]\d{6,14}$/;
		const dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
		const date$1 = /*@__PURE__*/ new RegExp(`^${dateSource}$`);
		function timeSource(args) {
			const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
			return typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
		}
		function time$1(args) {
			return new RegExp(`^${timeSource(args)}$`);
		}
		function datetime$1(args) {
			const time = timeSource({ precision: args.precision });
			const opts = ["Z"];
			if (args.local) opts.push("");
			if (args.offset) opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
			const timeRegex = `${time}(?:${opts.join("|")})`;
			return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
		}
		const string$1 = (params) => {
			const regex = params ? `[\\s\\S]{${params?.minimum ?? 0},${params?.maximum ?? ""}}` : `[\\s\\S]*`;
			return new RegExp(`^${regex}$`);
		};
		const integer = /^-?\d+$/;
		const number$1 = /^-?\d+(?:\.\d+)?$/;
		const boolean$1 = /^(?:true|false)$/i;
		const lowercase = /^[^A-Z]*$/;
		const uppercase = /^[^a-z]*$/;
		const $ZodCheck = /*@__PURE__*/ $constructor("$ZodCheck", (inst, def) => {
			var _a;
			inst._zod ?? (inst._zod = {});
			inst._zod.def = def;
			(_a = inst._zod).onattach ?? (_a.onattach = []);
		});
		const numericOriginMap = {
			number: "number",
			bigint: "bigint",
			object: "date"
		};
		const $ZodCheckLessThan = /*@__PURE__*/ $constructor("$ZodCheckLessThan", (inst, def) => {
			$ZodCheck.init(inst, def);
			const origin = numericOriginMap[typeof def.value];
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				const curr = (def.inclusive ? bag.maximum : bag.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
				if (def.value < curr) {
					if (def.inclusive) bag.maximum = def.value;
					else bag.exclusiveMaximum = def.value;
				}
			});
			inst._zod.check = (payload) => {
				if (def.inclusive ? payload.value <= def.value : payload.value < def.value) return;
				payload.issues.push({
					origin,
					code: "too_big",
					maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
					input: payload.value,
					inclusive: def.inclusive,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckGreaterThan = /*@__PURE__*/ $constructor("$ZodCheckGreaterThan", (inst, def) => {
			$ZodCheck.init(inst, def);
			const origin = numericOriginMap[typeof def.value];
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				const curr = (def.inclusive ? bag.minimum : bag.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
				if (def.value > curr) {
					if (def.inclusive) bag.minimum = def.value;
					else bag.exclusiveMinimum = def.value;
				}
			});
			inst._zod.check = (payload) => {
				if (def.inclusive ? payload.value >= def.value : payload.value > def.value) return;
				payload.issues.push({
					origin,
					code: "too_small",
					minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
					input: payload.value,
					inclusive: def.inclusive,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckMultipleOf = /*@__PURE__*/ $constructor("$ZodCheckMultipleOf", (inst, def) => {
			$ZodCheck.init(inst, def);
			inst._zod.onattach.push((inst) => {
				var _a;
				(_a = inst._zod.bag).multipleOf ?? (_a.multipleOf = def.value);
			});
			inst._zod.check = (payload) => {
				if (typeof payload.value !== typeof def.value) throw new Error("Cannot mix number and bigint in multiple_of check.");
				if (typeof payload.value === "bigint" ? payload.value % def.value === BigInt(0) : floatSafeRemainder(payload.value, def.value) === 0) return;
				payload.issues.push({
					origin: typeof payload.value,
					code: "not_multiple_of",
					divisor: def.value,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckNumberFormat = /*@__PURE__*/ $constructor("$ZodCheckNumberFormat", (inst, def) => {
			$ZodCheck.init(inst, def);
			def.format = def.format || "float64";
			const isInt = def.format?.includes("int");
			const origin = isInt ? "int" : "number";
			const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				bag.format = def.format;
				bag.minimum = minimum;
				bag.maximum = maximum;
				if (isInt) bag.pattern = integer;
			});
			inst._zod.check = (payload) => {
				const input = payload.value;
				if (isInt) {
					if (!Number.isInteger(input)) {
						payload.issues.push({
							expected: origin,
							format: def.format,
							code: "invalid_type",
							continue: false,
							input,
							inst
						});
						return;
					}
					if (!Number.isSafeInteger(input)) {
						if (input > 0) payload.issues.push({
							input,
							code: "too_big",
							maximum: Number.MAX_SAFE_INTEGER,
							note: "Integers must be within the safe integer range.",
							inst,
							origin,
							inclusive: true,
							continue: !def.abort
						});
						else payload.issues.push({
							input,
							code: "too_small",
							minimum: Number.MIN_SAFE_INTEGER,
							note: "Integers must be within the safe integer range.",
							inst,
							origin,
							inclusive: true,
							continue: !def.abort
						});
						return;
					}
				}
				if (input < minimum) payload.issues.push({
					origin: "number",
					input,
					code: "too_small",
					minimum,
					inclusive: true,
					inst,
					continue: !def.abort
				});
				if (input > maximum) payload.issues.push({
					origin: "number",
					input,
					code: "too_big",
					maximum,
					inclusive: true,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckMaxLength = /*@__PURE__*/ $constructor("$ZodCheckMaxLength", (inst, def) => {
			var _a;
			$ZodCheck.init(inst, def);
			(_a = inst._zod.def).when ?? (_a.when = (payload) => {
				const val = payload.value;
				return !nullish(val) && val.length !== void 0;
			});
			inst._zod.onattach.push((inst) => {
				const curr = inst._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
				if (def.maximum < curr) inst._zod.bag.maximum = def.maximum;
			});
			inst._zod.check = (payload) => {
				const input = payload.value;
				if (input.length <= def.maximum) return;
				const origin = getLengthableOrigin(input);
				payload.issues.push({
					origin,
					code: "too_big",
					maximum: def.maximum,
					inclusive: true,
					input,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckMinLength = /*@__PURE__*/ $constructor("$ZodCheckMinLength", (inst, def) => {
			var _a;
			$ZodCheck.init(inst, def);
			(_a = inst._zod.def).when ?? (_a.when = (payload) => {
				const val = payload.value;
				return !nullish(val) && val.length !== void 0;
			});
			inst._zod.onattach.push((inst) => {
				const curr = inst._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
				if (def.minimum > curr) inst._zod.bag.minimum = def.minimum;
			});
			inst._zod.check = (payload) => {
				const input = payload.value;
				if (input.length >= def.minimum) return;
				const origin = getLengthableOrigin(input);
				payload.issues.push({
					origin,
					code: "too_small",
					minimum: def.minimum,
					inclusive: true,
					input,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckLengthEquals = /*@__PURE__*/ $constructor("$ZodCheckLengthEquals", (inst, def) => {
			var _a;
			$ZodCheck.init(inst, def);
			(_a = inst._zod.def).when ?? (_a.when = (payload) => {
				const val = payload.value;
				return !nullish(val) && val.length !== void 0;
			});
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				bag.minimum = def.length;
				bag.maximum = def.length;
				bag.length = def.length;
			});
			inst._zod.check = (payload) => {
				const input = payload.value;
				const length = input.length;
				if (length === def.length) return;
				const origin = getLengthableOrigin(input);
				const tooBig = length > def.length;
				payload.issues.push({
					origin,
					...tooBig ? {
						code: "too_big",
						maximum: def.length
					} : {
						code: "too_small",
						minimum: def.length
					},
					inclusive: true,
					exact: true,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckStringFormat = /*@__PURE__*/ $constructor("$ZodCheckStringFormat", (inst, def) => {
			var _a, _b;
			$ZodCheck.init(inst, def);
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				bag.format = def.format;
				if (def.pattern) {
					bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
					bag.patterns.add(def.pattern);
				}
			});
			if (def.pattern) (_a = inst._zod).check ?? (_a.check = (payload) => {
				def.pattern.lastIndex = 0;
				if (def.pattern.test(payload.value)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: def.format,
					input: payload.value,
					...def.pattern ? { pattern: def.pattern.toString() } : {},
					inst,
					continue: !def.abort
				});
			});
			else (_b = inst._zod).check ?? (_b.check = () => {});
		});
		const $ZodCheckRegex = /*@__PURE__*/ $constructor("$ZodCheckRegex", (inst, def) => {
			$ZodCheckStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				def.pattern.lastIndex = 0;
				if (def.pattern.test(payload.value)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: "regex",
					input: payload.value,
					pattern: def.pattern.toString(),
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckLowerCase = /*@__PURE__*/ $constructor("$ZodCheckLowerCase", (inst, def) => {
			def.pattern ?? (def.pattern = lowercase);
			$ZodCheckStringFormat.init(inst, def);
		});
		const $ZodCheckUpperCase = /*@__PURE__*/ $constructor("$ZodCheckUpperCase", (inst, def) => {
			def.pattern ?? (def.pattern = uppercase);
			$ZodCheckStringFormat.init(inst, def);
		});
		const $ZodCheckIncludes = /*@__PURE__*/ $constructor("$ZodCheckIncludes", (inst, def) => {
			$ZodCheck.init(inst, def);
			const escapedRegex = escapeRegex(def.includes);
			const pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position}}${escapedRegex}` : escapedRegex);
			def.pattern = pattern;
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
				bag.patterns.add(pattern);
			});
			inst._zod.check = (payload) => {
				if (payload.value.includes(def.includes, def.position)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: "includes",
					includes: def.includes,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckStartsWith = /*@__PURE__*/ $constructor("$ZodCheckStartsWith", (inst, def) => {
			$ZodCheck.init(inst, def);
			const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
			def.pattern ?? (def.pattern = pattern);
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
				bag.patterns.add(pattern);
			});
			inst._zod.check = (payload) => {
				if (payload.value.startsWith(def.prefix)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: "starts_with",
					prefix: def.prefix,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckEndsWith = /*@__PURE__*/ $constructor("$ZodCheckEndsWith", (inst, def) => {
			$ZodCheck.init(inst, def);
			const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
			def.pattern ?? (def.pattern = pattern);
			inst._zod.onattach.push((inst) => {
				const bag = inst._zod.bag;
				bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
				bag.patterns.add(pattern);
			});
			inst._zod.check = (payload) => {
				if (payload.value.endsWith(def.suffix)) return;
				payload.issues.push({
					origin: "string",
					code: "invalid_format",
					format: "ends_with",
					suffix: def.suffix,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodCheckOverwrite = /*@__PURE__*/ $constructor("$ZodCheckOverwrite", (inst, def) => {
			$ZodCheck.init(inst, def);
			inst._zod.check = (payload) => {
				payload.value = def.tx(payload.value);
			};
		});
		var Doc = class {
			constructor(args = []) {
				this.content = [];
				this.indent = 0;
				if (this) this.args = args;
			}
			indented(fn) {
				this.indent += 1;
				fn(this);
				this.indent -= 1;
			}
			write(arg) {
				if (typeof arg === "function") {
					arg(this, { execution: "sync" });
					arg(this, { execution: "async" });
					return;
				}
				const lines = arg.split("\n").filter((x) => x);
				const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
				const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
				for (const line of dedented) this.content.push(line);
			}
			compile() {
				const F = Function;
				const args = this?.args;
				const lines = [...(this?.content ?? [``]).map((x) => `  ${x}`)];
				return new F(...args, lines.join("\n"));
			}
		};
		const version = {
			major: 4,
			minor: 4,
			patch: 3
		};
		const $ZodType = /*@__PURE__*/ $constructor("$ZodType", (inst, def) => {
			var _a;
			inst ?? (inst = {});
			inst._zod.def = def;
			inst._zod.bag = inst._zod.bag || {};
			inst._zod.version = version;
			const checks = [...inst._zod.def.checks ?? []];
			if (inst._zod.traits.has("$ZodCheck")) checks.unshift(inst);
			for (const ch of checks) for (const fn of ch._zod.onattach) fn(inst);
			if (checks.length === 0) {
				(_a = inst._zod).deferred ?? (_a.deferred = []);
				inst._zod.deferred?.push(() => {
					inst._zod.run = inst._zod.parse;
				});
			} else {
				const runChecks = (payload, checks, ctx) => {
					let isAborted = aborted(payload);
					let asyncResult;
					for (const ch of checks) {
						if (ch._zod.def.when) {
							if (explicitlyAborted(payload)) continue;
							if (!ch._zod.def.when(payload)) continue;
						} else if (isAborted) continue;
						const currLen = payload.issues.length;
						const _ = ch._zod.check(payload);
						if (_ instanceof Promise && ctx?.async === false) throw new $ZodAsyncError();
						if (asyncResult || _ instanceof Promise) asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
							await _;
							if (payload.issues.length === currLen) return;
							if (!isAborted) isAborted = aborted(payload, currLen);
						});
						else {
							if (payload.issues.length === currLen) continue;
							if (!isAborted) isAborted = aborted(payload, currLen);
						}
					}
					if (asyncResult) return asyncResult.then(() => {
						return payload;
					});
					return payload;
				};
				const handleCanaryResult = (canary, payload, ctx) => {
					if (aborted(canary)) {
						canary.aborted = true;
						return canary;
					}
					const checkResult = runChecks(payload, checks, ctx);
					if (checkResult instanceof Promise) {
						if (ctx.async === false) throw new $ZodAsyncError();
						return checkResult.then((checkResult) => inst._zod.parse(checkResult, ctx));
					}
					return inst._zod.parse(checkResult, ctx);
				};
				inst._zod.run = (payload, ctx) => {
					if (ctx.skipChecks) return inst._zod.parse(payload, ctx);
					if (ctx.direction === "backward") {
						const canary = inst._zod.parse({
							value: payload.value,
							issues: []
						}, {
							...ctx,
							skipChecks: true
						});
						if (canary instanceof Promise) return canary.then((canary) => {
							return handleCanaryResult(canary, payload, ctx);
						});
						return handleCanaryResult(canary, payload, ctx);
					}
					const result = inst._zod.parse(payload, ctx);
					if (result instanceof Promise) {
						if (ctx.async === false) throw new $ZodAsyncError();
						return result.then((result) => runChecks(result, checks, ctx));
					}
					return runChecks(result, checks, ctx);
				};
			}
			defineLazy(inst, "~standard", () => ({
				validate: (value) => {
					try {
						const r = safeParse$1(inst, value);
						return r.success ? { value: r.data } : { issues: r.error?.issues };
					} catch (_) {
						return safeParseAsync$1(inst, value).then((r) => r.success ? { value: r.data } : { issues: r.error?.issues });
					}
				},
				vendor: "zod",
				version: 1
			}));
		});
		const $ZodString = /*@__PURE__*/ $constructor("$ZodString", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.pattern = [...inst?._zod.bag?.patterns ?? []].pop() ?? string$1(inst._zod.bag);
			inst._zod.parse = (payload, _) => {
				if (def.coerce) try {
					payload.value = String(payload.value);
				} catch (_) {}
				if (typeof payload.value === "string") return payload;
				payload.issues.push({
					expected: "string",
					code: "invalid_type",
					input: payload.value,
					inst
				});
				return payload;
			};
		});
		const $ZodStringFormat = /*@__PURE__*/ $constructor("$ZodStringFormat", (inst, def) => {
			$ZodCheckStringFormat.init(inst, def);
			$ZodString.init(inst, def);
		});
		const $ZodGUID = /*@__PURE__*/ $constructor("$ZodGUID", (inst, def) => {
			def.pattern ?? (def.pattern = guid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodUUID = /*@__PURE__*/ $constructor("$ZodUUID", (inst, def) => {
			if (def.version) {
				const v = {
					v1: 1,
					v2: 2,
					v3: 3,
					v4: 4,
					v5: 5,
					v6: 6,
					v7: 7,
					v8: 8
				}[def.version];
				if (v === void 0) throw new Error(`Invalid UUID version: "${def.version}"`);
				def.pattern ?? (def.pattern = uuid(v));
			} else def.pattern ?? (def.pattern = uuid());
			$ZodStringFormat.init(inst, def);
		});
		const $ZodEmail = /*@__PURE__*/ $constructor("$ZodEmail", (inst, def) => {
			def.pattern ?? (def.pattern = email);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodURL = /*@__PURE__*/ $constructor("$ZodURL", (inst, def) => {
			$ZodStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				try {
					const trimmed = payload.value.trim();
					if (!def.normalize && def.protocol?.source === httpProtocol.source) {
						if (!/^https?:\/\//i.test(trimmed)) {
							payload.issues.push({
								code: "invalid_format",
								format: "url",
								note: "Invalid URL format",
								input: payload.value,
								inst,
								continue: !def.abort
							});
							return;
						}
					}
					const url = new URL(trimmed);
					if (def.hostname) {
						def.hostname.lastIndex = 0;
						if (!def.hostname.test(url.hostname)) payload.issues.push({
							code: "invalid_format",
							format: "url",
							note: "Invalid hostname",
							pattern: def.hostname.source,
							input: payload.value,
							inst,
							continue: !def.abort
						});
					}
					if (def.protocol) {
						def.protocol.lastIndex = 0;
						if (!def.protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol)) payload.issues.push({
							code: "invalid_format",
							format: "url",
							note: "Invalid protocol",
							pattern: def.protocol.source,
							input: payload.value,
							inst,
							continue: !def.abort
						});
					}
					if (def.normalize) payload.value = url.href;
					else payload.value = trimmed;
					return;
				} catch (_) {
					payload.issues.push({
						code: "invalid_format",
						format: "url",
						input: payload.value,
						inst,
						continue: !def.abort
					});
				}
			};
		});
		const $ZodEmoji = /*@__PURE__*/ $constructor("$ZodEmoji", (inst, def) => {
			def.pattern ?? (def.pattern = emoji());
			$ZodStringFormat.init(inst, def);
		});
		const $ZodNanoID = /*@__PURE__*/ $constructor("$ZodNanoID", (inst, def) => {
			def.pattern ?? (def.pattern = nanoid);
			$ZodStringFormat.init(inst, def);
		});
		/**
		* @deprecated CUID v1 is deprecated by its authors due to information leakage
		* (timestamps embedded in the id). Use {@link $ZodCUID2} instead.
		* See https://github.com/paralleldrive/cuid.
		*/
		const $ZodCUID = /*@__PURE__*/ $constructor("$ZodCUID", (inst, def) => {
			def.pattern ?? (def.pattern = cuid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodCUID2 = /*@__PURE__*/ $constructor("$ZodCUID2", (inst, def) => {
			def.pattern ?? (def.pattern = cuid2);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodULID = /*@__PURE__*/ $constructor("$ZodULID", (inst, def) => {
			def.pattern ?? (def.pattern = ulid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodXID = /*@__PURE__*/ $constructor("$ZodXID", (inst, def) => {
			def.pattern ?? (def.pattern = xid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodKSUID = /*@__PURE__*/ $constructor("$ZodKSUID", (inst, def) => {
			def.pattern ?? (def.pattern = ksuid);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodISODateTime = /*@__PURE__*/ $constructor("$ZodISODateTime", (inst, def) => {
			def.pattern ?? (def.pattern = datetime$1(def));
			$ZodStringFormat.init(inst, def);
		});
		const $ZodISODate = /*@__PURE__*/ $constructor("$ZodISODate", (inst, def) => {
			def.pattern ?? (def.pattern = date$1);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodISOTime = /*@__PURE__*/ $constructor("$ZodISOTime", (inst, def) => {
			def.pattern ?? (def.pattern = time$1(def));
			$ZodStringFormat.init(inst, def);
		});
		const $ZodISODuration = /*@__PURE__*/ $constructor("$ZodISODuration", (inst, def) => {
			def.pattern ?? (def.pattern = duration$1);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodIPv4 = /*@__PURE__*/ $constructor("$ZodIPv4", (inst, def) => {
			def.pattern ?? (def.pattern = ipv4);
			$ZodStringFormat.init(inst, def);
			inst._zod.bag.format = `ipv4`;
		});
		const $ZodIPv6 = /*@__PURE__*/ $constructor("$ZodIPv6", (inst, def) => {
			def.pattern ?? (def.pattern = ipv6);
			$ZodStringFormat.init(inst, def);
			inst._zod.bag.format = `ipv6`;
			inst._zod.check = (payload) => {
				try {
					new URL(`http://[${payload.value}]`);
				} catch {
					payload.issues.push({
						code: "invalid_format",
						format: "ipv6",
						input: payload.value,
						inst,
						continue: !def.abort
					});
				}
			};
		});
		const $ZodCIDRv4 = /*@__PURE__*/ $constructor("$ZodCIDRv4", (inst, def) => {
			def.pattern ?? (def.pattern = cidrv4);
			$ZodStringFormat.init(inst, def);
		});
		const $ZodCIDRv6 = /*@__PURE__*/ $constructor("$ZodCIDRv6", (inst, def) => {
			def.pattern ?? (def.pattern = cidrv6);
			$ZodStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				const parts = payload.value.split("/");
				try {
					if (parts.length !== 2) throw new Error();
					const [address, prefix] = parts;
					if (!prefix) throw new Error();
					const prefixNum = Number(prefix);
					if (`${prefixNum}` !== prefix) throw new Error();
					if (prefixNum < 0 || prefixNum > 128) throw new Error();
					new URL(`http://[${address}]`);
				} catch {
					payload.issues.push({
						code: "invalid_format",
						format: "cidrv6",
						input: payload.value,
						inst,
						continue: !def.abort
					});
				}
			};
		});
		function isValidBase64(data) {
			if (data === "") return true;
			if (/\s/.test(data)) return false;
			if (data.length % 4 !== 0) return false;
			try {
				atob(data);
				return true;
			} catch {
				return false;
			}
		}
		const $ZodBase64 = /*@__PURE__*/ $constructor("$ZodBase64", (inst, def) => {
			def.pattern ?? (def.pattern = base64);
			$ZodStringFormat.init(inst, def);
			inst._zod.bag.contentEncoding = "base64";
			inst._zod.check = (payload) => {
				if (isValidBase64(payload.value)) return;
				payload.issues.push({
					code: "invalid_format",
					format: "base64",
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		function isValidBase64URL(data) {
			if (!base64url.test(data)) return false;
			const base64 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
			return isValidBase64(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
		}
		const $ZodBase64URL = /*@__PURE__*/ $constructor("$ZodBase64URL", (inst, def) => {
			def.pattern ?? (def.pattern = base64url);
			$ZodStringFormat.init(inst, def);
			inst._zod.bag.contentEncoding = "base64url";
			inst._zod.check = (payload) => {
				if (isValidBase64URL(payload.value)) return;
				payload.issues.push({
					code: "invalid_format",
					format: "base64url",
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodE164 = /*@__PURE__*/ $constructor("$ZodE164", (inst, def) => {
			def.pattern ?? (def.pattern = e164);
			$ZodStringFormat.init(inst, def);
		});
		function isValidJWT(token, algorithm = null) {
			try {
				const tokensParts = token.split(".");
				if (tokensParts.length !== 3) return false;
				const [header] = tokensParts;
				if (!header) return false;
				const parsedHeader = JSON.parse(atob(header));
				if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT") return false;
				if (!parsedHeader.alg) return false;
				if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm)) return false;
				return true;
			} catch {
				return false;
			}
		}
		const $ZodJWT = /*@__PURE__*/ $constructor("$ZodJWT", (inst, def) => {
			$ZodStringFormat.init(inst, def);
			inst._zod.check = (payload) => {
				if (isValidJWT(payload.value, def.alg)) return;
				payload.issues.push({
					code: "invalid_format",
					format: "jwt",
					input: payload.value,
					inst,
					continue: !def.abort
				});
			};
		});
		const $ZodNumber = /*@__PURE__*/ $constructor("$ZodNumber", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.pattern = inst._zod.bag.pattern ?? number$1;
			inst._zod.parse = (payload, _ctx) => {
				if (def.coerce) try {
					payload.value = Number(payload.value);
				} catch (_) {}
				const input = payload.value;
				if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) return payload;
				const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? "Infinity" : void 0 : void 0;
				payload.issues.push({
					expected: "number",
					code: "invalid_type",
					input,
					inst,
					...received ? { received } : {}
				});
				return payload;
			};
		});
		const $ZodNumberFormat = /*@__PURE__*/ $constructor("$ZodNumberFormat", (inst, def) => {
			$ZodCheckNumberFormat.init(inst, def);
			$ZodNumber.init(inst, def);
		});
		const $ZodBoolean = /*@__PURE__*/ $constructor("$ZodBoolean", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.pattern = boolean$1;
			inst._zod.parse = (payload, _ctx) => {
				if (def.coerce) try {
					payload.value = Boolean(payload.value);
				} catch (_) {}
				const input = payload.value;
				if (typeof input === "boolean") return payload;
				payload.issues.push({
					expected: "boolean",
					code: "invalid_type",
					input,
					inst
				});
				return payload;
			};
		});
		const $ZodUnknown = /*@__PURE__*/ $constructor("$ZodUnknown", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.parse = (payload) => payload;
		});
		const $ZodNever = /*@__PURE__*/ $constructor("$ZodNever", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.parse = (payload, _ctx) => {
				payload.issues.push({
					expected: "never",
					code: "invalid_type",
					input: payload.value,
					inst
				});
				return payload;
			};
		});
		function handleArrayResult(result, final, index) {
			if (result.issues.length) final.issues.push(...prefixIssues(index, result.issues));
			final.value[index] = result.value;
		}
		const $ZodArray = /*@__PURE__*/ $constructor("$ZodArray", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.parse = (payload, ctx) => {
				const input = payload.value;
				if (!Array.isArray(input)) {
					payload.issues.push({
						expected: "array",
						code: "invalid_type",
						input,
						inst
					});
					return payload;
				}
				payload.value = Array(input.length);
				const proms = [];
				for (let i = 0; i < input.length; i++) {
					const item = input[i];
					const result = def.element._zod.run({
						value: item,
						issues: []
					}, ctx);
					if (result instanceof Promise) proms.push(result.then((result) => handleArrayResult(result, payload, i)));
					else handleArrayResult(result, payload, i);
				}
				if (proms.length) return Promise.all(proms).then(() => payload);
				return payload;
			};
		});
		function handlePropertyResult(result, final, key, input, isOptionalIn, isOptionalOut) {
			const isPresent = key in input;
			if (result.issues.length) {
				if (isOptionalIn && isOptionalOut && !isPresent) return;
				final.issues.push(...prefixIssues(key, result.issues));
			}
			if (!isPresent && !isOptionalIn) {
				if (!result.issues.length) final.issues.push({
					code: "invalid_type",
					expected: "nonoptional",
					input: void 0,
					path: [key]
				});
				return;
			}
			if (result.value === void 0) {
				if (isPresent) final.value[key] = void 0;
			} else final.value[key] = result.value;
		}
		function normalizeDef(def) {
			const keys = Object.keys(def.shape);
			for (const k of keys) if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) throw new Error(`Invalid element at key "${k}": expected a Zod schema`);
			const okeys = optionalKeys(def.shape);
			return {
				...def,
				keys,
				keySet: new Set(keys),
				numKeys: keys.length,
				optionalKeys: new Set(okeys)
			};
		}
		function handleCatchall(proms, input, payload, ctx, def, inst) {
			const unrecognized = [];
			const keySet = def.keySet;
			const _catchall = def.catchall._zod;
			const t = _catchall.def.type;
			const isOptionalIn = _catchall.optin === "optional";
			const isOptionalOut = _catchall.optout === "optional";
			for (const key in input) {
				if (key === "__proto__") continue;
				if (keySet.has(key)) continue;
				if (t === "never") {
					unrecognized.push(key);
					continue;
				}
				const r = _catchall.run({
					value: input[key],
					issues: []
				}, ctx);
				if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut)));
				else handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut);
			}
			if (unrecognized.length) payload.issues.push({
				code: "unrecognized_keys",
				keys: unrecognized,
				input,
				inst
			});
			if (!proms.length) return payload;
			return Promise.all(proms).then(() => {
				return payload;
			});
		}
		const $ZodObject = /*@__PURE__*/ $constructor("$ZodObject", (inst, def) => {
			$ZodType.init(inst, def);
			if (!Object.getOwnPropertyDescriptor(def, "shape")?.get) {
				const sh = def.shape;
				Object.defineProperty(def, "shape", { get: () => {
					const newSh = { ...sh };
					Object.defineProperty(def, "shape", { value: newSh });
					return newSh;
				} });
			}
			const _normalized = cached(() => normalizeDef(def));
			defineLazy(inst._zod, "propValues", () => {
				const shape = def.shape;
				const propValues = {};
				for (const key in shape) {
					const field = shape[key]._zod;
					if (field.values) {
						propValues[key] ?? (propValues[key] = /* @__PURE__ */ new Set());
						for (const v of field.values) propValues[key].add(v);
					}
				}
				return propValues;
			});
			const isObject$1 = isObject;
			const catchall = def.catchall;
			let value;
			inst._zod.parse = (payload, ctx) => {
				value ?? (value = _normalized.value);
				const input = payload.value;
				if (!isObject$1(input)) {
					payload.issues.push({
						expected: "object",
						code: "invalid_type",
						input,
						inst
					});
					return payload;
				}
				payload.value = {};
				const proms = [];
				const shape = value.shape;
				for (const key of value.keys) {
					const el = shape[key];
					const isOptionalIn = el._zod.optin === "optional";
					const isOptionalOut = el._zod.optout === "optional";
					const r = el._zod.run({
						value: input[key],
						issues: []
					}, ctx);
					if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut)));
					else handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut);
				}
				if (!catchall) return proms.length ? Promise.all(proms).then(() => payload) : payload;
				return handleCatchall(proms, input, payload, ctx, _normalized.value, inst);
			};
		});
		const $ZodObjectJIT = /*@__PURE__*/ $constructor("$ZodObjectJIT", (inst, def) => {
			$ZodObject.init(inst, def);
			const superParse = inst._zod.parse;
			const _normalized = cached(() => normalizeDef(def));
			const generateFastpass = (shape) => {
				const doc = new Doc([
					"shape",
					"payload",
					"ctx"
				]);
				const normalized = _normalized.value;
				const parseStr = (key) => {
					const k = esc(key);
					return `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
				};
				doc.write(`const input = payload.value;`);
				const ids = Object.create(null);
				let counter = 0;
				for (const key of normalized.keys) ids[key] = `key_${counter++}`;
				doc.write(`const newResult = {};`);
				for (const key of normalized.keys) {
					const id = ids[key];
					const k = esc(key);
					const schema = shape[key];
					const isOptionalIn = schema?._zod?.optin === "optional";
					const isOptionalOut = schema?._zod?.optout === "optional";
					doc.write(`const ${id} = ${parseStr(key)};`);
					if (isOptionalIn && isOptionalOut) doc.write(`
        if (${id}.issues.length) {
          if (${k} in input) {
            payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
              ...iss,
              path: iss.path ? [${k}, ...iss.path] : [${k}]
            })));
          }
        }

        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }

      `);
					else if (!isOptionalIn) doc.write(`
        const ${id}_present = ${k} in input;
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }
        if (!${id}_present && !${id}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${k}]
          });
        }

        if (${id}_present) {
          if (${id}.value === undefined) {
            newResult[${k}] = undefined;
          } else {
            newResult[${k}] = ${id}.value;
          }
        }

      `);
					else doc.write(`
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }

        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }

      `);
				}
				doc.write(`payload.value = newResult;`);
				doc.write(`return payload;`);
				const fn = doc.compile();
				return (payload, ctx) => fn(shape, payload, ctx);
			};
			let fastpass;
			const isObject$2 = isObject;
			const jit = !globalConfig.jitless;
			const fastEnabled = jit && allowsEval.value;
			const catchall = def.catchall;
			let value;
			inst._zod.parse = (payload, ctx) => {
				value ?? (value = _normalized.value);
				const input = payload.value;
				if (!isObject$2(input)) {
					payload.issues.push({
						expected: "object",
						code: "invalid_type",
						input,
						inst
					});
					return payload;
				}
				if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
					if (!fastpass) fastpass = generateFastpass(def.shape);
					payload = fastpass(payload, ctx);
					if (!catchall) return payload;
					return handleCatchall([], input, payload, ctx, value, inst);
				}
				return superParse(payload, ctx);
			};
		});
		function handleUnionResults(results, final, inst, ctx) {
			for (const result of results) if (result.issues.length === 0) {
				final.value = result.value;
				return final;
			}
			const nonaborted = results.filter((r) => !aborted(r));
			if (nonaborted.length === 1) {
				final.value = nonaborted[0].value;
				return nonaborted[0];
			}
			final.issues.push({
				code: "invalid_union",
				input: final.value,
				inst,
				errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
			});
			return final;
		}
		const $ZodUnion = /*@__PURE__*/ $constructor("$ZodUnion", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazy(inst._zod, "optin", () => def.options.some((o) => o._zod.optin === "optional") ? "optional" : void 0);
			defineLazy(inst._zod, "optout", () => def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
			defineLazy(inst._zod, "values", () => {
				if (def.options.every((o) => o._zod.values)) return new Set(def.options.flatMap((option) => Array.from(option._zod.values)));
			});
			defineLazy(inst._zod, "pattern", () => {
				if (def.options.every((o) => o._zod.pattern)) {
					const patterns = def.options.map((o) => o._zod.pattern);
					return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
				}
			});
			const first = def.options.length === 1 ? def.options[0]._zod.run : null;
			inst._zod.parse = (payload, ctx) => {
				if (first) return first(payload, ctx);
				let async = false;
				const results = [];
				for (const option of def.options) {
					const result = option._zod.run({
						value: payload.value,
						issues: []
					}, ctx);
					if (result instanceof Promise) {
						results.push(result);
						async = true;
					} else {
						if (result.issues.length === 0) return result;
						results.push(result);
					}
				}
				if (!async) return handleUnionResults(results, payload, inst, ctx);
				return Promise.all(results).then((results) => {
					return handleUnionResults(results, payload, inst, ctx);
				});
			};
		});
		const $ZodIntersection = /*@__PURE__*/ $constructor("$ZodIntersection", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.parse = (payload, ctx) => {
				const input = payload.value;
				const left = def.left._zod.run({
					value: input,
					issues: []
				}, ctx);
				const right = def.right._zod.run({
					value: input,
					issues: []
				}, ctx);
				if (left instanceof Promise || right instanceof Promise) return Promise.all([left, right]).then(([left, right]) => {
					return handleIntersectionResults(payload, left, right);
				});
				return handleIntersectionResults(payload, left, right);
			};
		});
		function mergeValues(a, b) {
			if (a === b) return {
				valid: true,
				data: a
			};
			if (a instanceof Date && b instanceof Date && +a === +b) return {
				valid: true,
				data: a
			};
			if (isPlainObject(a) && isPlainObject(b)) {
				const bKeys = Object.keys(b);
				const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
				const newObj = {
					...a,
					...b
				};
				for (const key of sharedKeys) {
					const sharedValue = mergeValues(a[key], b[key]);
					if (!sharedValue.valid) return {
						valid: false,
						mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
					};
					newObj[key] = sharedValue.data;
				}
				return {
					valid: true,
					data: newObj
				};
			}
			if (Array.isArray(a) && Array.isArray(b)) {
				if (a.length !== b.length) return {
					valid: false,
					mergeErrorPath: []
				};
				const newArray = [];
				for (let index = 0; index < a.length; index++) {
					const itemA = a[index];
					const itemB = b[index];
					const sharedValue = mergeValues(itemA, itemB);
					if (!sharedValue.valid) return {
						valid: false,
						mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
					};
					newArray.push(sharedValue.data);
				}
				return {
					valid: true,
					data: newArray
				};
			}
			return {
				valid: false,
				mergeErrorPath: []
			};
		}
		function handleIntersectionResults(result, left, right) {
			const unrecKeys = /* @__PURE__ */ new Map();
			let unrecIssue;
			for (const iss of left.issues) if (iss.code === "unrecognized_keys") {
				unrecIssue ?? (unrecIssue = iss);
				for (const k of iss.keys) {
					if (!unrecKeys.has(k)) unrecKeys.set(k, {});
					unrecKeys.get(k).l = true;
				}
			} else result.issues.push(iss);
			for (const iss of right.issues) if (iss.code === "unrecognized_keys") for (const k of iss.keys) {
				if (!unrecKeys.has(k)) unrecKeys.set(k, {});
				unrecKeys.get(k).r = true;
			}
			else result.issues.push(iss);
			const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
			if (bothKeys.length && unrecIssue) result.issues.push({
				...unrecIssue,
				keys: bothKeys
			});
			if (aborted(result)) return result;
			const merged = mergeValues(left.value, right.value);
			if (!merged.valid) throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(merged.mergeErrorPath)}`);
			result.value = merged.data;
			return result;
		}
		const $ZodEnum = /*@__PURE__*/ $constructor("$ZodEnum", (inst, def) => {
			$ZodType.init(inst, def);
			const values = getEnumValues(def.entries);
			const valuesSet = new Set(values);
			inst._zod.values = valuesSet;
			inst._zod.pattern = new RegExp(`^(${values.filter((k) => propertyKeyTypes.has(typeof k)).map((o) => typeof o === "string" ? escapeRegex(o) : o.toString()).join("|")})$`);
			inst._zod.parse = (payload, _ctx) => {
				const input = payload.value;
				if (valuesSet.has(input)) return payload;
				payload.issues.push({
					code: "invalid_value",
					values,
					input,
					inst
				});
				return payload;
			};
		});
		const $ZodLiteral = /*@__PURE__*/ $constructor("$ZodLiteral", (inst, def) => {
			$ZodType.init(inst, def);
			if (def.values.length === 0) throw new Error("Cannot create literal schema with no valid values");
			const values = new Set(def.values);
			inst._zod.values = values;
			inst._zod.pattern = new RegExp(`^(${def.values.map((o) => typeof o === "string" ? escapeRegex(o) : o ? escapeRegex(o.toString()) : String(o)).join("|")})$`);
			inst._zod.parse = (payload, _ctx) => {
				const input = payload.value;
				if (values.has(input)) return payload;
				payload.issues.push({
					code: "invalid_value",
					values: def.values,
					input,
					inst
				});
				return payload;
			};
		});
		const $ZodTransform = /*@__PURE__*/ $constructor("$ZodTransform", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.optin = "optional";
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
				const _out = def.transform(payload.value, payload);
				if (ctx.async) return (_out instanceof Promise ? _out : Promise.resolve(_out)).then((output) => {
					payload.value = output;
					payload.fallback = true;
					return payload;
				});
				if (_out instanceof Promise) throw new $ZodAsyncError();
				payload.value = _out;
				payload.fallback = true;
				return payload;
			};
		});
		function handleOptionalResult(result, input) {
			if (input === void 0 && (result.issues.length || result.fallback)) return {
				issues: [],
				value: void 0
			};
			return result;
		}
		const $ZodOptional = /*@__PURE__*/ $constructor("$ZodOptional", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.optin = "optional";
			inst._zod.optout = "optional";
			defineLazy(inst._zod, "values", () => {
				return def.innerType._zod.values ? /* @__PURE__ */ new Set([...def.innerType._zod.values, void 0]) : void 0;
			});
			defineLazy(inst._zod, "pattern", () => {
				const pattern = def.innerType._zod.pattern;
				return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : void 0;
			});
			inst._zod.parse = (payload, ctx) => {
				if (def.innerType._zod.optin === "optional") {
					const input = payload.value;
					const result = def.innerType._zod.run(payload, ctx);
					if (result instanceof Promise) return result.then((r) => handleOptionalResult(r, input));
					return handleOptionalResult(result, input);
				}
				if (payload.value === void 0) return payload;
				return def.innerType._zod.run(payload, ctx);
			};
		});
		const $ZodExactOptional = /*@__PURE__*/ $constructor("$ZodExactOptional", (inst, def) => {
			$ZodOptional.init(inst, def);
			defineLazy(inst._zod, "values", () => def.innerType._zod.values);
			defineLazy(inst._zod, "pattern", () => def.innerType._zod.pattern);
			inst._zod.parse = (payload, ctx) => {
				return def.innerType._zod.run(payload, ctx);
			};
		});
		const $ZodNullable = /*@__PURE__*/ $constructor("$ZodNullable", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
			defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
			defineLazy(inst._zod, "pattern", () => {
				const pattern = def.innerType._zod.pattern;
				return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : void 0;
			});
			defineLazy(inst._zod, "values", () => {
				return def.innerType._zod.values ? /* @__PURE__ */ new Set([...def.innerType._zod.values, null]) : void 0;
			});
			inst._zod.parse = (payload, ctx) => {
				if (payload.value === null) return payload;
				return def.innerType._zod.run(payload, ctx);
			};
		});
		const $ZodDefault = /*@__PURE__*/ $constructor("$ZodDefault", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.optin = "optional";
			defineLazy(inst._zod, "values", () => def.innerType._zod.values);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
				if (payload.value === void 0) {
					payload.value = def.defaultValue;
					/**
					* $ZodDefault returns the default value immediately in forward direction.
					* It doesn't pass the default value into the validator ("prefault"). There's no reason to pass the default value through validation. The validity of the default is enforced by TypeScript statically. Otherwise, it's the responsibility of the user to ensure the default is valid. In the case of pipes with divergent in/out types, you can specify the default on the `in` schema of your ZodPipe to set a "prefault" for the pipe.   */
					return payload;
				}
				const result = def.innerType._zod.run(payload, ctx);
				if (result instanceof Promise) return result.then((result) => handleDefaultResult(result, def));
				return handleDefaultResult(result, def);
			};
		});
		function handleDefaultResult(payload, def) {
			if (payload.value === void 0) payload.value = def.defaultValue;
			return payload;
		}
		const $ZodPrefault = /*@__PURE__*/ $constructor("$ZodPrefault", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.optin = "optional";
			defineLazy(inst._zod, "values", () => def.innerType._zod.values);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
				if (payload.value === void 0) payload.value = def.defaultValue;
				return def.innerType._zod.run(payload, ctx);
			};
		});
		const $ZodNonOptional = /*@__PURE__*/ $constructor("$ZodNonOptional", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazy(inst._zod, "values", () => {
				const v = def.innerType._zod.values;
				return v ? new Set([...v].filter((x) => x !== void 0)) : void 0;
			});
			inst._zod.parse = (payload, ctx) => {
				const result = def.innerType._zod.run(payload, ctx);
				if (result instanceof Promise) return result.then((result) => handleNonOptionalResult(result, inst));
				return handleNonOptionalResult(result, inst);
			};
		});
		function handleNonOptionalResult(payload, inst) {
			if (!payload.issues.length && payload.value === void 0) payload.issues.push({
				code: "invalid_type",
				expected: "nonoptional",
				input: payload.value,
				inst
			});
			return payload;
		}
		const $ZodCatch = /*@__PURE__*/ $constructor("$ZodCatch", (inst, def) => {
			$ZodType.init(inst, def);
			inst._zod.optin = "optional";
			defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
			defineLazy(inst._zod, "values", () => def.innerType._zod.values);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
				const result = def.innerType._zod.run(payload, ctx);
				if (result instanceof Promise) return result.then((result) => {
					payload.value = result.value;
					if (result.issues.length) {
						payload.value = def.catchValue({
							...payload,
							error: { issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())) },
							input: payload.value
						});
						payload.issues = [];
						payload.fallback = true;
					}
					return payload;
				});
				payload.value = result.value;
				if (result.issues.length) {
					payload.value = def.catchValue({
						...payload,
						error: { issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())) },
						input: payload.value
					});
					payload.issues = [];
					payload.fallback = true;
				}
				return payload;
			};
		});
		const $ZodPipe = /*@__PURE__*/ $constructor("$ZodPipe", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazy(inst._zod, "values", () => def.in._zod.values);
			defineLazy(inst._zod, "optin", () => def.in._zod.optin);
			defineLazy(inst._zod, "optout", () => def.out._zod.optout);
			defineLazy(inst._zod, "propValues", () => def.in._zod.propValues);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") {
					const right = def.out._zod.run(payload, ctx);
					if (right instanceof Promise) return right.then((right) => handlePipeResult(right, def.in, ctx));
					return handlePipeResult(right, def.in, ctx);
				}
				const left = def.in._zod.run(payload, ctx);
				if (left instanceof Promise) return left.then((left) => handlePipeResult(left, def.out, ctx));
				return handlePipeResult(left, def.out, ctx);
			};
		});
		function handlePipeResult(left, next, ctx) {
			if (left.issues.length) {
				left.aborted = true;
				return left;
			}
			return next._zod.run({
				value: left.value,
				issues: left.issues,
				fallback: left.fallback
			}, ctx);
		}
		const $ZodReadonly = /*@__PURE__*/ $constructor("$ZodReadonly", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazy(inst._zod, "propValues", () => def.innerType._zod.propValues);
			defineLazy(inst._zod, "values", () => def.innerType._zod.values);
			defineLazy(inst._zod, "optin", () => def.innerType?._zod?.optin);
			defineLazy(inst._zod, "optout", () => def.innerType?._zod?.optout);
			inst._zod.parse = (payload, ctx) => {
				if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
				const result = def.innerType._zod.run(payload, ctx);
				if (result instanceof Promise) return result.then(handleReadonlyResult);
				return handleReadonlyResult(result);
			};
		});
		function handleReadonlyResult(payload) {
			payload.value = Object.freeze(payload.value);
			return payload;
		}
		const $ZodLazy = /*@__PURE__*/ $constructor("$ZodLazy", (inst, def) => {
			$ZodType.init(inst, def);
			defineLazy(inst._zod, "innerType", () => {
				const d = def;
				if (!d._cachedInner) d._cachedInner = def.getter();
				return d._cachedInner;
			});
			defineLazy(inst._zod, "pattern", () => inst._zod.innerType?._zod?.pattern);
			defineLazy(inst._zod, "propValues", () => inst._zod.innerType?._zod?.propValues);
			defineLazy(inst._zod, "optin", () => inst._zod.innerType?._zod?.optin ?? void 0);
			defineLazy(inst._zod, "optout", () => inst._zod.innerType?._zod?.optout ?? void 0);
			inst._zod.parse = (payload, ctx) => {
				return inst._zod.innerType._zod.run(payload, ctx);
			};
		});
		const $ZodCustom = /*@__PURE__*/ $constructor("$ZodCustom", (inst, def) => {
			$ZodCheck.init(inst, def);
			$ZodType.init(inst, def);
			inst._zod.parse = (payload, _) => {
				return payload;
			};
			inst._zod.check = (payload) => {
				const input = payload.value;
				const r = def.fn(input);
				if (r instanceof Promise) return r.then((r) => handleRefineResult(r, payload, input, inst));
				handleRefineResult(r, payload, input, inst);
			};
		});
		function handleRefineResult(result, payload, input, inst) {
			if (!result) {
				const _iss = {
					code: "custom",
					input,
					inst,
					path: [...inst._zod.def.path ?? []],
					continue: !inst._zod.def.abort
				};
				if (inst._zod.def.params) _iss.params = inst._zod.def.params;
				payload.issues.push(issue(_iss));
			}
		}
		var _a;
		var $ZodRegistry = class {
			constructor() {
				this._map = /* @__PURE__ */ new WeakMap();
				this._idmap = /* @__PURE__ */ new Map();
			}
			add(schema, ..._meta) {
				const meta = _meta[0];
				this._map.set(schema, meta);
				if (meta && typeof meta === "object" && "id" in meta) this._idmap.set(meta.id, schema);
				return this;
			}
			clear() {
				this._map = /* @__PURE__ */ new WeakMap();
				this._idmap = /* @__PURE__ */ new Map();
				return this;
			}
			remove(schema) {
				const meta = this._map.get(schema);
				if (meta && typeof meta === "object" && "id" in meta) this._idmap.delete(meta.id);
				this._map.delete(schema);
				return this;
			}
			get(schema) {
				const p = schema._zod.parent;
				if (p) {
					const pm = { ...this.get(p) ?? {} };
					delete pm.id;
					const f = {
						...pm,
						...this._map.get(schema)
					};
					return Object.keys(f).length ? f : void 0;
				}
				return this._map.get(schema);
			}
			has(schema) {
				return this._map.has(schema);
			}
		};
		function registry() {
			return new $ZodRegistry();
		}
		(_a = globalThis).__zod_globalRegistry ?? (_a.__zod_globalRegistry = registry());
		const globalRegistry = globalThis.__zod_globalRegistry;
		// @__NO_SIDE_EFFECTS__
		function _string(Class, params) {
			return new Class({
				type: "string",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _email(Class, params) {
			return new Class({
				type: "string",
				format: "email",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _guid(Class, params) {
			return new Class({
				type: "string",
				format: "guid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uuid(Class, params) {
			return new Class({
				type: "string",
				format: "uuid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uuidv4(Class, params) {
			return new Class({
				type: "string",
				format: "uuid",
				check: "string_format",
				abort: false,
				version: "v4",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uuidv6(Class, params) {
			return new Class({
				type: "string",
				format: "uuid",
				check: "string_format",
				abort: false,
				version: "v6",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uuidv7(Class, params) {
			return new Class({
				type: "string",
				format: "uuid",
				check: "string_format",
				abort: false,
				version: "v7",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _url(Class, params) {
			return new Class({
				type: "string",
				format: "url",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _emoji(Class, params) {
			return new Class({
				type: "string",
				format: "emoji",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _nanoid(Class, params) {
			return new Class({
				type: "string",
				format: "nanoid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		/**
		* @deprecated CUID v1 is deprecated by its authors due to information leakage
		* (timestamps embedded in the id). Use {@link _cuid2} instead.
		* See https://github.com/paralleldrive/cuid.
		*/
		// @__NO_SIDE_EFFECTS__
		function _cuid(Class, params) {
			return new Class({
				type: "string",
				format: "cuid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _cuid2(Class, params) {
			return new Class({
				type: "string",
				format: "cuid2",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _ulid(Class, params) {
			return new Class({
				type: "string",
				format: "ulid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _xid(Class, params) {
			return new Class({
				type: "string",
				format: "xid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _ksuid(Class, params) {
			return new Class({
				type: "string",
				format: "ksuid",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _ipv4(Class, params) {
			return new Class({
				type: "string",
				format: "ipv4",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _ipv6(Class, params) {
			return new Class({
				type: "string",
				format: "ipv6",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _cidrv4(Class, params) {
			return new Class({
				type: "string",
				format: "cidrv4",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _cidrv6(Class, params) {
			return new Class({
				type: "string",
				format: "cidrv6",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _base64(Class, params) {
			return new Class({
				type: "string",
				format: "base64",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _base64url(Class, params) {
			return new Class({
				type: "string",
				format: "base64url",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _e164(Class, params) {
			return new Class({
				type: "string",
				format: "e164",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _jwt(Class, params) {
			return new Class({
				type: "string",
				format: "jwt",
				check: "string_format",
				abort: false,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _isoDateTime(Class, params) {
			return new Class({
				type: "string",
				format: "datetime",
				check: "string_format",
				offset: false,
				local: false,
				precision: null,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _isoDate(Class, params) {
			return new Class({
				type: "string",
				format: "date",
				check: "string_format",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _isoTime(Class, params) {
			return new Class({
				type: "string",
				format: "time",
				check: "string_format",
				precision: null,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _isoDuration(Class, params) {
			return new Class({
				type: "string",
				format: "duration",
				check: "string_format",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _number(Class, params) {
			return new Class({
				type: "number",
				checks: [],
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _int(Class, params) {
			return new Class({
				type: "number",
				check: "number_format",
				abort: false,
				format: "safeint",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _boolean(Class, params) {
			return new Class({
				type: "boolean",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _unknown(Class) {
			return new Class({ type: "unknown" });
		}
		// @__NO_SIDE_EFFECTS__
		function _never(Class, params) {
			return new Class({
				type: "never",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _lt(value, params) {
			return new $ZodCheckLessThan({
				check: "less_than",
				...normalizeParams(params),
				value,
				inclusive: false
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _lte(value, params) {
			return new $ZodCheckLessThan({
				check: "less_than",
				...normalizeParams(params),
				value,
				inclusive: true
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _gt(value, params) {
			return new $ZodCheckGreaterThan({
				check: "greater_than",
				...normalizeParams(params),
				value,
				inclusive: false
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _gte(value, params) {
			return new $ZodCheckGreaterThan({
				check: "greater_than",
				...normalizeParams(params),
				value,
				inclusive: true
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _multipleOf(value, params) {
			return new $ZodCheckMultipleOf({
				check: "multiple_of",
				...normalizeParams(params),
				value
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _maxLength(maximum, params) {
			return new $ZodCheckMaxLength({
				check: "max_length",
				...normalizeParams(params),
				maximum
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _minLength(minimum, params) {
			return new $ZodCheckMinLength({
				check: "min_length",
				...normalizeParams(params),
				minimum
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _length(length, params) {
			return new $ZodCheckLengthEquals({
				check: "length_equals",
				...normalizeParams(params),
				length
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _regex(pattern, params) {
			return new $ZodCheckRegex({
				check: "string_format",
				format: "regex",
				...normalizeParams(params),
				pattern
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _lowercase(params) {
			return new $ZodCheckLowerCase({
				check: "string_format",
				format: "lowercase",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _uppercase(params) {
			return new $ZodCheckUpperCase({
				check: "string_format",
				format: "uppercase",
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _includes(includes, params) {
			return new $ZodCheckIncludes({
				check: "string_format",
				format: "includes",
				...normalizeParams(params),
				includes
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _startsWith(prefix, params) {
			return new $ZodCheckStartsWith({
				check: "string_format",
				format: "starts_with",
				...normalizeParams(params),
				prefix
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _endsWith(suffix, params) {
			return new $ZodCheckEndsWith({
				check: "string_format",
				format: "ends_with",
				...normalizeParams(params),
				suffix
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _overwrite(tx) {
			return new $ZodCheckOverwrite({
				check: "overwrite",
				tx
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _normalize(form) {
			return /* @__PURE__ */ _overwrite((input) => input.normalize(form));
		}
		// @__NO_SIDE_EFFECTS__
		function _trim() {
			return /* @__PURE__ */ _overwrite((input) => input.trim());
		}
		// @__NO_SIDE_EFFECTS__
		function _toLowerCase() {
			return /* @__PURE__ */ _overwrite((input) => input.toLowerCase());
		}
		// @__NO_SIDE_EFFECTS__
		function _toUpperCase() {
			return /* @__PURE__ */ _overwrite((input) => input.toUpperCase());
		}
		// @__NO_SIDE_EFFECTS__
		function _slugify() {
			return /* @__PURE__ */ _overwrite((input) => slugify(input));
		}
		// @__NO_SIDE_EFFECTS__
		function _array(Class, element, params) {
			return new Class({
				type: "array",
				element,
				...normalizeParams(params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _refine(Class, fn, _params) {
			return new Class({
				type: "custom",
				check: "custom",
				fn,
				...normalizeParams(_params)
			});
		}
		// @__NO_SIDE_EFFECTS__
		function _superRefine(fn, params) {
			const ch = /* @__PURE__ */ _check((payload) => {
				payload.addIssue = (issue$2) => {
					if (typeof issue$2 === "string") payload.issues.push(issue(issue$2, payload.value, ch._zod.def));
					else {
						const _issue = issue$2;
						if (_issue.fatal) _issue.continue = false;
						_issue.code ?? (_issue.code = "custom");
						_issue.input ?? (_issue.input = payload.value);
						_issue.inst ?? (_issue.inst = ch);
						_issue.continue ?? (_issue.continue = !ch._zod.def.abort);
						payload.issues.push(issue(_issue));
					}
				};
				return fn(payload.value, payload);
			}, params);
			return ch;
		}
		// @__NO_SIDE_EFFECTS__
		function _check(fn, params) {
			const ch = new $ZodCheck({
				check: "custom",
				...normalizeParams(params)
			});
			ch._zod.check = fn;
			return ch;
		}
		function initializeContext(params) {
			let target = params?.target ?? "draft-2020-12";
			if (target === "draft-4") target = "draft-04";
			if (target === "draft-7") target = "draft-07";
			return {
				processors: params.processors ?? {},
				metadataRegistry: params?.metadata ?? globalRegistry,
				target,
				unrepresentable: params?.unrepresentable ?? "throw",
				override: params?.override ?? (() => {}),
				io: params?.io ?? "output",
				counter: 0,
				seen: /* @__PURE__ */ new Map(),
				cycles: params?.cycles ?? "ref",
				reused: params?.reused ?? "inline",
				external: params?.external ?? void 0
			};
		}
		function process(schema, ctx, _params = {
			path: [],
			schemaPath: []
		}) {
			var _a;
			const def = schema._zod.def;
			const seen = ctx.seen.get(schema);
			if (seen) {
				seen.count++;
				if (_params.schemaPath.includes(schema)) seen.cycle = _params.path;
				return seen.schema;
			}
			const result = {
				schema: {},
				count: 1,
				cycle: void 0,
				path: _params.path
			};
			ctx.seen.set(schema, result);
			const overrideSchema = schema._zod.toJSONSchema?.();
			if (overrideSchema) result.schema = overrideSchema;
			else {
				const params = {
					..._params,
					schemaPath: [..._params.schemaPath, schema],
					path: _params.path
				};
				if (schema._zod.processJSONSchema) schema._zod.processJSONSchema(ctx, result.schema, params);
				else {
					const _json = result.schema;
					const processor = ctx.processors[def.type];
					if (!processor) throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
					processor(schema, ctx, _json, params);
				}
				const parent = schema._zod.parent;
				if (parent) {
					if (!result.ref) result.ref = parent;
					process(parent, ctx, params);
					ctx.seen.get(parent).isParent = true;
				}
			}
			const meta = ctx.metadataRegistry.get(schema);
			if (meta) Object.assign(result.schema, meta);
			if (ctx.io === "input" && isTransforming(schema)) {
				delete result.schema.examples;
				delete result.schema.default;
			}
			if (ctx.io === "input" && "_prefault" in result.schema) (_a = result.schema).default ?? (_a.default = result.schema._prefault);
			delete result.schema._prefault;
			return ctx.seen.get(schema).schema;
		}
		function extractDefs(ctx, schema) {
			const root = ctx.seen.get(schema);
			if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
			const idToSchema = /* @__PURE__ */ new Map();
			for (const entry of ctx.seen.entries()) {
				const id = ctx.metadataRegistry.get(entry[0])?.id;
				if (id) {
					const existing = idToSchema.get(id);
					if (existing && existing !== entry[0]) throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
					idToSchema.set(id, entry[0]);
				}
			}
			const makeURI = (entry) => {
				const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
				if (ctx.external) {
					const externalId = ctx.external.registry.get(entry[0])?.id;
					const uriGenerator = ctx.external.uri ?? ((id) => id);
					if (externalId) return { ref: uriGenerator(externalId) };
					const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
					entry[1].defId = id;
					return {
						defId: id,
						ref: `${uriGenerator("__shared")}#/${defsSegment}/${id}`
					};
				}
				if (entry[1] === root) return { ref: "#" };
				const defUriPrefix = `#/${defsSegment}/`;
				const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
				return {
					defId,
					ref: defUriPrefix + defId
				};
			};
			const extractToDef = (entry) => {
				if (entry[1].schema.$ref) return;
				const seen = entry[1];
				const { ref, defId } = makeURI(entry);
				seen.def = { ...seen.schema };
				if (defId) seen.defId = defId;
				const schema = seen.schema;
				for (const key in schema) delete schema[key];
				schema.$ref = ref;
			};
			if (ctx.cycles === "throw") for (const entry of ctx.seen.entries()) {
				const seen = entry[1];
				if (seen.cycle) throw new Error(`Cycle detected: #/${seen.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
			}
			for (const entry of ctx.seen.entries()) {
				const seen = entry[1];
				if (schema === entry[0]) {
					extractToDef(entry);
					continue;
				}
				if (ctx.external) {
					const ext = ctx.external.registry.get(entry[0])?.id;
					if (schema !== entry[0] && ext) {
						extractToDef(entry);
						continue;
					}
				}
				if (ctx.metadataRegistry.get(entry[0])?.id) {
					extractToDef(entry);
					continue;
				}
				if (seen.cycle) {
					extractToDef(entry);
					continue;
				}
				if (seen.count > 1) {
					if (ctx.reused === "ref") {
						extractToDef(entry);
						continue;
					}
				}
			}
		}
		function finalize(ctx, schema) {
			const root = ctx.seen.get(schema);
			if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
			const flattenRef = (zodSchema) => {
				const seen = ctx.seen.get(zodSchema);
				if (seen.ref === null) return;
				const schema = seen.def ?? seen.schema;
				const _cached = { ...schema };
				const ref = seen.ref;
				seen.ref = null;
				if (ref) {
					flattenRef(ref);
					const refSeen = ctx.seen.get(ref);
					const refSchema = refSeen.schema;
					if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
						schema.allOf = schema.allOf ?? [];
						schema.allOf.push(refSchema);
					} else Object.assign(schema, refSchema);
					Object.assign(schema, _cached);
					if (zodSchema._zod.parent === ref) for (const key in schema) {
						if (key === "$ref" || key === "allOf") continue;
						if (!(key in _cached)) delete schema[key];
					}
					if (refSchema.$ref && refSeen.def) for (const key in schema) {
						if (key === "$ref" || key === "allOf") continue;
						if (key in refSeen.def && JSON.stringify(schema[key]) === JSON.stringify(refSeen.def[key])) delete schema[key];
					}
				}
				const parent = zodSchema._zod.parent;
				if (parent && parent !== ref) {
					flattenRef(parent);
					const parentSeen = ctx.seen.get(parent);
					if (parentSeen?.schema.$ref) {
						schema.$ref = parentSeen.schema.$ref;
						if (parentSeen.def) for (const key in schema) {
							if (key === "$ref" || key === "allOf") continue;
							if (key in parentSeen.def && JSON.stringify(schema[key]) === JSON.stringify(parentSeen.def[key])) delete schema[key];
						}
					}
				}
				ctx.override({
					zodSchema,
					jsonSchema: schema,
					path: seen.path ?? []
				});
			};
			for (const entry of [...ctx.seen.entries()].reverse()) flattenRef(entry[0]);
			const result = {};
			if (ctx.target === "draft-2020-12") result.$schema = "https://json-schema.org/draft/2020-12/schema";
			else if (ctx.target === "draft-07") result.$schema = "http://json-schema.org/draft-07/schema#";
			else if (ctx.target === "draft-04") result.$schema = "http://json-schema.org/draft-04/schema#";
			else if (ctx.target === "openapi-3.0") {}
			if (ctx.external?.uri) {
				const id = ctx.external.registry.get(schema)?.id;
				if (!id) throw new Error("Schema is missing an `id` property");
				result.$id = ctx.external.uri(id);
			}
			Object.assign(result, root.def ?? root.schema);
			const rootMetaId = ctx.metadataRegistry.get(schema)?.id;
			if (rootMetaId !== void 0 && result.id === rootMetaId) delete result.id;
			const defs = ctx.external?.defs ?? {};
			for (const entry of ctx.seen.entries()) {
				const seen = entry[1];
				if (seen.def && seen.defId) {
					if (seen.def.id === seen.defId) delete seen.def.id;
					defs[seen.defId] = seen.def;
				}
			}
			if (ctx.external) {} else if (Object.keys(defs).length > 0) {
				if (ctx.target === "draft-2020-12") result.$defs = defs;
				else result.definitions = defs;
			}
			try {
				const finalized = JSON.parse(JSON.stringify(result));
				Object.defineProperty(finalized, "~standard", {
					value: {
						...schema["~standard"],
						jsonSchema: {
							input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
							output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
						}
					},
					enumerable: false,
					writable: false
				});
				return finalized;
			} catch (_err) {
				throw new Error("Error converting schema to JSON.");
			}
		}
		function isTransforming(_schema, _ctx) {
			const ctx = _ctx ?? { seen: /* @__PURE__ */ new Set() };
			if (ctx.seen.has(_schema)) return false;
			ctx.seen.add(_schema);
			const def = _schema._zod.def;
			if (def.type === "transform") return true;
			if (def.type === "array") return isTransforming(def.element, ctx);
			if (def.type === "set") return isTransforming(def.valueType, ctx);
			if (def.type === "lazy") return isTransforming(def.getter(), ctx);
			if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault") return isTransforming(def.innerType, ctx);
			if (def.type === "intersection") return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
			if (def.type === "record" || def.type === "map") return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
			if (def.type === "pipe") {
				if (_schema._zod.traits.has("$ZodCodec")) return true;
				return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
			}
			if (def.type === "object") {
				for (const key in def.shape) if (isTransforming(def.shape[key], ctx)) return true;
				return false;
			}
			if (def.type === "union") {
				for (const option of def.options) if (isTransforming(option, ctx)) return true;
				return false;
			}
			if (def.type === "tuple") {
				for (const item of def.items) if (isTransforming(item, ctx)) return true;
				if (def.rest && isTransforming(def.rest, ctx)) return true;
				return false;
			}
			return false;
		}
		/**
		* Creates a toJSONSchema method for a schema instance.
		* This encapsulates the logic of initializing context, processing, extracting defs, and finalizing.
		*/
		const createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
			const ctx = initializeContext({
				...params,
				processors
			});
			process(schema, ctx);
			extractDefs(ctx, schema);
			return finalize(ctx, schema);
		};
		const createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
			const { libraryOptions, target } = params ?? {};
			const ctx = initializeContext({
				...libraryOptions ?? {},
				target,
				io,
				processors
			});
			process(schema, ctx);
			extractDefs(ctx, schema);
			return finalize(ctx, schema);
		};
		const formatMap = {
			guid: "uuid",
			url: "uri",
			datetime: "date-time",
			json_string: "json-string",
			regex: ""
		};
		const stringProcessor = (schema, ctx, _json, _params) => {
			const json = _json;
			json.type = "string";
			const { minimum, maximum, format, patterns, contentEncoding } = schema._zod.bag;
			if (typeof minimum === "number") json.minLength = minimum;
			if (typeof maximum === "number") json.maxLength = maximum;
			if (format) {
				json.format = formatMap[format] ?? format;
				if (json.format === "") delete json.format;
				if (format === "time") delete json.format;
			}
			if (contentEncoding) json.contentEncoding = contentEncoding;
			if (patterns && patterns.size > 0) {
				const regexes = [...patterns];
				if (regexes.length === 1) json.pattern = regexes[0].source;
				else if (regexes.length > 1) json.allOf = [...regexes.map((regex) => ({
					...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
					pattern: regex.source
				}))];
			}
		};
		const numberProcessor = (schema, ctx, _json, _params) => {
			const json = _json;
			const { minimum, maximum, format, multipleOf, exclusiveMaximum, exclusiveMinimum } = schema._zod.bag;
			if (typeof format === "string" && format.includes("int")) json.type = "integer";
			else json.type = "number";
			const exMin = typeof exclusiveMinimum === "number" && exclusiveMinimum >= (minimum ?? Number.NEGATIVE_INFINITY);
			const exMax = typeof exclusiveMaximum === "number" && exclusiveMaximum <= (maximum ?? Number.POSITIVE_INFINITY);
			const legacy = ctx.target === "draft-04" || ctx.target === "openapi-3.0";
			if (exMin) {
				if (legacy) {
					json.minimum = exclusiveMinimum;
					json.exclusiveMinimum = true;
				} else json.exclusiveMinimum = exclusiveMinimum;
			} else if (typeof minimum === "number") json.minimum = minimum;
			if (exMax) {
				if (legacy) {
					json.maximum = exclusiveMaximum;
					json.exclusiveMaximum = true;
				} else json.exclusiveMaximum = exclusiveMaximum;
			} else if (typeof maximum === "number") json.maximum = maximum;
			if (typeof multipleOf === "number") json.multipleOf = multipleOf;
		};
		const booleanProcessor = (_schema, _ctx, json, _params) => {
			json.type = "boolean";
		};
		const neverProcessor = (_schema, _ctx, json, _params) => {
			json.not = {};
		};
		const enumProcessor = (schema, _ctx, json, _params) => {
			const def = schema._zod.def;
			const values = getEnumValues(def.entries);
			if (values.every((v) => typeof v === "number")) json.type = "number";
			if (values.every((v) => typeof v === "string")) json.type = "string";
			json.enum = values;
		};
		const literalProcessor = (schema, ctx, json, _params) => {
			const def = schema._zod.def;
			const vals = [];
			for (const val of def.values) if (val === void 0) {
				if (ctx.unrepresentable === "throw") throw new Error("Literal `undefined` cannot be represented in JSON Schema");
			} else if (typeof val === "bigint") {
				if (ctx.unrepresentable === "throw") throw new Error("BigInt literals cannot be represented in JSON Schema");
				else vals.push(Number(val));
			} else vals.push(val);
			if (vals.length === 0) {} else if (vals.length === 1) {
				const val = vals[0];
				json.type = val === null ? "null" : typeof val;
				if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") json.enum = [val];
				else json.const = val;
			} else {
				if (vals.every((v) => typeof v === "number")) json.type = "number";
				if (vals.every((v) => typeof v === "string")) json.type = "string";
				if (vals.every((v) => typeof v === "boolean")) json.type = "boolean";
				if (vals.every((v) => v === null)) json.type = "null";
				json.enum = vals;
			}
		};
		const customProcessor = (_schema, ctx, _json, _params) => {
			if (ctx.unrepresentable === "throw") throw new Error("Custom types cannot be represented in JSON Schema");
		};
		const transformProcessor = (_schema, ctx, _json, _params) => {
			if (ctx.unrepresentable === "throw") throw new Error("Transforms cannot be represented in JSON Schema");
		};
		const arrayProcessor = (schema, ctx, _json, params) => {
			const json = _json;
			const def = schema._zod.def;
			const { minimum, maximum } = schema._zod.bag;
			if (typeof minimum === "number") json.minItems = minimum;
			if (typeof maximum === "number") json.maxItems = maximum;
			json.type = "array";
			json.items = process(def.element, ctx, {
				...params,
				path: [...params.path, "items"]
			});
		};
		const objectProcessor = (schema, ctx, _json, params) => {
			const json = _json;
			const def = schema._zod.def;
			json.type = "object";
			json.properties = {};
			const shape = def.shape;
			for (const key in shape) json.properties[key] = process(shape[key], ctx, {
				...params,
				path: [
					...params.path,
					"properties",
					key
				]
			});
			const allKeys = new Set(Object.keys(shape));
			const requiredKeys = new Set([...allKeys].filter((key) => {
				const v = def.shape[key]._zod;
				if (ctx.io === "input") return v.optin === void 0;
				else return v.optout === void 0;
			}));
			if (requiredKeys.size > 0) json.required = Array.from(requiredKeys);
			if (def.catchall?._zod.def.type === "never") json.additionalProperties = false;
			else if (!def.catchall) {
				if (ctx.io === "output") json.additionalProperties = false;
			} else if (def.catchall) json.additionalProperties = process(def.catchall, ctx, {
				...params,
				path: [...params.path, "additionalProperties"]
			});
		};
		const unionProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			const isExclusive = def.inclusive === false;
			const options = def.options.map((x, i) => process(x, ctx, {
				...params,
				path: [
					...params.path,
					isExclusive ? "oneOf" : "anyOf",
					i
				]
			}));
			if (isExclusive) json.oneOf = options;
			else json.anyOf = options;
		};
		const intersectionProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			const a = process(def.left, ctx, {
				...params,
				path: [
					...params.path,
					"allOf",
					0
				]
			});
			const b = process(def.right, ctx, {
				...params,
				path: [
					...params.path,
					"allOf",
					1
				]
			});
			const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
			json.allOf = [...isSimpleIntersection(a) ? a.allOf : [a], ...isSimpleIntersection(b) ? b.allOf : [b]];
		};
		const nullableProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			const inner = process(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			if (ctx.target === "openapi-3.0") {
				seen.ref = def.innerType;
				json.nullable = true;
			} else json.anyOf = [inner, { type: "null" }];
		};
		const nonoptionalProcessor = (schema, ctx, _json, params) => {
			const def = schema._zod.def;
			process(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
		};
		const defaultProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			process(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
			json.default = JSON.parse(JSON.stringify(def.defaultValue));
		};
		const prefaultProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			process(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
			if (ctx.io === "input") json._prefault = JSON.parse(JSON.stringify(def.defaultValue));
		};
		const catchProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			process(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
			let catchValue;
			try {
				catchValue = def.catchValue(void 0);
			} catch {
				throw new Error("Dynamic catch values are not supported in JSON Schema");
			}
			json.default = catchValue;
		};
		const pipeProcessor = (schema, ctx, _json, params) => {
			const def = schema._zod.def;
			const inIsTransform = def.in._zod.traits.has("$ZodTransform");
			const innerType = ctx.io === "input" ? inIsTransform ? def.out : def.in : def.out;
			process(innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = innerType;
		};
		const readonlyProcessor = (schema, ctx, json, params) => {
			const def = schema._zod.def;
			process(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
			json.readOnly = true;
		};
		const optionalProcessor = (schema, ctx, _json, params) => {
			const def = schema._zod.def;
			process(def.innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = def.innerType;
		};
		const lazyProcessor = (schema, ctx, _json, params) => {
			const innerType = schema._zod.innerType;
			process(innerType, ctx, params);
			const seen = ctx.seen.get(schema);
			seen.ref = innerType;
		};
		const ZodISODateTime = /*@__PURE__*/ $constructor("ZodISODateTime", (inst, def) => {
			$ZodISODateTime.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		function datetime(params) {
			return /* @__PURE__ */ _isoDateTime(ZodISODateTime, params);
		}
		const ZodISODate = /*@__PURE__*/ $constructor("ZodISODate", (inst, def) => {
			$ZodISODate.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		function date(params) {
			return /* @__PURE__ */ _isoDate(ZodISODate, params);
		}
		const ZodISOTime = /*@__PURE__*/ $constructor("ZodISOTime", (inst, def) => {
			$ZodISOTime.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		function time(params) {
			return /* @__PURE__ */ _isoTime(ZodISOTime, params);
		}
		const ZodISODuration = /*@__PURE__*/ $constructor("ZodISODuration", (inst, def) => {
			$ZodISODuration.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		function duration(params) {
			return /* @__PURE__ */ _isoDuration(ZodISODuration, params);
		}
		const initializer = (inst, issues) => {
			$ZodError.init(inst, issues);
			inst.name = "ZodError";
			Object.defineProperties(inst, {
				format: { value: (mapper) => formatError(inst, mapper) },
				flatten: { value: (mapper) => flattenError(inst, mapper) },
				addIssue: { value: (issue) => {
					inst.issues.push(issue);
					inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
				} },
				addIssues: { value: (issues) => {
					inst.issues.push(...issues);
					inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
				} },
				isEmpty: { get() {
					return inst.issues.length === 0;
				} }
			});
		};
		const ZodRealError = /*@__PURE__*/ $constructor("ZodError", initializer, { Parent: Error });
		const parse = /* @__PURE__ */ _parse(ZodRealError);
		const parseAsync = /* @__PURE__ */ _parseAsync(ZodRealError);
		const safeParse = /* @__PURE__ */ _safeParse(ZodRealError);
		const safeParseAsync = /* @__PURE__ */ _safeParseAsync(ZodRealError);
		const encode = /* @__PURE__ */ _encode(ZodRealError);
		const decode = /* @__PURE__ */ _decode(ZodRealError);
		const encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
		const decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
		const safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
		const safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
		const safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
		const safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);
		const _installedGroups = /* @__PURE__ */ new WeakMap();
		function _installLazyMethods(inst, group, methods) {
			const proto = Object.getPrototypeOf(inst);
			let installed = _installedGroups.get(proto);
			if (!installed) {
				installed = /* @__PURE__ */ new Set();
				_installedGroups.set(proto, installed);
			}
			if (installed.has(group)) return;
			installed.add(group);
			for (const key in methods) {
				const fn = methods[key];
				Object.defineProperty(proto, key, {
					configurable: true,
					enumerable: false,
					get() {
						const bound = fn.bind(this);
						Object.defineProperty(this, key, {
							configurable: true,
							writable: true,
							enumerable: true,
							value: bound
						});
						return bound;
					},
					set(v) {
						Object.defineProperty(this, key, {
							configurable: true,
							writable: true,
							enumerable: true,
							value: v
						});
					}
				});
			}
		}
		const ZodType = /*@__PURE__*/ $constructor("ZodType", (inst, def) => {
			$ZodType.init(inst, def);
			Object.assign(inst["~standard"], { jsonSchema: {
				input: createStandardJSONSchemaMethod(inst, "input"),
				output: createStandardJSONSchemaMethod(inst, "output")
			} });
			inst.toJSONSchema = createToJSONSchemaMethod(inst, {});
			inst.def = def;
			inst.type = def.type;
			Object.defineProperty(inst, "_def", { value: def });
			inst.parse = (data, params) => parse(inst, data, params, { callee: inst.parse });
			inst.safeParse = (data, params) => safeParse(inst, data, params);
			inst.parseAsync = async (data, params) => parseAsync(inst, data, params, { callee: inst.parseAsync });
			inst.safeParseAsync = async (data, params) => safeParseAsync(inst, data, params);
			inst.spa = inst.safeParseAsync;
			inst.encode = (data, params) => encode(inst, data, params);
			inst.decode = (data, params) => decode(inst, data, params);
			inst.encodeAsync = async (data, params) => encodeAsync(inst, data, params);
			inst.decodeAsync = async (data, params) => decodeAsync(inst, data, params);
			inst.safeEncode = (data, params) => safeEncode(inst, data, params);
			inst.safeDecode = (data, params) => safeDecode(inst, data, params);
			inst.safeEncodeAsync = async (data, params) => safeEncodeAsync(inst, data, params);
			inst.safeDecodeAsync = async (data, params) => safeDecodeAsync(inst, data, params);
			_installLazyMethods(inst, "ZodType", {
				check(...chks) {
					const def = this.def;
					return this.clone(mergeDefs(def, { checks: [...def.checks ?? [], ...chks.map((ch) => typeof ch === "function" ? { _zod: {
						check: ch,
						def: { check: "custom" },
						onattach: []
					} } : ch)] }), { parent: true });
				},
				with(...chks) {
					return this.check(...chks);
				},
				clone(def, params) {
					return clone(this, def, params);
				},
				brand() {
					return this;
				},
				register(reg, meta) {
					reg.add(this, meta);
					return this;
				},
				refine(check, params) {
					return this.check(refine(check, params));
				},
				superRefine(refinement, params) {
					return this.check(superRefine(refinement, params));
				},
				overwrite(fn) {
					return this.check(/* @__PURE__ */ _overwrite(fn));
				},
				optional() {
					return optional(this);
				},
				exactOptional() {
					return exactOptional(this);
				},
				nullable() {
					return nullable(this);
				},
				nullish() {
					return optional(nullable(this));
				},
				nonoptional(params) {
					return nonoptional(this, params);
				},
				array() {
					return array(this);
				},
				or(arg) {
					return union([this, arg]);
				},
				and(arg) {
					return intersection(this, arg);
				},
				transform(tx) {
					return pipe(this, transform(tx));
				},
				default(d) {
					return _default(this, d);
				},
				prefault(d) {
					return prefault(this, d);
				},
				catch(params) {
					return _catch(this, params);
				},
				pipe(target) {
					return pipe(this, target);
				},
				readonly() {
					return readonly(this);
				},
				describe(description) {
					const cl = this.clone();
					globalRegistry.add(cl, { description });
					return cl;
				},
				meta(...args) {
					if (args.length === 0) return globalRegistry.get(this);
					const cl = this.clone();
					globalRegistry.add(cl, args[0]);
					return cl;
				},
				isOptional() {
					return this.safeParse(void 0).success;
				},
				isNullable() {
					return this.safeParse(null).success;
				},
				apply(fn) {
					return fn(this);
				}
			});
			Object.defineProperty(inst, "description", {
				get() {
					return globalRegistry.get(inst)?.description;
				},
				configurable: true
			});
			return inst;
		});
		/** @internal */
		const _ZodString = /*@__PURE__*/ $constructor("_ZodString", (inst, def) => {
			$ZodString.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json, params);
			const bag = inst._zod.bag;
			inst.format = bag.format ?? null;
			inst.minLength = bag.minimum ?? null;
			inst.maxLength = bag.maximum ?? null;
			_installLazyMethods(inst, "_ZodString", {
				regex(...args) {
					return this.check(/* @__PURE__ */ _regex(...args));
				},
				includes(...args) {
					return this.check(/* @__PURE__ */ _includes(...args));
				},
				startsWith(...args) {
					return this.check(/* @__PURE__ */ _startsWith(...args));
				},
				endsWith(...args) {
					return this.check(/* @__PURE__ */ _endsWith(...args));
				},
				min(...args) {
					return this.check(/* @__PURE__ */ _minLength(...args));
				},
				max(...args) {
					return this.check(/* @__PURE__ */ _maxLength(...args));
				},
				length(...args) {
					return this.check(/* @__PURE__ */ _length(...args));
				},
				nonempty(...args) {
					return this.check(/* @__PURE__ */ _minLength(1, ...args));
				},
				lowercase(params) {
					return this.check(/* @__PURE__ */ _lowercase(params));
				},
				uppercase(params) {
					return this.check(/* @__PURE__ */ _uppercase(params));
				},
				trim() {
					return this.check(/* @__PURE__ */ _trim());
				},
				normalize(...args) {
					return this.check(/* @__PURE__ */ _normalize(...args));
				},
				toLowerCase() {
					return this.check(/* @__PURE__ */ _toLowerCase());
				},
				toUpperCase() {
					return this.check(/* @__PURE__ */ _toUpperCase());
				},
				slugify() {
					return this.check(/* @__PURE__ */ _slugify());
				}
			});
		});
		const ZodString = /*@__PURE__*/ $constructor("ZodString", (inst, def) => {
			$ZodString.init(inst, def);
			_ZodString.init(inst, def);
			inst.email = (params) => inst.check(/* @__PURE__ */ _email(ZodEmail, params));
			inst.url = (params) => inst.check(/* @__PURE__ */ _url(ZodURL, params));
			inst.jwt = (params) => inst.check(/* @__PURE__ */ _jwt(ZodJWT, params));
			inst.emoji = (params) => inst.check(/* @__PURE__ */ _emoji(ZodEmoji, params));
			inst.guid = (params) => inst.check(/* @__PURE__ */ _guid(ZodGUID, params));
			inst.uuid = (params) => inst.check(/* @__PURE__ */ _uuid(ZodUUID, params));
			inst.uuidv4 = (params) => inst.check(/* @__PURE__ */ _uuidv4(ZodUUID, params));
			inst.uuidv6 = (params) => inst.check(/* @__PURE__ */ _uuidv6(ZodUUID, params));
			inst.uuidv7 = (params) => inst.check(/* @__PURE__ */ _uuidv7(ZodUUID, params));
			inst.nanoid = (params) => inst.check(/* @__PURE__ */ _nanoid(ZodNanoID, params));
			inst.guid = (params) => inst.check(/* @__PURE__ */ _guid(ZodGUID, params));
			inst.cuid = (params) => inst.check(/* @__PURE__ */ _cuid(ZodCUID, params));
			inst.cuid2 = (params) => inst.check(/* @__PURE__ */ _cuid2(ZodCUID2, params));
			inst.ulid = (params) => inst.check(/* @__PURE__ */ _ulid(ZodULID, params));
			inst.base64 = (params) => inst.check(/* @__PURE__ */ _base64(ZodBase64, params));
			inst.base64url = (params) => inst.check(/* @__PURE__ */ _base64url(ZodBase64URL, params));
			inst.xid = (params) => inst.check(/* @__PURE__ */ _xid(ZodXID, params));
			inst.ksuid = (params) => inst.check(/* @__PURE__ */ _ksuid(ZodKSUID, params));
			inst.ipv4 = (params) => inst.check(/* @__PURE__ */ _ipv4(ZodIPv4, params));
			inst.ipv6 = (params) => inst.check(/* @__PURE__ */ _ipv6(ZodIPv6, params));
			inst.cidrv4 = (params) => inst.check(/* @__PURE__ */ _cidrv4(ZodCIDRv4, params));
			inst.cidrv6 = (params) => inst.check(/* @__PURE__ */ _cidrv6(ZodCIDRv6, params));
			inst.e164 = (params) => inst.check(/* @__PURE__ */ _e164(ZodE164, params));
			inst.datetime = (params) => inst.check(datetime(params));
			inst.date = (params) => inst.check(date(params));
			inst.time = (params) => inst.check(time(params));
			inst.duration = (params) => inst.check(duration(params));
		});
		function string(params) {
			return /* @__PURE__ */ _string(ZodString, params);
		}
		const ZodStringFormat = /*@__PURE__*/ $constructor("ZodStringFormat", (inst, def) => {
			$ZodStringFormat.init(inst, def);
			_ZodString.init(inst, def);
		});
		const ZodEmail = /*@__PURE__*/ $constructor("ZodEmail", (inst, def) => {
			$ZodEmail.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodGUID = /*@__PURE__*/ $constructor("ZodGUID", (inst, def) => {
			$ZodGUID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodUUID = /*@__PURE__*/ $constructor("ZodUUID", (inst, def) => {
			$ZodUUID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodURL = /*@__PURE__*/ $constructor("ZodURL", (inst, def) => {
			$ZodURL.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodEmoji = /*@__PURE__*/ $constructor("ZodEmoji", (inst, def) => {
			$ZodEmoji.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodNanoID = /*@__PURE__*/ $constructor("ZodNanoID", (inst, def) => {
			$ZodNanoID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		/**
		* @deprecated CUID v1 is deprecated by its authors due to information leakage
		* (timestamps embedded in the id). Use {@link ZodCUID2} instead.
		* See https://github.com/paralleldrive/cuid.
		*/
		const ZodCUID = /*@__PURE__*/ $constructor("ZodCUID", (inst, def) => {
			$ZodCUID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodCUID2 = /*@__PURE__*/ $constructor("ZodCUID2", (inst, def) => {
			$ZodCUID2.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodULID = /*@__PURE__*/ $constructor("ZodULID", (inst, def) => {
			$ZodULID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodXID = /*@__PURE__*/ $constructor("ZodXID", (inst, def) => {
			$ZodXID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodKSUID = /*@__PURE__*/ $constructor("ZodKSUID", (inst, def) => {
			$ZodKSUID.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodIPv4 = /*@__PURE__*/ $constructor("ZodIPv4", (inst, def) => {
			$ZodIPv4.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodIPv6 = /*@__PURE__*/ $constructor("ZodIPv6", (inst, def) => {
			$ZodIPv6.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodCIDRv4 = /*@__PURE__*/ $constructor("ZodCIDRv4", (inst, def) => {
			$ZodCIDRv4.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodCIDRv6 = /*@__PURE__*/ $constructor("ZodCIDRv6", (inst, def) => {
			$ZodCIDRv6.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodBase64 = /*@__PURE__*/ $constructor("ZodBase64", (inst, def) => {
			$ZodBase64.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodBase64URL = /*@__PURE__*/ $constructor("ZodBase64URL", (inst, def) => {
			$ZodBase64URL.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodE164 = /*@__PURE__*/ $constructor("ZodE164", (inst, def) => {
			$ZodE164.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodJWT = /*@__PURE__*/ $constructor("ZodJWT", (inst, def) => {
			$ZodJWT.init(inst, def);
			ZodStringFormat.init(inst, def);
		});
		const ZodNumber = /*@__PURE__*/ $constructor("ZodNumber", (inst, def) => {
			$ZodNumber.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => numberProcessor(inst, ctx, json, params);
			_installLazyMethods(inst, "ZodNumber", {
				gt(value, params) {
					return this.check(/* @__PURE__ */ _gt(value, params));
				},
				gte(value, params) {
					return this.check(/* @__PURE__ */ _gte(value, params));
				},
				min(value, params) {
					return this.check(/* @__PURE__ */ _gte(value, params));
				},
				lt(value, params) {
					return this.check(/* @__PURE__ */ _lt(value, params));
				},
				lte(value, params) {
					return this.check(/* @__PURE__ */ _lte(value, params));
				},
				max(value, params) {
					return this.check(/* @__PURE__ */ _lte(value, params));
				},
				int(params) {
					return this.check(int(params));
				},
				safe(params) {
					return this.check(int(params));
				},
				positive(params) {
					return this.check(/* @__PURE__ */ _gt(0, params));
				},
				nonnegative(params) {
					return this.check(/* @__PURE__ */ _gte(0, params));
				},
				negative(params) {
					return this.check(/* @__PURE__ */ _lt(0, params));
				},
				nonpositive(params) {
					return this.check(/* @__PURE__ */ _lte(0, params));
				},
				multipleOf(value, params) {
					return this.check(/* @__PURE__ */ _multipleOf(value, params));
				},
				step(value, params) {
					return this.check(/* @__PURE__ */ _multipleOf(value, params));
				},
				finite() {
					return this;
				}
			});
			const bag = inst._zod.bag;
			inst.minValue = Math.max(bag.minimum ?? Number.NEGATIVE_INFINITY, bag.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null;
			inst.maxValue = Math.min(bag.maximum ?? Number.POSITIVE_INFINITY, bag.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null;
			inst.isInt = (bag.format ?? "").includes("int") || Number.isSafeInteger(bag.multipleOf ?? .5);
			inst.isFinite = true;
			inst.format = bag.format ?? null;
		});
		function number(params) {
			return /* @__PURE__ */ _number(ZodNumber, params);
		}
		const ZodNumberFormat = /*@__PURE__*/ $constructor("ZodNumberFormat", (inst, def) => {
			$ZodNumberFormat.init(inst, def);
			ZodNumber.init(inst, def);
		});
		function int(params) {
			return /* @__PURE__ */ _int(ZodNumberFormat, params);
		}
		const ZodBoolean = /*@__PURE__*/ $constructor("ZodBoolean", (inst, def) => {
			$ZodBoolean.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => booleanProcessor(inst, ctx, json, params);
		});
		function boolean(params) {
			return /* @__PURE__ */ _boolean(ZodBoolean, params);
		}
		const ZodUnknown = /*@__PURE__*/ $constructor("ZodUnknown", (inst, def) => {
			$ZodUnknown.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => void 0;
		});
		function unknown() {
			return /* @__PURE__ */ _unknown(ZodUnknown);
		}
		const ZodNever = /*@__PURE__*/ $constructor("ZodNever", (inst, def) => {
			$ZodNever.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json, params);
		});
		function never(params) {
			return /* @__PURE__ */ _never(ZodNever, params);
		}
		const ZodArray = /*@__PURE__*/ $constructor("ZodArray", (inst, def) => {
			$ZodArray.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
			inst.element = def.element;
			_installLazyMethods(inst, "ZodArray", {
				min(n, params) {
					return this.check(/* @__PURE__ */ _minLength(n, params));
				},
				nonempty(params) {
					return this.check(/* @__PURE__ */ _minLength(1, params));
				},
				max(n, params) {
					return this.check(/* @__PURE__ */ _maxLength(n, params));
				},
				length(n, params) {
					return this.check(/* @__PURE__ */ _length(n, params));
				},
				unwrap() {
					return this.element;
				}
			});
		});
		function array(element, params) {
			return /* @__PURE__ */ _array(ZodArray, element, params);
		}
		const ZodObject = /*@__PURE__*/ $constructor("ZodObject", (inst, def) => {
			$ZodObjectJIT.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
			defineLazy(inst, "shape", () => {
				return def.shape;
			});
			_installLazyMethods(inst, "ZodObject", {
				keyof() {
					return _enum(Object.keys(this._zod.def.shape));
				},
				catchall(catchall) {
					return this.clone({
						...this._zod.def,
						catchall
					});
				},
				passthrough() {
					return this.clone({
						...this._zod.def,
						catchall: unknown()
					});
				},
				loose() {
					return this.clone({
						...this._zod.def,
						catchall: unknown()
					});
				},
				strict() {
					return this.clone({
						...this._zod.def,
						catchall: never()
					});
				},
				strip() {
					return this.clone({
						...this._zod.def,
						catchall: void 0
					});
				},
				extend(incoming) {
					return extend(this, incoming);
				},
				safeExtend(incoming) {
					return safeExtend(this, incoming);
				},
				merge(other) {
					return merge(this, other);
				},
				pick(mask) {
					return pick(this, mask);
				},
				omit(mask) {
					return omit(this, mask);
				},
				partial(...args) {
					return partial(ZodOptional, this, args[0]);
				},
				required(...args) {
					return required(ZodNonOptional, this, args[0]);
				}
			});
		});
		function object(shape, params) {
			const def = {
				type: "object",
				shape: shape ?? {},
				...normalizeParams(params)
			};
			return new ZodObject(def);
		}
		const ZodUnion = /*@__PURE__*/ $constructor("ZodUnion", (inst, def) => {
			$ZodUnion.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
			inst.options = def.options;
		});
		function union(options, params) {
			return new ZodUnion({
				type: "union",
				options,
				...normalizeParams(params)
			});
		}
		const ZodIntersection = /*@__PURE__*/ $constructor("ZodIntersection", (inst, def) => {
			$ZodIntersection.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
		});
		function intersection(left, right) {
			return new ZodIntersection({
				type: "intersection",
				left,
				right
			});
		}
		const ZodEnum = /*@__PURE__*/ $constructor("ZodEnum", (inst, def) => {
			$ZodEnum.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json, params);
			inst.enum = def.entries;
			inst.options = Object.values(def.entries);
			const keys = new Set(Object.keys(def.entries));
			inst.extract = (values, params) => {
				const newEntries = {};
				for (const value of values) if (keys.has(value)) newEntries[value] = def.entries[value];
				else throw new Error(`Key ${value} not found in enum`);
				return new ZodEnum({
					...def,
					checks: [],
					...normalizeParams(params),
					entries: newEntries
				});
			};
			inst.exclude = (values, params) => {
				const newEntries = { ...def.entries };
				for (const value of values) if (keys.has(value)) delete newEntries[value];
				else throw new Error(`Key ${value} not found in enum`);
				return new ZodEnum({
					...def,
					checks: [],
					...normalizeParams(params),
					entries: newEntries
				});
			};
		});
		function _enum(values, params) {
			const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
			return new ZodEnum({
				type: "enum",
				entries,
				...normalizeParams(params)
			});
		}
		const ZodLiteral = /*@__PURE__*/ $constructor("ZodLiteral", (inst, def) => {
			$ZodLiteral.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => literalProcessor(inst, ctx, json, params);
			inst.values = new Set(def.values);
			Object.defineProperty(inst, "value", { get() {
				if (def.values.length > 1) throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
				return def.values[0];
			} });
		});
		function literal(value, params) {
			return new ZodLiteral({
				type: "literal",
				values: Array.isArray(value) ? value : [value],
				...normalizeParams(params)
			});
		}
		const ZodTransform = /*@__PURE__*/ $constructor("ZodTransform", (inst, def) => {
			$ZodTransform.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx, json, params);
			inst._zod.parse = (payload, _ctx) => {
				if (_ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
				payload.addIssue = (issue$1) => {
					if (typeof issue$1 === "string") payload.issues.push(issue(issue$1, payload.value, def));
					else {
						const _issue = issue$1;
						if (_issue.fatal) _issue.continue = false;
						_issue.code ?? (_issue.code = "custom");
						_issue.input ?? (_issue.input = payload.value);
						_issue.inst ?? (_issue.inst = inst);
						payload.issues.push(issue(_issue));
					}
				};
				const output = def.transform(payload.value, payload);
				if (output instanceof Promise) return output.then((output) => {
					payload.value = output;
					payload.fallback = true;
					return payload;
				});
				payload.value = output;
				payload.fallback = true;
				return payload;
			};
		});
		function transform(fn) {
			return new ZodTransform({
				type: "transform",
				transform: fn
			});
		}
		const ZodOptional = /*@__PURE__*/ $constructor("ZodOptional", (inst, def) => {
			$ZodOptional.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function optional(innerType) {
			return new ZodOptional({
				type: "optional",
				innerType
			});
		}
		const ZodExactOptional = /*@__PURE__*/ $constructor("ZodExactOptional", (inst, def) => {
			$ZodExactOptional.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function exactOptional(innerType) {
			return new ZodExactOptional({
				type: "optional",
				innerType
			});
		}
		const ZodNullable = /*@__PURE__*/ $constructor("ZodNullable", (inst, def) => {
			$ZodNullable.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function nullable(innerType) {
			return new ZodNullable({
				type: "nullable",
				innerType
			});
		}
		const ZodDefault = /*@__PURE__*/ $constructor("ZodDefault", (inst, def) => {
			$ZodDefault.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
			inst.removeDefault = inst.unwrap;
		});
		function _default(innerType, defaultValue) {
			return new ZodDefault({
				type: "default",
				innerType,
				get defaultValue() {
					return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
				}
			});
		}
		const ZodPrefault = /*@__PURE__*/ $constructor("ZodPrefault", (inst, def) => {
			$ZodPrefault.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function prefault(innerType, defaultValue) {
			return new ZodPrefault({
				type: "prefault",
				innerType,
				get defaultValue() {
					return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
				}
			});
		}
		const ZodNonOptional = /*@__PURE__*/ $constructor("ZodNonOptional", (inst, def) => {
			$ZodNonOptional.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function nonoptional(innerType, params) {
			return new ZodNonOptional({
				type: "nonoptional",
				innerType,
				...normalizeParams(params)
			});
		}
		const ZodCatch = /*@__PURE__*/ $constructor("ZodCatch", (inst, def) => {
			$ZodCatch.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
			inst.removeCatch = inst.unwrap;
		});
		function _catch(innerType, catchValue) {
			return new ZodCatch({
				type: "catch",
				innerType,
				catchValue: typeof catchValue === "function" ? catchValue : () => catchValue
			});
		}
		const ZodPipe = /*@__PURE__*/ $constructor("ZodPipe", (inst, def) => {
			$ZodPipe.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
			inst.in = def.in;
			inst.out = def.out;
		});
		function pipe(in_, out) {
			return new ZodPipe({
				type: "pipe",
				in: in_,
				out
			});
		}
		const ZodReadonly = /*@__PURE__*/ $constructor("ZodReadonly", (inst, def) => {
			$ZodReadonly.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.innerType;
		});
		function readonly(innerType) {
			return new ZodReadonly({
				type: "readonly",
				innerType
			});
		}
		const ZodLazy = /*@__PURE__*/ $constructor("ZodLazy", (inst, def) => {
			$ZodLazy.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => lazyProcessor(inst, ctx, json, params);
			inst.unwrap = () => inst._zod.def.getter();
		});
		function lazy(getter) {
			return new ZodLazy({
				type: "lazy",
				getter
			});
		}
		const ZodCustom = /*@__PURE__*/ $constructor("ZodCustom", (inst, def) => {
			$ZodCustom.init(inst, def);
			ZodType.init(inst, def);
			inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx, json, params);
		});
		function refine(fn, _params = {}) {
			return /* @__PURE__ */ _refine(ZodCustom, fn, _params);
		}
		function superRefine(fn, params) {
			return /* @__PURE__ */ _superRefine(fn, params);
		}
		const _shadowDefinitionConditioning$shape = {
			"capture": _enum(["full", "since-compaction"]).readonly(),
			"context": _enum(["standard", "minimal"]).readonly(),
			"thinkFirst": boolean().readonly(),
			"holdout": boolean().readonly()
		};
		const _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_modelCatalog_result$schema = object({
			"groups": array(object({
				"id": string().readonly(),
				"name": string().readonly(),
				"models": array(object({
					"id": string().readonly(),
					"name": string().readonly(),
					"description": string().readonly().optional(),
					"reasoning": object({
						"efforts": array(object({
							"id": string().readonly(),
							"name": string().readonly(),
							"description": string().readonly().optional()
						})).readonly(),
						"defaultEffort": string().readonly().optional()
					}).readonly().optional()
				})).readonly()
			})).readonly(),
			"failures": array(object({
				"id": string().readonly(),
				"name": string().readonly(),
				"message": string().readonly()
			})).readonly()
		}).readonly();
		const _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_catalog_result$schema = object({
			"definitionRoot": string().readonly(),
			"definitions": array(object({
				"id": string().readonly(),
				"name": string().readonly(),
				"enabled": boolean().readonly(),
				"debug": boolean().readonly(),
				"activationProbability": number().readonly(),
				"activeForModels": array(string()).readonly(),
				"runWithModel": string().readonly().optional(),
				"reasoningEffort": string().readonly().optional(),
				"timeoutSeconds": number().readonly().optional(),
				"tools": array(string()).readonly(),
				..._shadowDefinitionConditioning$shape,
				"prompt": string().readonly(),
				"sourcePath": string().readonly()
			})).readonly(),
			"modelCatalog": _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_modelCatalog_result$schema,
			"defaultShadowTimeoutSeconds": number().readonly().optional(),
			"diagnostics": array(object({
				"path": string().readonly(),
				"error": string().readonly()
			})).readonly()
		});
		const _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_saveDefault_parameter_0$schema = object({
			"id": string().readonly(),
			"name": string().readonly(),
			"enabled": boolean().readonly(),
			"debug": boolean().readonly(),
			"activationProbability": number().readonly(),
			"activeForModels": array(string()).readonly(),
			"runWithModel": union([literal(null), string()]).readonly(),
			"reasoningEffort": union([literal(null), string()]).readonly(),
			"timeoutSeconds": union([literal(null), number()]).readonly(),
			"tools": array(string()).readonly(),
			..._shadowDefinitionConditioning$shape,
			"prompt": string().readonly()
		});
		const _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_saveDefault_result$schema = object({
			"id": string().readonly(),
			"name": string().readonly(),
			"enabled": boolean().readonly(),
			"debug": boolean().readonly(),
			"activationProbability": number().readonly(),
			"activeForModels": array(string()).readonly(),
			"runWithModel": string().readonly().optional(),
			"reasoningEffort": string().readonly().optional(),
			"timeoutSeconds": number().readonly().optional(),
			"tools": array(string()).readonly(),
			..._shadowDefinitionConditioning$shape,
			"prompt": string().readonly(),
			"sourcePath": string().readonly()
		});
		const _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_pause_parameter_0$schema = intersection(string(), unknown());
		const _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_resume_parameter_0$schema = intersection(string(), unknown());
		const _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_status_parameter_0$schema = intersection(string(), unknown());
		const _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_toggle_parameter_0$schema = intersection(string(), unknown());
		const _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_retry_parameter_0$schema = intersection(string(), unknown());
		const _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_retry_parameter_1$schema = string();
		const _shadowMindStage$schema = _enum([
			"prepare",
			"start",
			"run",
			"dispose",
			"validate",
			"relay"
		]);
		const _shadowMindReason$schema = _enum([
			"USER_MESSAGE_RECEIVED",
			"USER_TURN_ABORTED",
			"SHADOW_PAUSED",
			"ROOT_DISPOSED",
			"PLUGIN_DISPOSED",
			"SHADOW_TIMEOUT",
			"HEADLESS_DRAIN_TIMEOUT",
			"HEADLESS_MAINTENANCE_ABORTED",
			"STALE_EPOCH",
			"PROVIDER_ABORTED",
			"SCHEDULING_FAILED",
			"TRAJECTORY_BUILD_FAILED",
			"MODEL_SELECTION_INVALID",
			"SUBAGENT_START_FAILED",
			"SUBAGENT_RESULT_FAILED",
			"SUBAGENT_DISPOSE_FAILED",
			"PROVIDER_ERROR",
			"PROVIDER_MAX_TOKENS",
			"PROVIDER_REFUSAL",
			"PROVIDER_STOPPED",
			"INVALID_STRUCTURED_OUTPUT",
			"STRUCTURED_OUTPUT_MISSING",
			"DEGENERATE_OUTPUT",
			"INVALID_REPORT",
			"REPORT_DELIVERY_FAILED",
			"UNKNOWN_FAILURE"
		]);
		const _shadowMindCancellationSource$schema = _enum([
			"user-input",
			"user-command",
			"root-lifecycle",
			"plugin-lifecycle",
			"timeout",
			"headless",
			"provider",
			"runtime"
		]);
		const _shadowMindSafeError$schema = object({
			"name": string().readonly(),
			"message": string().readonly(),
			"code": string().readonly().optional(),
			"causes": array(lazy(() => _shadowMindSafeError$schema)).readonly().optional()
		});
		const _shadowMindRun$schema = object({
			"runId": string().readonly(),
			"shadowId": string().readonly(),
			"shadowName": string().readonly(),
			"capturedThroughSeq": number().readonly(),
			"phase": _enum([
				"running",
				"report",
				"silent",
				"not_relevant",
				"aborted",
				"failed"
			]).readonly(),
			"stage": _shadowMindStage$schema.readonly(),
			"startedAt": string().readonly(),
			"childSessionId": intersection(string(), unknown()).readonly().optional(),
			"finishedAt": string().readonly().optional(),
			"reasonCode": _shadowMindReason$schema.readonly().optional(),
			"cancellationSource": _shadowMindCancellationSource$schema.readonly().optional(),
			"providerStopReason": string().readonly().optional(),
			"error": _shadowMindSafeError$schema.readonly().optional(),
			"content": string().readonly().optional(),
			"relayed": boolean().readonly().optional()
		});
		const _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_cycles_parameter_0$schema = intersection(string(), unknown());
		const _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_cycles_result$schema = array(object({
			"capturedThroughSeq": number().readonly(),
			"scheduling": boolean().readonly(),
			"runs": array(_shadowMindRun$schema).readonly(),
			"failure": object({
				"reasonCode": literal("SCHEDULING_FAILED").readonly(),
				"stage": literal("prepare").readonly(),
				"error": _shadowMindSafeError$schema.readonly()
			}).readonly().optional()
		})).readonly();
		const _shadowMindStatusV2$schema = object({
			"paused": boolean().readonly(),
			"active": array(object({
				"runId": string().readonly(),
				"shadowId": string().readonly(),
				"shadowName": string().readonly(),
				"childSessionId": intersection(string(), unknown()).readonly().optional(),
				"capturedThroughSeq": number().readonly(),
				"stage": _shadowMindStage$schema.readonly()
			})).readonly(),
			"pendingSchedules": number().readonly(),
			"epoch": number().readonly(),
			"totalRuns": number().readonly(),
			"valueLoop": array(object({
				"shadowId": string().readonly(),
				"challenges": number().readonly(),
				"adopted": number().readonly(),
				"rejected": number().readonly(),
				"ignored": number().readonly(),
				"hitRate": number().readonly().optional()
			})).readonly(),
			"spentChars": number().readonly(),
			"budgetTier": _enum([
				"standard",
				"frugal",
				"exhausted"
			]).readonly(),
			"cooldowns": array(object({
				"shadowId": string().readonly(),
				"until": string().readonly(),
				"patterns": array(_enum([
					"spinning",
					"oscillation",
					"no-drift",
					"diminishing"
				])).readonly()
			})).readonly(),
			"pendingEscalations": array(string()).readonly(),
			"recentReviews": array(object({
				"shadowId": string().readonly(),
				"runId": string().readonly(),
				"verdict": _enum([
					"challenge",
					"gap",
					"confirm",
					"uncertain"
				]).readonly(),
				"refs": array(number()).readonly(),
				"capturedThroughSeq": number().readonly(),
				"finishedAt": string().readonly()
			})).readonly(),
			"lastRun": object({
				"runId": string().readonly(),
				"shadowId": string().readonly(),
				"shadowName": string().readonly(),
				"childSessionId": intersection(string(), unknown()).readonly().optional(),
				"capturedThroughSeq": number().readonly(),
				"finishedAt": string().readonly(),
				"outcome": _enum([
					"report",
					"silent",
					"not_relevant",
					"aborted",
					"failed"
				]).readonly(),
				"stage": _shadowMindStage$schema.readonly(),
				"reasonCode": _shadowMindReason$schema.readonly().optional(),
				"cancellationSource": _shadowMindCancellationSource$schema.readonly().optional(),
				"providerStopReason": string().readonly().optional(),
				"error": _shadowMindSafeError$schema.readonly().optional(),
				"deliberationChars": number().readonly(),
				"verdict": _enum([
					"challenge",
					"gap",
					"confirm",
					"uncertain"
				]).readonly().optional(),
				"independence": _enum([
					"independent",
					"unverified",
					"unavailable",
					"same_vendor"
				]).readonly(),
				"route": string().readonly().optional()
			}).readonly().optional()
		});
		const TYPERT_REMOTE = {
			package: "@whutzefengxie-ops/dsh-shadow-mind",
			descriptors: [
				{
					id: "@whutzefengxie-ops/dsh-shadow-mind#shadowMind/catalog",
					service: "shadowMind",
					namespace: "shadowMind",
					method: "catalog",
					implementation: "remoteExportCatalog",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@whutzefengxie-ops/dsh-shadow-mind/types#ShadowAdministrationSnapshot",
						schema: _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_catalog_result$schema
					},
					sourceLocation: {
						"file": "src/runtime/index.ts",
						"line": 441,
						"column": 3
					}
				},
				{
					id: "@whutzefengxie-ops/dsh-shadow-mind#shadowMind/modelCatalog",
					service: "shadowMind",
					namespace: "shadowMind",
					method: "modelCatalog",
					implementation: "modelCatalog",
					invocation: { kind: "direct" },
					parameters: [],
					result: {
						mode: "strict",
						typeSymbol: "@whutzefengxie-ops/dsh-shadow-mind/types#ShadowModelCatalog",
						schema: _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_modelCatalog_result$schema
					},
					sourceLocation: {
						"file": "src/runtime/index.ts",
						"line": 457,
						"column": 3
					}
				},
				{
					id: "@whutzefengxie-ops/dsh-shadow-mind#shadowMind/retry",
					service: "shadowMind",
					namespace: "shadowMind",
					method: "retry",
					implementation: "retry",
					invocation: { kind: "direct" },
					scope: {
						context: "agent",
						wire: "agentId"
					},
					parameters: [{
						name: "agent",
						wire: "agentId",
						source: "lookup",
						lookup: "agent",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-session/types#SessionId",
							schema: _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_retry_parameter_0$schema
						}
					}, {
						name: "runId",
						wire: "runId",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@whutzefengxie-ops/dsh-shadow-mind#shadowMind/retry:runId",
							schema: _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_retry_parameter_1$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@whutzefengxie-ops/dsh-shadow-mind/types#ShadowMindStatus",
						schema: _shadowMindStatusV2$schema
					},
					sourceLocation: {
						"file": "src/runtime/index.ts",
						"line": 637,
						"column": 3
					}
				},
				{
					id: "@whutzefengxie-ops/dsh-shadow-mind#shadowMind/cycles",
					service: "shadowMind",
					namespace: "shadowMind",
					method: "cycles",
					implementation: "reviewCycles",
					invocation: { kind: "direct" },
					scope: {
						context: "agent",
						wire: "agentId"
					},
					parameters: [{
						name: "agent",
						wire: "agentId",
						source: "lookup",
						lookup: "agent",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-session/types#SessionId",
							schema: _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_cycles_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@whutzefengxie-ops/dsh-shadow-mind/types#ShadowReviewCycle[]",
						schema: _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_cycles_result$schema
					},
					sourceLocation: {
						"file": "src/runtime/index.ts",
						"line": 572,
						"column": 3
					}
				},
				{
					id: "@whutzefengxie-ops/dsh-shadow-mind#shadowMind/saveDefault",
					service: "shadowMind",
					namespace: "shadowMind",
					method: "saveDefault",
					implementation: "remoteExportSaveDefault",
					invocation: { kind: "direct" },
					parameters: [{
						name: "input",
						wire: "input",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@whutzefengxie-ops/dsh-shadow-mind/types#ShadowDefinitionInput",
							schema: _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_saveDefault_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@whutzefengxie-ops/dsh-shadow-mind/types#ShadowDefinition",
						schema: _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_saveDefault_result$schema
					},
					sourceLocation: {
						"file": "src/runtime/index.ts",
						"line": 468,
						"column": 3
					}
				},
				{
					id: "@whutzefengxie-ops/dsh-shadow-mind#shadowMind/pause",
					service: "shadowMind",
					namespace: "shadowMind",
					method: "pause",
					invocation: { kind: "direct" },
					scope: {
						context: "agent",
						wire: "agentId"
					},
					parameters: [{
						name: "agent",
						wire: "agentId",
						source: "lookup",
						lookup: "agent",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-session/types#SessionId",
							schema: _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_pause_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@whutzefengxie-ops/dsh-shadow-mind/types#ShadowMindStatus",
						schema: _shadowMindStatusV2$schema
					},
					sourceLocation: {
						"file": "src/runtime/index.ts",
						"line": 590,
						"column": 3
					}
				},
				{
					id: "@whutzefengxie-ops/dsh-shadow-mind#shadowMind/resume",
					service: "shadowMind",
					namespace: "shadowMind",
					method: "resume",
					invocation: { kind: "direct" },
					scope: {
						context: "agent",
						wire: "agentId"
					},
					parameters: [{
						name: "agent",
						wire: "agentId",
						source: "lookup",
						lookup: "agent",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-session/types#SessionId",
							schema: _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_resume_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@whutzefengxie-ops/dsh-shadow-mind/types#ShadowMindStatus",
						schema: _shadowMindStatusV2$schema
					},
					sourceLocation: {
						"file": "src/runtime/index.ts",
						"line": 607,
						"column": 3
					}
				},
				{
					id: "@whutzefengxie-ops/dsh-shadow-mind#shadowMind/status",
					service: "shadowMind",
					namespace: "shadowMind",
					method: "status",
					invocation: { kind: "direct" },
					scope: {
						context: "agent",
						wire: "agentId"
					},
					parameters: [{
						name: "agent",
						wire: "agentId",
						source: "lookup",
						lookup: "agent",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-session/types#SessionId",
							schema: _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_status_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@whutzefengxie-ops/dsh-shadow-mind/types#ShadowMindStatus",
						schema: _shadowMindStatusV2$schema
					},
					sourceLocation: {
						"file": "src/runtime/index.ts",
						"line": 509,
						"column": 3
					}
				},
				{
					id: "@whutzefengxie-ops/dsh-shadow-mind#shadowMind/toggle",
					service: "shadowMind",
					namespace: "shadowMind",
					method: "toggle",
					invocation: { kind: "direct" },
					scope: {
						context: "agent",
						wire: "agentId"
					},
					parameters: [{
						name: "agent",
						wire: "agentId",
						source: "lookup",
						lookup: "agent",
						codec: {
							mode: "strict",
							typeSymbol: "@deepseek-ai/dsh-session/types#SessionId",
							schema: _deepseek_ai_dsh_shadow_mind_runtime_shadowMind_toggle_parameter_0$schema
						}
					}],
					result: {
						mode: "strict",
						typeSymbol: "@whutzefengxie-ops/dsh-shadow-mind/types#ShadowMindStatus",
						schema: _shadowMindStatusV2$schema
					},
					sourceLocation: {
						"file": "src/runtime/index.ts",
						"line": 621,
						"column": 3
					}
				}
			]
		};
		/** Stable id of the single scheduled Shadow definition. */
		const DEFAULT_SHADOW_ID = "default";
		/** Harness-owned probe library for durable tool-call trajectories. */
		const PROBE_CLASSES_V1 = Object.freeze([
			{
				id: "failed_tool_call",
				name: "Failed tool call",
				trigger: "A tool result records an error.",
				probe: "Check whether the root identified the cause and changed its next action."
			},
			{
				id: "redacted_arguments",
				name: "Redacted arguments",
				trigger: "A tool call renders arguments as [redacted].",
				probe: "State the evidence gap; never infer or claim the hidden arguments were checked."
			},
			{
				id: "stale_read",
				name: "Stale read",
				trigger: "A path is read and later rewritten.",
				probe: "Check whether later conclusions depend on content captured before the rewrite."
			},
			{
				id: "misleading_success",
				name: "Misleading success",
				trigger: "A successful tool result is followed by an error from the same tool.",
				probe: "Compare the two outcomes and test whether the earlier success overstated completion."
			},
			{
				id: "repeated_failure",
				name: "Repeated failure",
				trigger: "The same tool fails at least three times.",
				probe: "Check whether retries changed a relevant input or merely repeated the failing action."
			},
			{
				id: "long_output",
				name: "Long output",
				trigger: "A tool result approaches the trajectory projection bound.",
				probe: "Check whether conclusions rely on omitted detail and report that evidence gap explicitly."
			}
		]);
		Object.freeze({
			contrarian: [
				"failed_tool_call",
				"redacted_arguments",
				"stale_read",
				"misleading_success",
				"repeated_failure",
				"long_output"
			],
			hacker: ["repeated_failure", "misleading_success"],
			researcher: ["redacted_arguments", "long_output"],
			simplifier: ["repeated_failure", "long_output"],
			architect: ["stale_read", "misleading_success"]
		});
		/**
		* Render a stable model-facing trigger-and-probe checklist.
		* @param classes Probe classes to include.
		* @returns Markdown checklist with the evidence rule.
		*/
		function renderProbeChecklist(classes) {
			return [
				"## Probe checklist",
				...classes.flatMap((item) => [
					`- ${item.name} (\`${item.id}\`)`,
					`  - Trigger: ${item.trigger}`,
					`  - Probe: ${item.probe}`
				]),
				"",
				"Report an evidence gap when a probe cannot be run. Never claim a probe ran without trajectory evidence."
			].join("\n");
		}
		/**
		* Bundled review-style presets for the Shadow Mind settings tab.
		* Presets are client-side only: choosing one pre-fills the responsibility
		* prompt (and capture window) of the single default Shadow; nothing is
		* persisted until the user saves.
		* @module @whutzefengxie-ops/dsh-shadow-mind/client/templates
		*/
		/** Mirrors the runtime definition id pattern without importing Node-side registry code. */
		const TEMPLATE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/u;
		/** Shared anchored-report rule closing every starter-persona prompt. */
		const REPORT_RULE = "When reporting, name the probe class and return an anchored verdict with only rendered sequence references.";
		/** Render one starter persona prompt from the shipped probe library. */
		function personaPrompt(opening) {
			return [
				opening,
				"",
				renderProbeChecklist(PROBE_CLASSES_V1),
				"",
				REPORT_RULE
			].join("\n");
		}
		/** Starter personas matching `examples/shadow-minds/` plus one implementation reviewer. */
		const SHADOW_TEMPLATES = Object.freeze([
			{
				id: "contrarian",
				nameKey: "templateNameContrarian",
				descriptionKey: "templateDescriptionContrarian",
				capture: "since-compaction",
				prompt: personaPrompt("Challenge the strongest root claim. Prefer a concrete counterexample over broad caution.")
			},
			{
				id: "hacker",
				nameKey: "templateNameHacker",
				descriptionKey: "templateDescriptionHacker",
				capture: "since-compaction",
				prompt: personaPrompt("Inspect failure handling and repeated operations. Name the probed class in every report.")
			},
			{
				id: "researcher",
				nameKey: "templateNameResearcher",
				descriptionKey: "templateDescriptionResearcher",
				capture: "since-compaction",
				prompt: personaPrompt("Audit whether each conclusion is supported by the rendered trajectory. Treat omitted data as an evidence gap.")
			},
			{
				id: "simplifier",
				nameKey: "templateNameSimplifier",
				descriptionKey: "templateDescriptionSimplifier",
				capture: "since-compaction",
				prompt: personaPrompt("Find repeated work or an unnecessary mechanism only when the trajectory demonstrates it.")
			},
			{
				id: "architect",
				nameKey: "templateNameArchitect",
				descriptionKey: "templateDescriptionArchitect",
				capture: "since-compaction",
				prompt: personaPrompt("Inspect cross-step consistency, stale inputs, and claims that do not follow from recorded results.")
			},
			{
				id: "implementation-reviewer",
				nameKey: "templateNameImplementationReviewer",
				descriptionKey: "templateDescriptionImplementationReviewer",
				capture: "since-compaction",
				prompt: [
					"Review the completed root implementation work against its task.",
					"",
					"Priority checks:",
					"",
					"1. Did the root miss an explicit requirement, constraint, or acceptance condition from the user?",
					"2. Does the final conclusion contradict tool results, file contents, test output, or recorded errors?",
					"3. Did the changes introduce a functional defect, security issue, data-loss risk, concurrency problem, or platform-specific breakage?",
					"4. Did the root claim completion without required verification?",
					"5. After a failed tool call, did the root repeat the same action without changing its input or addressing the cause?",
					"6. Does a conclusion rely on stale reads, truncated output, or redacted content treated as verified?",
					"",
					"Rules:",
					"",
					"- Report only issues directly supported by the rendered trajectory and worth the user's action.",
					"- Never report style preferences, naming opinions, optional refactors, or generic improvements.",
					"- Never guess hidden reasoning, redacted arguments, or omitted tool results.",
					"- Every report must state the problem, the evidence, the impact, and a suggested fix.",
					"- `refs` must only contain rendered sequence numbers from the current trajectory.",
					"- Use `gap` or `challenge` for clear violations or defects, `uncertain` when the risk is specific but evidence is missing, and `confirm` only when the review scope genuinely warrants it.",
					"- Return `silent` when the review applied but found nothing actionable, and `not_relevant` when the task does not suit an implementation review."
				].join("\n")
			}
		]);
		/* v8 ignore start -- module-level invariant; reject malformed preset data before any UI renders it. */
		for (const template of SHADOW_TEMPLATES) {
			if (!TEMPLATE_ID_PATTERN.test(template.id)) throw new Error(`shadow template id must match ${String(TEMPLATE_ID_PATTERN)}: ${JSON.stringify(template.id)}`);
			if (template.prompt.trim() === "" || template.nameKey.trim() === "" || template.descriptionKey.trim() === "") throw new Error(`shadow template ${JSON.stringify(template.id)} needs a non-empty prompt, nameKey, and descriptionKey`);
		}
		if (new Set(SHADOW_TEMPLATES.map((template) => template.id)).size !== SHADOW_TEMPLATES.length) throw new Error("shadow template ids must be unique");
		/* v8 ignore stop */
		const css$1 = "._2jVvSa_page{box-sizing:border-box;flex-direction:column;gap:16px;width:100%;display:flex;position:relative}._2jVvSa_hero{justify-content:space-between;align-items:center;gap:12px;display:flex}._2jVvSa_hero h2{margin:0}._2jVvSa_hero p{color:var(--dsw-color-text-secondary,#57606a);margin:4px 0 0;font-size:13px}._2jVvSa_panel{border:1px solid var(--dsw-color-border,#d8dee4);background:var(--dsw-color-bg-container,#fff);box-sizing:border-box;border-radius:10px;width:100%;padding:16px}._2jVvSa_panel h3{margin:0}._2jVvSa_cardHead{justify-content:space-between;align-items:flex-start;gap:12px;display:flex}._2jVvSa_cardHead p{color:var(--dsw-color-text-secondary,#57606a);margin:4px 0 0;font-size:13px}._2jVvSa_lastRunLine{color:var(--dsw-color-text-secondary,#57606a);margin:10px 0 0;font-size:13px}._2jVvSa_grid{grid-template-columns:repeat(auto-fit,minmax(240px,1fr));align-items:start;gap:12px;margin-top:14px;display:grid}._2jVvSa_fullSpan{grid-column:1/-1}._2jVvSa_stack{grid-template-columns:1fr}._2jVvSa_field{flex-direction:column;gap:6px;font-size:13px;display:flex}._2jVvSa_field>span{font-weight:600}._2jVvSa_field input,._2jVvSa_field textarea,._2jVvSa_field select{box-sizing:border-box;border:1px solid var(--dsw-color-border,#d8dee4);background:var(--dsw-color-bg-layout,#f6f8fa);width:100%;font:inherit;border-radius:8px;padding:8px 10px}._2jVvSa_field textarea{resize:vertical;min-height:110px}._2jVvSa_promptField textarea{min-height:180px}._2jVvSa_field small{color:var(--dsw-color-text-secondary,#57606a);font-size:12px}._2jVvSa_probabilityHint,._2jVvSa_switchHint{color:var(--dsw-color-text-secondary,#57606a);grid-column:1/-1;margin-top:-6px;font-size:12px}._2jVvSa_fieldset{border:1px solid var(--dsw-color-border,#d8dee4);border-radius:8px;padding:12px}._2jVvSa_fieldset legend{padding:0 6px;font-size:13px;font-weight:600}._2jVvSa_fieldset ._2jVvSa_grid{margin-top:6px}._2jVvSa_fieldset small{color:var(--dsw-color-text-secondary,#57606a);margin-top:8px;font-size:12px;display:block}._2jVvSa_disclosure{border:1px solid var(--dsw-color-border,#d8dee4);border-radius:8px;margin-top:14px;padding:8px 12px}._2jVvSa_disclosure>summary{cursor:pointer;user-select:none;font-size:13px;font-weight:600}._2jVvSa_disclosure ._2jVvSa_grid{margin-top:8px}._2jVvSa_switch{cursor:pointer;align-items:center;gap:8px;font-size:13px;font-weight:600;display:flex}._2jVvSa_switchTrack{background:var(--dsw-color-border,#d0d7de);cursor:pointer;border:none;border-radius:999px;flex:none;width:44px;height:24px;transition:background .15s;position:relative}._2jVvSa_switchTrack[data-on=true]{background:#2da44e}._2jVvSa_switchTrack:disabled{cursor:not-allowed;opacity:.6}._2jVvSa_switchThumb{background:#fff;border-radius:50%;width:18px;height:18px;transition:transform .15s;position:absolute;top:3px;left:3px}._2jVvSa_switchTrack[data-on=true] ._2jVvSa_switchThumb{transform:translate(20px)}._2jVvSa_sliderField{flex-direction:column;gap:8px;font-size:13px;display:flex}._2jVvSa_sliderField>span:first-child{font-weight:600}._2jVvSa_sliderRow{align-items:center;gap:12px;display:flex}._2jVvSa_sliderRow input[type=range]{accent-color:#2f81f7;flex:1}._2jVvSa_sliderValue{text-align:right;font-variant-numeric:tabular-nums;min-width:52px;font-size:15px;font-weight:600}._2jVvSa_radioGroup{flex-direction:column;gap:6px;font-size:13px;display:flex}._2jVvSa_radioGroupLabel{font-weight:600}._2jVvSa_radioOptions{flex-wrap:wrap;gap:14px;display:flex}._2jVvSa_radioOption{cursor:pointer;align-items:center;gap:6px;display:flex}._2jVvSa_formActions{justify-content:flex-end;align-items:center;gap:8px;margin-top:14px;display:flex}._2jVvSa_formActions button{border:1px solid var(--dsw-color-border,#d8dee4);background:var(--dsw-color-bg-layout,#f6f8fa);font:inherit;cursor:pointer;border-radius:8px;padding:8px 16px}._2jVvSa_formActions button:last-child{color:#fff;background:#2f81f7;border-color:#2f81f7}._2jVvSa_formActions button:disabled{cursor:not-allowed;opacity:.55}._2jVvSa_legacyNote{background:#d4a72c24;border-radius:8px;margin-top:12px;padding:10px 12px;font-size:13px}._2jVvSa_error{color:#cf222e;background:#cf222e1f;border-radius:8px;margin-top:12px;padding:10px 12px;font-size:13px}._2jVvSa_toastStack{z-index:1000;flex-direction:column;gap:8px;max-width:min(420px,100vw - 40px);display:flex;position:fixed;bottom:20px;right:20px}._2jVvSa_toast{border:1px solid var(--dsw-color-border,#d8dee4);background:var(--dsw-color-bg-container,#fff);border-radius:8px;align-items:flex-start;gap:10px;padding:10px 12px;font-size:13px;animation:.18s ease-out _2jVvSa_shadow-toast-in;display:flex;box-shadow:0 6px 20px #1f23282e}._2jVvSa_toast[data-kind=success]{border-left:4px solid #2da44e}._2jVvSa_toast[data-kind=error]{color:#cf222e;border-left:4px solid #cf222e}._2jVvSa_toast[data-kind=info]{border-left:4px solid #2f81f7}._2jVvSa_toastText{overflow-wrap:anywhere;flex:1}._2jVvSa_toastDismiss{cursor:pointer;color:var(--dsw-color-text-secondary,#57606a);background:0 0;border:none;padding:0 2px;font-size:16px;line-height:1}@keyframes _2jVvSa_shadow-toast-in{0%{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@media (width<=720px){._2jVvSa_hero,._2jVvSa_cardHead{flex-direction:column;align-items:flex-start}._2jVvSa_formActions{flex-wrap:wrap;justify-content:flex-start}}";
		const tagId$1 = "@whutzefengxie-ops/dsh-shadow-mind/ShadowMindSettingsTab.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@whutzefengxie-ops/dsh-shadow-mind";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var ShadowMindSettingsTab_module_css_default = {
			"cardHead": "_2jVvSa_cardHead",
			"disclosure": "_2jVvSa_disclosure",
			"error": "_2jVvSa_error",
			"field": "_2jVvSa_field",
			"fieldset": "_2jVvSa_fieldset",
			"formActions": "_2jVvSa_formActions",
			"fullSpan": "_2jVvSa_fullSpan",
			"grid": "_2jVvSa_grid",
			"hero": "_2jVvSa_hero",
			"lastRunLine": "_2jVvSa_lastRunLine",
			"legacyNote": "_2jVvSa_legacyNote",
			"page": "_2jVvSa_page",
			"panel": "_2jVvSa_panel",
			"probabilityHint": "_2jVvSa_probabilityHint",
			"promptField": "_2jVvSa_promptField",
			"radioGroup": "_2jVvSa_radioGroup",
			"radioGroupLabel": "_2jVvSa_radioGroupLabel",
			"radioOption": "_2jVvSa_radioOption",
			"radioOptions": "_2jVvSa_radioOptions",
			"shadow-toast-in": "_2jVvSa_shadow-toast-in",
			"sliderField": "_2jVvSa_sliderField",
			"sliderRow": "_2jVvSa_sliderRow",
			"sliderValue": "_2jVvSa_sliderValue",
			"stack": "_2jVvSa_stack",
			"switch": "_2jVvSa_switch",
			"switchHint": "_2jVvSa_switchHint",
			"switchThumb": "_2jVvSa_switchThumb",
			"switchTrack": "_2jVvSa_switchTrack",
			"toast": "_2jVvSa_toast",
			"toastDismiss": "_2jVvSa_toastDismiss",
			"toastStack": "_2jVvSa_toastStack",
			"toastText": "_2jVvSa_toastText"
		};
		/**
		* Three linked provider/model/effort dropdowns bound to the live DSH
		* directory served by the `catalog` remote. The wire format stays the
		* legacy `provider/model` route string: this component composes and
		* decomposes it, so stored definitions and the model-facing management
		* tools keep their unchanged contract.
		*
		* The dropdowns own local selection state so a user can pick a provider
		* before picking a model; the half-selection travels as a trailing-slash
		* route (`provider/`) so a discard or reload can distinguish it from the
		* genuinely empty route and resets the UI to match the stored value.
		*/
		/** Split one route string into provider and model halves. */
		function splitRoute(route) {
			const slash = route.indexOf("/");
			if (slash <= 0) return {
				provider: "",
				model: ""
			};
			return {
				provider: route.slice(0, slash),
				model: route.slice(slash + 1)
			};
		}
		/** Shallow equality for the externally visible selection state. */
		function sameValue(left, right) {
			return left.route === right.route && left.effort === right.effort;
		}
		/** Render the linked dropdowns. */
		function ModelRouteSelect(props) {
			const { catalog, labels, effortFallback = [] } = props;
			const groups = catalog?.groups ?? [];
			const failures = catalog?.failures ?? [];
			const initial = splitRoute(props.value.route);
			const [provider, setProvider] = (0, react.useState)(initial.provider);
			const [model, setModel] = (0, react.useState)(initial.model);
			const [effort, setEffort] = (0, react.useState)(props.value.effort);
			const lastEmitted = (0, react.useRef)(props.value);
			(0, react.useEffect)(() => {
				if (sameValue(lastEmitted.current, props.value)) return;
				lastEmitted.current = props.value;
				const split = splitRoute(props.value.route);
				setProvider(split.provider);
				setModel(split.model);
				setEffort(props.value.effort);
			}, [props.value]);
			const group = groups.find((candidate) => candidate.id === provider);
			const modelEntry = group?.models.find((candidate) => candidate.id === model);
			const advertisedEfforts = modelEntry?.reasoning?.efforts.map((entry) => entry.id) ?? effortFallback;
			const effortKnown = effort === "" || advertisedEfforts.includes(effort);
			const controlsDisabled = props.disabled === true || catalog === null;
			const currentRoute = provider === "" ? "" : model === "" ? `${provider}/` : `${provider}/${model}`;
			const emit = (next) => {
				lastEmitted.current = next;
				props.onChange(next);
			};
			const adoptRoute = (route) => {
				const split = splitRoute(route);
				const efforts = groups.find((candidate) => candidate.id === split.provider)?.models.find((candidate) => candidate.id === split.model)?.reasoning?.efforts.map((entry) => entry.id) ?? effortFallback;
				const nextEffort = effort !== "" && !efforts.includes(effort) ? "" : effort;
				setEffort(nextEffort);
				emit({
					route,
					effort: nextEffort
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					className: ShadowMindSettingsTab_module_css_default.field,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: labels.provider }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
						disabled: controlsDisabled,
						value: provider,
						onChange: (event) => {
							const next = event.currentTarget.value;
							const nextModels = groups.find((candidate) => candidate.id === next)?.models ?? [];
							const nextModel = next === "" || nextModels.some((candidate) => candidate.id === model) ? model : "";
							setProvider(next);
							setModel(nextModel);
							if (next === "") adoptRoute("");
							else if (nextModel === "") adoptRoute(`${next}/`);
							else adoptRoute(`${next}/${nextModel}`);
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "",
								children: "—"
							}),
							groups.map((candidate) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: candidate.id,
								children: candidate.name
							}, candidate.id)),
							provider !== "" && group === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: provider,
								disabled: true,
								children: provider
							}) : null,
							failures.map((candidate) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: candidate.id,
								disabled: true,
								children: candidate.name
							}, candidate.id))
						]
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					className: ShadowMindSettingsTab_module_css_default.field,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: labels.model }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
						disabled: controlsDisabled || provider === "" || group === void 0,
						value: model,
						onChange: (event) => {
							const next = event.currentTarget.value;
							if (next === "") {
								setProvider("");
								setModel("");
								adoptRoute("");
								return;
							}
							setModel(next);
							adoptRoute(`${provider}/${next}`);
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "",
								children: "—"
							}),
							group?.models.map((candidate) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: candidate.id,
								children: candidate.name
							}, candidate.id)) ?? null,
							model !== "" && modelEntry === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: model,
								disabled: true,
								children: model
							}) : null
						]
					})]
				}),
				props.hideEffort === true ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
					className: ShadowMindSettingsTab_module_css_default.field,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: labels.effort }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
						disabled: controlsDisabled,
						value: effort,
						onChange: (event) => {
							const next = event.currentTarget.value;
							setEffort(next);
							emit({
								route: currentRoute,
								effort: next
							});
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: "",
								children: "—"
							}),
							advertisedEfforts.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: entry,
								children: entry
							}, entry)),
							effort !== "" && !effortKnown ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: effort,
								disabled: true,
								children: effort
							}) : null
						]
					})]
				})
			] });
		}
		/** Accessible on/off switch rendered as a labelled toggle button. */
		function Switch(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: ShadowMindSettingsTab_module_css_default.switch,
				htmlFor: props.id,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: props.label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					id: props.id,
					type: "button",
					role: "switch",
					"aria-checked": props.checked,
					disabled: props.disabled,
					className: ShadowMindSettingsTab_module_css_default.switchTrack,
					"data-on": props.checked,
					onClick: () => {
						props.onChange(!props.checked);
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: ShadowMindSettingsTab_module_css_default.switchThumb })
				})]
			});
		}
		/** 10%–100% probability slider stepping by 10 with a live value bubble. */
		function ProbabilitySlider(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: `${ShadowMindSettingsTab_module_css_default.sliderField} ${ShadowMindSettingsTab_module_css_default.fullSpan}`,
				htmlFor: props.id,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: props.label }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: ShadowMindSettingsTab_module_css_default.sliderRow,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						id: props.id,
						type: "range",
						min: 10,
						max: 100,
						step: 10,
						value: props.value,
						disabled: props.disabled,
						"aria-valuemin": 10,
						"aria-valuemax": 100,
						"aria-valuenow": props.value,
						"aria-valuetext": `${props.value}%`,
						onChange: (event) => {
							props.onChange(Number(event.currentTarget.value));
						}
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("output", {
						className: ShadowMindSettingsTab_module_css_default.sliderValue,
						children: [props.value, "%"]
					})]
				})]
			});
		}
		/** Linear, fixed-position toast stack for operation feedback in the settings tab. */
		/** Lifetime for one toast in milliseconds, by kind. */
		const TOAST_LIFETIME_MS = {
			success: 3e3,
			info: 4e3,
			error: 6e3
		};
		/**
		* Own a bounded stack of auto-dismissing toasts.
		* @returns The live toasts plus push and dismiss operations.
		*/
		function useToasts() {
			const [toasts, setToasts] = (0, react.useState)([]);
			const nextId = (0, react.useRef)(1);
			const timers = (0, react.useRef)(/* @__PURE__ */ new Map());
			const dismiss = (0, react.useCallback)((id) => {
				const timer = timers.current.get(id);
				if (timer !== void 0) clearTimeout(timer);
				timers.current.delete(id);
				setToasts((current) => current.filter((toast) => toast.id !== id));
			}, []);
			const push = (0, react.useCallback)((kind, text) => {
				const id = nextId.current;
				nextId.current += 1;
				setToasts((current) => [...current.slice(-4), {
					id,
					kind,
					text
				}]);
				timers.current.set(id, setTimeout(() => {
					dismiss(id);
				}, TOAST_LIFETIME_MS[kind]));
			}, [dismiss]);
			(0, react.useEffect)(() => {
				const pending = timers.current;
				return () => {
					for (const timer of pending.values()) clearTimeout(timer);
					pending.clear();
				};
			}, []);
			return {
				toasts,
				push,
				dismiss
			};
		}
		/** Render the newest toast on top of a fixed bottom-right linear stack. */
		function ToastStack(props) {
			if (props.toasts.length === 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: ShadowMindSettingsTab_module_css_default.toastStack,
				"aria-live": "polite",
				children: [...props.toasts].reverse().map((toast) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: ShadowMindSettingsTab_module_css_default.toast,
					"data-kind": toast.kind,
					role: toast.kind === "error" ? "alert" : "status",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: ShadowMindSettingsTab_module_css_default.toastText,
						children: toast.text
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: ShadowMindSettingsTab_module_css_default.toastDismiss,
						"aria-label": props.dismissLabel,
						onClick: () => {
							props.onDismiss(toast.id);
						},
						children: "×"
					})]
				}, toast.id))
			});
		}
		/** Keep a browser render failure visible inside the Settings page. */
		var ShadowMindSettingsTabBoundary = class extends react.Component {
			state = { error: void 0 };
			static getDerivedStateFromError(error) {
				return { error: error instanceof Error ? error : new Error(String(error)) };
			}
			componentDidCatch(error) {
				console.error("ui-shadow-mind: Settings tab render failed", error);
			}
			render() {
				if (this.state.error === void 0) return this.props.children;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: ShadowMindSettingsTab_module_css_default.panel,
					"data-shadow-mind-render-error": true,
					role: "alert",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: this.props.failureTitle }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: this.props.failureHint }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: this.state.error.message })
					]
				});
			}
		};
		/** Round one stored probability into the closest slider step. */
		function toActivationPercent(probability) {
			const percent = Math.round(probability * 100 / 10) * 10;
			return Math.min(100, Math.max(10, percent));
		}
		/** Render one persisted definition into the complete edit form. */
		function definitionDraft(value) {
			return {
				name: value.name,
				enabled: value.enabled,
				debug: value.debug,
				activationPercent: toActivationPercent(value.activationProbability),
				activeForModels: value.activeForModels.join("\n"),
				runWithModel: value.runWithModel ?? "",
				reasoningEffort: value.reasoningEffort ?? "",
				timeoutSeconds: value.timeoutSeconds === void 0 ? "" : String(value.timeoutSeconds),
				tools: value.tools.join("\n"),
				capture: value.capture,
				context: value.context,
				thinkFirst: value.thinkFirst,
				holdout: value.holdout,
				prompt: value.prompt
			};
		}
		/** Split newline-delimited form fields while rejecting no values locally. */
		function lines(text) {
			return text.split(/\r?\n/u).map((value) => value.trim()).filter((value) => value !== "");
		}
		/**
		* Normalize a route draft: trim, and map a trailing-slash half-selection
		* (`provider/`) back to the empty inherit route.
		*/
		function normalizeRoute(text) {
			const trimmed = text.trim();
			return /^[^/\s]+\/$/u.test(trimmed) ? "" : trimmed.replace(/\/+$/u, "");
		}
		/** Parse one finite numeric draft. */
		function finite(text) {
			if (text.trim() === "") return void 0;
			const value = Number(text);
			return Number.isFinite(value) ? value : void 0;
		}
		/** Validate and convert the default Shadow definition form. */
		function definitionInput(draft) {
			const timeout = finite(draft.timeoutSeconds);
			if (draft.name.trim() === "" || draft.prompt.trim() === "" || draft.timeoutSeconds.trim() !== "" && (timeout === void 0 || timeout <= 0)) return void 0;
			return {
				id: DEFAULT_SHADOW_ID,
				name: draft.name.trim(),
				enabled: draft.enabled,
				debug: draft.debug,
				activationProbability: draft.activationPercent / 100,
				activeForModels: lines(draft.activeForModels),
				runWithModel: normalizeRoute(draft.runWithModel) || null,
				reasoningEffort: draft.reasoningEffort.trim() || null,
				timeoutSeconds: timeout ?? null,
				tools: lines(draft.tools),
				capture: draft.capture,
				context: draft.context,
				thinkFirst: draft.thinkFirst,
				holdout: draft.holdout,
				prompt: draft.prompt.trim()
			};
		}
		const OUTCOME_KEYS = {
			report: "outcomeReport",
			silent: "outcomeSilent",
			not_relevant: "outcomeNotRelevant",
			aborted: "outcomeAborted",
			failed: "outcomeFailed"
		};
		/** Turn one remote failure into actionable copy for a toast. */
		function friendlyError(t, error) {
			const message = error instanceof Error ? error.message : String(error);
			if (message.includes("not writable")) return t("errorNotWritable");
			if (message.includes("holdout")) return t("errorHoldout");
			if (message.includes("already exists")) return t("errorAlreadyExists");
			return `${t("operationFailed")}: ${message}`;
		}
		/** Shadow Mind administration tab under Settings → Plugins. */
		function ShadowMindSettingsTabContent(props) {
			const { t } = props;
			const currentSession = props.useSessions((snapshot) => snapshot.current);
			const collapsedByDefault = props.useCollapsedByDefault();
			const [catalog, setCatalog] = (0, react.useState)(null);
			const [status, setStatus] = (0, react.useState)(null);
			const [loadError, setLoadError] = (0, react.useState)(false);
			const [busy, setBusy] = (0, react.useState)(false);
			const [definitionEdit, setDefinitionEdit] = (0, react.useState)(null);
			const { toasts, push, dismiss } = useToasts();
			const defaultTimeoutSeconds = catalog?.defaultShadowTimeoutSeconds;
			const currentDefinition = catalog?.definitions.find((definition) => definition.id === DEFAULT_SHADOW_ID);
			const legacyDefinitions = (0, react.useMemo)(() => catalog?.definitions.filter((definition) => definition.id !== "default") ?? [], [catalog]);
			const reload = async () => {
				setLoadError(false);
				try {
					setCatalog(await props.catalog());
				} catch {
					setLoadError(true);
				}
			};
			const reloadStatus = async (sessionId) => {
				try {
					setStatus(await props.status(sessionId));
				} catch {
					setStatus(null);
					setLoadError(true);
				}
			};
			const refresh = () => {
				reload();
				if (currentSession !== void 0) reloadStatus(currentSession);
			};
			(0, react.useEffect)(() => {
				reload();
			}, []);
			(0, react.useEffect)(() => {
				if (definitionEdit !== null) return;
				const definition = catalog?.definitions.find((item) => item.id === DEFAULT_SHADOW_ID);
				if (definition !== void 0) setDefinitionEdit(definitionDraft(definition));
			}, [catalog, definitionEdit]);
			(0, react.useEffect)(() => {
				let live = true;
				if (currentSession === void 0) {
					setStatus(null);
					return () => {
						live = false;
					};
				}
				props.status(currentSession).then((value) => {
					if (live) setStatus(value);
				}, () => {
					if (!live) return;
					setStatus(null);
					setLoadError(true);
				});
				return () => {
					live = false;
				};
			}, [currentSession, props.status]);
			const validDefinition = definitionEdit === null ? void 0 : definitionInput(definitionEdit);
			const baselineInput = currentDefinition === void 0 ? void 0 : definitionInput(definitionDraft(currentDefinition));
			const definitionDirty = (0, react.useMemo)(() => validDefinition !== void 0 && baselineInput !== void 0 && JSON.stringify(validDefinition) !== JSON.stringify(baselineInput), [validDefinition, baselineInput]);
			const run = async (operation) => {
				setBusy(true);
				try {
					await operation();
				} catch (error) {
					push("error", friendlyError(t, error));
				} finally {
					setBusy(false);
				}
			};
			const save = () => {
				if (validDefinition === void 0) return;
				run(async () => {
					const saved = await props.saveDefault(validDefinition);
					setDefinitionEdit(definitionDraft(saved));
					await reload();
					push("success", t("saved"));
				});
			};
			const discard = () => {
				if (currentDefinition === void 0) return;
				setDefinitionEdit(definitionDraft(currentDefinition));
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: ShadowMindSettingsTab_module_css_default.page,
				"data-shadow-mind-settings": true,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: ShadowMindSettingsTab_module_css_default.hero,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: t("title") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("intro") })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							disabled: busy,
							onClick: refresh,
							children: t("refresh")
						})]
					}),
					loadError ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "alert",
						className: ShadowMindSettingsTab_module_css_default.error,
						children: t("loadError")
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: ShadowMindSettingsTab_module_css_default.panel,
						"data-shadow-card": true,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ShadowMindSettingsTab_module_css_default.cardHead,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("shadowCardTitle") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("shadowCardDescription") })] }), definitionEdit !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Switch, {
									id: "shadow-enabled",
									label: t(definitionEdit.enabled ? "shadowOn" : "shadowOff"),
									checked: definitionEdit.enabled,
									disabled: busy,
									onChange: (enabled) => {
										setDefinitionEdit({
											...definitionEdit,
											enabled
										});
									}
								}) : null]
							}),
							status === null || status.lastRun === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: ShadowMindSettingsTab_module_css_default.lastRunLine,
								children: t("lastRunSummary", {
									outcome: t(OUTCOME_KEYS[status.lastRun.outcome]),
									time: status.lastRun.finishedAt
								})
							}),
							definitionEdit === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("noDefaultDefinition") }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: ShadowMindSettingsTab_module_css_default.grid,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProbabilitySlider, {
											id: "shadow-probability",
											label: t("triggerProbability"),
											value: definitionEdit.activationPercent,
											disabled: busy,
											onChange: (percent) => {
												setDefinitionEdit({
													...definitionEdit,
													activationPercent: percent
												});
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
											className: ShadowMindSettingsTab_module_css_default.probabilityHint,
											children: t("triggerProbabilityHint")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: ShadowMindSettingsTab_module_css_default.field,
											htmlFor: "shadow-preset",
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("presetLabel") }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
													id: "shadow-preset",
													value: "",
													disabled: busy,
													onChange: (event) => {
														const preset = SHADOW_TEMPLATES.find((template) => template.id === event.currentTarget.value);
														if (preset === void 0) return;
														setDefinitionEdit({
															...definitionEdit,
															prompt: preset.prompt,
															capture: preset.capture
														});
													},
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
														value: "",
														disabled: true,
														children: t("presetPlaceholder")
													}), SHADOW_TEMPLATES.map((template) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
														value: template.id,
														children: t(template.nameKey)
													}, template.id))]
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t("presetHint") })
											]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: ShadowMindSettingsTab_module_css_default.field,
											htmlFor: "shadow-name",
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("shadowName") }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													id: "shadow-name",
													type: "text",
													value: definitionEdit.name,
													disabled: busy,
													onChange: (event) => {
														setDefinitionEdit({
															...definitionEdit,
															name: event.currentTarget.value
														});
													}
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t("shadowNameHint") })
											]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Switch, {
											id: "shadow-collapsed-by-default",
											label: t("collapsedByDefault"),
											checked: collapsedByDefault,
											disabled: busy,
											onChange: (collapsed) => {
												run(async () => {
													await props.setCollapsedByDefault(collapsed);
												});
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", {
											className: ShadowMindSettingsTab_module_css_default.switchHint,
											children: t("collapsedByDefaultHint")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: `${ShadowMindSettingsTab_module_css_default.field} ${ShadowMindSettingsTab_module_css_default.fullSpan} ${ShadowMindSettingsTab_module_css_default.promptField}`,
											htmlFor: "shadow-prompt",
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("shadowPrompt") }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
													id: "shadow-prompt",
													value: definitionEdit.prompt,
													disabled: busy,
													onChange: (event) => {
														setDefinitionEdit({
															...definitionEdit,
															prompt: event.currentTarget.value
														});
													}
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t("shadowPromptHint") })
											]
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
									className: ShadowMindSettingsTab_module_css_default.disclosure,
									"data-shadow-advanced": true,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("advancedSettings") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: ShadowMindSettingsTab_module_css_default.grid,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
												className: `${ShadowMindSettingsTab_module_css_default.fieldset} ${ShadowMindSettingsTab_module_css_default.fullSpan}`,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", { children: t("runModel") }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														className: `${ShadowMindSettingsTab_module_css_default.grid} ${ShadowMindSettingsTab_module_css_default.stack}`,
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelRouteSelect, {
															catalog: catalog?.modelCatalog ?? null,
															disabled: busy,
															labels: {
																provider: t("providerLabel"),
																model: t("modelLabel"),
																effort: t("effortLabel")
															},
															value: {
																route: definitionEdit.runWithModel,
																effort: definitionEdit.reasoningEffort
															},
															onChange: (next) => {
																setDefinitionEdit({
																	...definitionEdit,
																	runWithModel: next.route,
																	reasoningEffort: next.effort
																});
															}
														})
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t("runModelHint") })
												]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: ShadowMindSettingsTab_module_css_default.field,
												htmlFor: "shadow-timeout",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("timeoutSeconds") }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
														id: "shadow-timeout",
														type: "text",
														value: definitionEdit.timeoutSeconds,
														disabled: busy,
														placeholder: defaultTimeoutSeconds === void 0 ? void 0 : String(defaultTimeoutSeconds),
														onChange: (event) => {
															setDefinitionEdit({
																...definitionEdit,
																timeoutSeconds: event.currentTarget.value
															});
														}
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: defaultTimeoutSeconds === void 0 ? t("timeoutSecondsHint") : t("timeoutSecondsInherit", {
														seconds: defaultTimeoutSeconds,
														minutes: Math.round(defaultTimeoutSeconds / 60)
													}) })
												]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: ShadowMindSettingsTab_module_css_default.field,
												htmlFor: "shadow-tools",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("tools") }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
														id: "shadow-tools",
														value: definitionEdit.tools,
														disabled: busy,
														onChange: (event) => {
															setDefinitionEdit({
																...definitionEdit,
																tools: event.currentTarget.value
															});
														}
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t("toolsHint") })
												]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: ShadowMindSettingsTab_module_css_default.field,
												htmlFor: "shadow-capture",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("capture") }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
														id: "shadow-capture",
														value: definitionEdit.capture,
														disabled: busy,
														onChange: (event) => {
															setDefinitionEdit({
																...definitionEdit,
																capture: event.currentTarget.value
															});
														},
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
															value: "full",
															children: "full"
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
															value: "since-compaction",
															children: "since-compaction"
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t("captureHint") })
												]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												className: ShadowMindSettingsTab_module_css_default.field,
												htmlFor: "shadow-context",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("context") }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
														id: "shadow-context",
														value: definitionEdit.context,
														disabled: busy,
														onChange: (event) => {
															setDefinitionEdit({
																...definitionEdit,
																context: event.currentTarget.value
															});
														},
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
															value: "standard",
															children: "standard"
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
															value: "minimal",
															children: "minimal"
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t("contextHint") })
												]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Switch, {
												id: "shadow-think-first",
												label: t("thinkFirst"),
												checked: definitionEdit.thinkFirst,
												disabled: busy,
												onChange: (thinkFirst) => {
													setDefinitionEdit({
														...definitionEdit,
														thinkFirst
													});
												}
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Switch, {
												id: "shadow-debug",
												label: t("debug"),
												checked: definitionEdit.debug,
												disabled: busy,
												onChange: (debug) => {
													setDefinitionEdit({
														...definitionEdit,
														debug
													});
												}
											})
										]
									})]
								}),
								legacyDefinitions.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: ShadowMindSettingsTab_module_css_default.legacyNote,
									"data-shadow-legacy": true,
									children: t("legacyDefinitions", {
										count: legacyDefinitions.length,
										ids: legacyDefinitions.map((definition) => definition.id).join(", ")
									})
								}),
								catalog === null || catalog.diagnostics.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: ShadowMindSettingsTab_module_css_default.error,
									"data-shadow-diagnostics": true,
									children: t("diagnosticsNotice", {
										count: catalog.diagnostics.length,
										paths: catalog.diagnostics.slice(0, 3).map((item) => item.path).join(", ")
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: ShadowMindSettingsTab_module_css_default.formActions,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										disabled: !definitionDirty || busy,
										onClick: discard,
										children: t("discard")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										disabled: !definitionDirty || validDefinition === void 0 || busy,
										onClick: save,
										children: t(busy ? "saving" : "saveShadow")
									})]
								})
							] })
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToastStack, {
						toasts,
						dismissLabel: t("toastDismiss"),
						onDismiss: dismiss
					})
				]
			});
		}
		/** Render the Settings page while containing component failures to its panel. */
		function ShadowMindSettingsTab(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ShadowMindSettingsTabBoundary, {
				failureTitle: props.t("renderErrorTitle"),
				failureHint: props.t("renderErrorHint"),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ShadowMindSettingsTabContent, { ...props })
			});
		}
		function escapeRegExp(value) {
			return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
		}
		function modelText(content) {
			let result = "";
			for (const block of content) {
				if (block.type !== "text") return null;
				result += block.text;
			}
			return result;
		}
		/**
		* Pair one relay's ordered provenance with its runtime-owned Markdown sections.
		* @param content Durable message content relayed to the root agent.
		* @param source Ordered Shadow provenance stored on the message.
		* @param relaySeq Durable relay sequence.
		* @returns Parsed reports, or null when content and provenance do not align.
		*/
		function projectShadowReports(content, source, relaySeq) {
			const text = modelText(content);
			if (text === null || source.reports.length === 0) return null;
			const markers = [];
			let cursor = 0;
			for (const report of source.reports) {
				const pattern = new RegExp(`\\n### ([^\\r\\n]+) \\(${escapeRegExp(report.shadowId)}\\)\\r?\\n`, "gu");
				pattern.lastIndex = cursor;
				const match = pattern.exec(text);
				if (match === null || match[1] === void 0) return null;
				markers.push({
					name: match[1].trim(),
					markerStart: match.index,
					bodyStart: pattern.lastIndex
				});
				cursor = pattern.lastIndex;
			}
			return source.reports.map((report, index) => {
				const marker = markers[index];
				if (marker === void 0) throw new Error("Shadow report marker projection lost ordering");
				const next = markers[index + 1];
				return {
					...report,
					name: marker.name,
					content: text.slice(marker.bodyStart, next?.markerStart ?? text.length).trim(),
					relaySeq
				};
			});
		}
		/** Merge live lifecycle state with durable report content, preferring the relay copy. */
		function projectReviewRuns(cycle, reports) {
			const durable = new Map(reports.map((report) => [report.runId, report]));
			const runs = (cycle?.runs ?? []).map((run) => {
				const report = durable.get(run.runId);
				if (report === void 0) return run;
				durable.delete(run.runId);
				return {
					...run,
					phase: "report",
					stage: "relay",
					childSessionId: report.childSessionId,
					content: report.content,
					relayed: true
				};
			});
			for (const report of durable.values()) runs.push({
				runId: report.runId,
				shadowId: report.shadowId,
				shadowName: report.name,
				capturedThroughSeq: report.capturedThroughSeq,
				phase: "report",
				stage: "relay",
				startedAt: "",
				childSessionId: report.childSessionId,
				content: report.content,
				relayed: true
			});
			return runs;
		}
		/** Materialize one candidate review row at its triggering root turn. */
		function buildShadowReviewChatNode(context) {
			const anchor = context.start;
			if (anchor === void 0) return null;
			return {
				key: context.key,
				kind: "shadow-mind-review",
				id: context.id,
				target: "chat",
				anchorSeq: anchor.event.seq,
				location: anchor.location,
				visibility: "visible",
				data: context.state
			};
		}
		const css = ".Fk1VjG_card{border:1px solid color-mix(in srgb, #7c3aed 28%, var(--dsw-alias-border-l3,#d1d5db));background:color-mix(in srgb, #7c3aed 4%, var(--dsw-alias-bg-base,#fff));border-radius:12px;overflow:hidden}[data-chat-flow-kind=shadow-mind-review]:has([data-shadow-review-empty]),[data-chat-flow-kind=shadow-mind-relay-marker]{display:none}[data-chat-flow-kind=context]:has(+[data-chat-flow-kind=shadow-mind-relay-marker]){display:none}.Fk1VjG_header{border-bottom:1px solid color-mix(in srgb, #7c3aed 18%, var(--dsw-alias-border-l3,#d1d5db));align-items:center;gap:10px;padding:12px 14px;display:flex}.Fk1VjG_headerTitle{align-items:baseline;gap:8px;min-width:0;display:flex}.Fk1VjG_header strong{color:var(--dsw-alias-label-primary,#111827);font-size:14px}.Fk1VjG_header span:not(.Fk1VjG_mark){color:var(--dsw-alias-label-tertiary,#6b7280);font-size:12px}.Fk1VjG_headerActions{flex:none;align-items:center;margin-left:auto;display:flex}.Fk1VjG_headerActions button{border:1px solid color-mix(in srgb, #7c3aed 32%, var(--dsw-alias-border-l3,#d1d5db));color:#6d28d9;cursor:pointer;background:0 0;border-radius:8px;padding:4px 10px;font-size:12px}.Fk1VjG_headerActions button:hover:not(:disabled){background:#7c3aed1a}.Fk1VjG_headerActions button:disabled{opacity:.55;cursor:default}.Fk1VjG_headerActions button:focus-visible{outline-offset:2px;outline:2px solid #7c3aed}.Fk1VjG_mark{color:#fff;background:#7c3aed;border-radius:8px;place-items:center;width:24px;height:24px;font-size:12px;font-weight:700;display:grid}.Fk1VjG_toggle{width:26px;height:26px;color:var(--dsw-alias-label-tertiary,#6b7280);cursor:pointer;background:0 0;border:none;border-radius:8px;flex:none;place-items:center;padding:0;display:grid}.Fk1VjG_toggle svg{transition:transform .15s}.Fk1VjG_toggleExpanded svg{transform:rotate(90deg)}.Fk1VjG_toggle:hover{color:#6d28d9;background:#7c3aed1a}.Fk1VjG_toggle:focus-visible{outline-offset:2px;outline:2px solid #7c3aed}.Fk1VjG_warning{border-bottom:1px solid color-mix(in srgb, #d97706 22%, var(--dsw-alias-border-l3,#d1d5db));color:var(--dsw-alias-label-secondary,#374151);background:#f59e0b1a;align-items:center;gap:9px;padding:10px 14px;font-size:12px;display:flex}.Fk1VjG_spinner{border:2px solid #7c3aed3d;border-top-color:#7c3aed;border-radius:999px;width:12px;height:12px;animation:.8s linear infinite Fk1VjG_shadow-spin}@keyframes Fk1VjG_shadow-spin{to{transform:rotate(360deg)}}.Fk1VjG_runs{display:grid}.Fk1VjG_run{gap:10px;padding:14px;display:grid}.Fk1VjG_run+.Fk1VjG_run{border-top:1px solid var(--dsw-alias-border-l3,#e5e7eb)}.Fk1VjG_runHeader{justify-content:space-between;align-items:center;gap:8px;display:flex}.Fk1VjG_runHeader>div{flex-wrap:wrap;align-items:center;gap:8px;display:flex}.Fk1VjG_runHeader strong{color:var(--dsw-alias-label-primary,#111827);font-size:14px}.Fk1VjG_runHeader code,.Fk1VjG_meta code{color:#6d28d9;background:#7c3aed1a;border-radius:5px;padding:1px 6px;font-size:11px}.Fk1VjG_phase{color:#6d28d9;background:#7c3aed1a;border-radius:999px;flex:none;padding:2px 8px;font-size:11px;font-weight:600}.Fk1VjG_message,.Fk1VjG_error{color:var(--dsw-alias-label-secondary,#374151);margin:0;font-size:13px;line-height:1.6}.Fk1VjG_error{color:var(--dsw-alias-danger,#b91c1c);overflow-wrap:anywhere}.Fk1VjG_content{min-width:0;color:var(--dsw-alias-label-secondary,#374151);overflow-wrap:anywhere;font-size:13px;line-height:1.6}.Fk1VjG_meta{color:var(--dsw-alias-label-tertiary,#6b7280);flex-wrap:wrap;gap:8px 14px;font-size:11px;display:flex}.Fk1VjG_meta button{min-width:0;color:inherit;font:inherit;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;background:0 0;border:none;padding:0;overflow:hidden}.Fk1VjG_meta button:hover{color:var(--dsw-alias-label-secondary,#374151);text-decoration:underline}.Fk1VjG_meta button:focus-visible{outline-offset:2px;border-radius:4px;outline:2px solid #7c3aed}.Fk1VjG_relay{color:var(--dsw-alias-label-tertiary,#6b7280);align-items:center;gap:7px;font-size:12px;line-height:20px;display:flex}.Fk1VjG_dot{background:#7c3aed;border-radius:999px;width:6px;height:6px;box-shadow:0 0 0 3px #7c3aed24}";
		const tagId = "@whutzefengxie-ops/dsh-shadow-mind/ShadowReportCard.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@whutzefengxie-ops/dsh-shadow-mind";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var ShadowReportCard_module_css_default = {
			"card": "Fk1VjG_card",
			"content": "Fk1VjG_content",
			"dot": "Fk1VjG_dot",
			"error": "Fk1VjG_error",
			"header": "Fk1VjG_header",
			"headerActions": "Fk1VjG_headerActions",
			"headerTitle": "Fk1VjG_headerTitle",
			"mark": "Fk1VjG_mark",
			"message": "Fk1VjG_message",
			"meta": "Fk1VjG_meta",
			"phase": "Fk1VjG_phase",
			"relay": "Fk1VjG_relay",
			"run": "Fk1VjG_run",
			"runHeader": "Fk1VjG_runHeader",
			"runs": "Fk1VjG_runs",
			"shadow-spin": "Fk1VjG_shadow-spin",
			"spinner": "Fk1VjG_spinner",
			"toggle": "Fk1VjG_toggle",
			"toggleExpanded": "Fk1VjG_toggleExpanded",
			"warning": "Fk1VjG_warning"
		};
		function phaseLabel(phase, t) {
			switch (phase) {
				case "running": return t("reviewRunning");
				case "report": return t("reviewReport");
				case "silent": return t("reviewSilent");
				case "not_relevant": return t("reviewNotRelevant");
				case "aborted": return t("reviewAborted");
				case "failed": return t("reviewFailed");
			}
		}
		function markdownLabels(t) {
			return {
				code: {
					copyLabel: t("copy"),
					copiedLabel: t("copied")
				},
				footnotes: t("markdown.footnotes")
			};
		}
		function RunBody({ run, t }) {
			if (run.phase === "running") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: ShadowReportCard_module_css_default.message,
				children: t("reviewRunningDetail")
			});
			if (run.phase === "report") return run.content === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: ShadowReportCard_module_css_default.message,
				children: t("reportWaitingRelay")
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: ShadowReportCard_module_css_default.content,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, {
					text: run.content,
					labels: markdownLabels(t)
				})
			});
			if (run.phase === "silent") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: ShadowReportCard_module_css_default.message,
				children: t("reviewSilentDetail")
			});
			if (run.phase === "not_relevant") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: ShadowReportCard_module_css_default.message,
				children: t("reviewNotRelevantDetail")
			});
			if (run.phase === "aborted") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: ShadowReportCard_module_css_default.message,
				children: t("reviewAbortedDetail")
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: ShadowReportCard_module_css_default.message,
				children: t("reviewFailedDetail")
			});
		}
		/** Display a running placeholder and update the same row to every terminal phase. */
		function ShadowReportCard({ node, sessionId, openSession, useCycle, useStatus, retry, pause, resume, poke, useCollapsedByDefault, t }) {
			const capturedThroughSeq = node.data.capturedThroughSeq;
			const cycle = useCycle(sessionId, capturedThroughSeq);
			const status = useStatus(sessionId);
			const runs = projectReviewRuns(cycle, node.data.reports);
			const collapsedByDefault = useCollapsedByDefault();
			const [manualCollapsed, setManualCollapsed] = (0, react.useState)(null);
			const collapsed = manualCollapsed ?? collapsedByDefault;
			const toggleCollapsed = () => {
				setManualCollapsed((current) => {
					const next = current === null ? !collapsedByDefault : !current;
					return next === collapsedByDefault ? null : next;
				});
			};
			const [retryingRun, setRetryingRun] = (0, react.useState)(null);
			const [retryError, setRetryError] = (0, react.useState)(null);
			const [pausing, setPausing] = (0, react.useState)(false);
			const [pauseError, setPauseError] = (0, react.useState)(null);
			if (runs.length === 0 && cycle?.failure === void 0 && cycle?.scheduling !== true) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				hidden: true,
				"data-shadow-review-empty": true
			});
			const running = cycle?.scheduling === true || runs.some((run) => run.phase === "running");
			const paused = status?.paused === true;
			const runRetry = (runId) => {
				setRetryingRun(runId);
				setRetryError(null);
				retry(sessionId, runId).then(() => {
					poke(sessionId);
				}, (error) => {
					setRetryError(error instanceof Error ? error.message : String(error));
				}).finally(() => {
					setRetryingRun(null);
				});
			};
			const runPauseToggle = () => {
				setPausing(true);
				setPauseError(null);
				(paused ? resume(sessionId) : pause(sessionId)).then(() => {
					poke(sessionId);
				}, (error) => {
					setPauseError(error instanceof Error ? error.message : String(error));
				}).finally(() => {
					setPausing(false);
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: ShadowReportCard_module_css_default.card,
				"data-shadow-review-card": true,
				"data-shadow-card-collapsed": collapsed || void 0,
				"aria-live": running ? "polite" : void 0,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: ShadowReportCard_module_css_default.header,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ShadowReportCard_module_css_default.mark,
								"aria-hidden": true,
								children: "S"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ShadowReportCard_module_css_default.headerTitle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("reviewCardTitle") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("reviewRunCount", { count: runs.length }) })]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: ShadowReportCard_module_css_default.headerActions,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									disabled: pausing,
									"aria-label": paused ? t("resumeReview") : t("pauseReview"),
									"data-shadow-pause-toggle": true,
									onClick: runPauseToggle,
									children: pausing ? t("pausePending") : t(paused ? "resumeReview" : "pauseReview")
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: `${ShadowReportCard_module_css_default.toggle} ${collapsed ? "" : ShadowReportCard_module_css_default.toggleExpanded}`,
								"aria-expanded": !collapsed,
								"aria-label": t(collapsed ? "expandCard" : "collapseCard"),
								title: t(collapsed ? "expandCard" : "collapseCard"),
								"data-shadow-card-toggle": true,
								onClick: toggleCollapsed,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTriangleRightFill14, {})
							})
						]
					}),
					running ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ShadowReportCard_module_css_default.warning,
						role: "status",
						"data-shadow-running-warning": true,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: ShadowReportCard_module_css_default.spinner,
							"aria-hidden": true
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("reviewInputWarning") })]
					}) : null,
					paused ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ShadowReportCard_module_css_default.warning,
						role: "status",
						"data-shadow-review-paused": true,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("reviewPaused") })
					}) : null,
					pauseError === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: ShadowReportCard_module_css_default.error,
						children: [
							t("pauseError"),
							": ",
							pauseError
						]
					}),
					cycle?.failure === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
						className: ShadowReportCard_module_css_default.run,
						"data-shadow-run-phase": "failed",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ShadowReportCard_module_css_default.runHeader,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("reviewScheduling") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: ShadowReportCard_module_css_default.phase,
									children: t("reviewFailed")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: ShadowReportCard_module_css_default.message,
								children: cycle.failure.error.message
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ShadowReportCard_module_css_default.meta,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: cycle.failure.reasonCode }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
									t("reviewStage"),
									": ",
									cycle.failure.stage
								] })]
							})
						]
					}),
					cycle?.scheduling !== true || runs.length > 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
						className: ShadowReportCard_module_css_default.run,
						"data-shadow-run-phase": "running",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ShadowReportCard_module_css_default.runHeader,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("reviewScheduling") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: ShadowReportCard_module_css_default.phase,
								children: t("reviewRunning")
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: ShadowReportCard_module_css_default.message,
							children: t("reviewSchedulingDetail")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ShadowReportCard_module_css_default.runs,
						children: runs.map((run) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
							className: ShadowReportCard_module_css_default.run,
							"data-shadow-run-phase": run.phase,
							"data-shadow-run-collapsed": collapsed || void 0,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: ShadowReportCard_module_css_default.runHeader,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: run.shadowName }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: run.shadowId })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ShadowReportCard_module_css_default.phase,
										children: phaseLabel(run.phase, t)
									})]
								}),
								collapsed ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RunBody, {
									run,
									t
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: ShadowReportCard_module_css_default.meta,
									children: [
										run.childSessionId === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											title: run.childSessionId,
											"aria-label": t("openChildSession", { id: run.childSessionId }),
											onClick: () => {
												openSession(run.childSessionId);
											},
											children: [
												t("childSession"),
												": ",
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: run.childSessionId })
											]
										}),
										run.phase === "failed" || run.phase === "aborted" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											disabled: retryingRun !== null || running,
											"data-shadow-retry": true,
											onClick: () => {
												runRetry(run.runId);
											},
											children: retryingRun === run.runId ? t("retrying") : t("retryRun")
										}) : null,
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("reportCapturedSeq", { seq: run.capturedThroughSeq }) }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
											t("reviewStage"),
											": ",
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: run.stage })
										] }),
										run.reasonCode === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
											t("reviewReason"),
											": ",
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: run.reasonCode })
										] }),
										run.providerStopReason === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
											t("reviewProviderStop"),
											": ",
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: run.providerStopReason })
										] })
									]
								}),
								retryError === null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									className: ShadowReportCard_module_css_default.error,
									children: [
										t("retryError"),
										": ",
										retryError
									]
								}),
								run.error === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									className: ShadowReportCard_module_css_default.error,
									children: [
										run.error.name,
										": ",
										run.error.message
									]
								}),
								run.phase !== "report" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", {
									className: ShadowReportCard_module_css_default.relay,
									"data-shadow-relayed": run.relayed === true ? "true" : "false",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ShadowReportCard_module_css_default.dot,
										"aria-hidden": true
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t(run.relayed === true ? "relayedToRoot" : "reportWaitingRelay") })]
								})
							]
						}, run.runId))
					})
				]
			});
		}
		/** Render no content; the row exists so its adjacent Context node can be hidden. */
		function ShadowRelayMarker(_props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				hidden: true,
				"data-shadow-relay-marker": true
			});
		}
		/**
		* Surface layer on top of the session event log: an ordered view of events
		* that produce LLM messages. The append-only log remains the source of truth.
		*
		* Browser-safe: web clients consume this subpath export, so it must stay free
		* of `node:` imports (they break the vite bundle).
		*
		* @module @deepseek-ai/dsh-session/surface
		*/
		/** Runtime counterpart of the message-producing event union. */
		const SURFACE_EVENT_TYPES = /* @__PURE__ */ new Set([
			"user/message",
			"assistant/message",
			"tool/result"
		]);
		/**
		* Narrow an event to a surface-eligible event carrying its required marker.
		* @param event - event to test.
		* @returns true when both the type and marker identify a surface event.
		*/
		function isSurfaceEvent(event) {
			if (!SURFACE_EVENT_TYPES.has(event.type)) return false;
			return event.surfaceOp !== void 0;
		}
		/**
		* Narrow an event to an append-origin surface event: one that entered the
		* surface at its own log position and was never itself a replacement copy.
		*
		* The model-visible surface deliberately shadows replaced ranges, so it is the
		* wrong source for a human transcript — a landed replacement would erase
		* conversation the user already saw. Append-origin events are that transcript's
		* durable source material; replacement copies stay model-only.
		* @param event - event to test.
		* @returns true when the event appended to the surface tail.
		*/
		function isAppendSurfaceEvent(event) {
			return isSurfaceEvent(event) && event.surfaceOp === "append";
		}
		/** Anchor one candidate review row where its root turn completed and fold a later relay into it. */
		const shadowReviewDefinition = {
			kind: "shadow-mind-review",
			target: "chat",
			match: (event) => {
				if (event.type === "turn/end" && event.data.reason.kind === "completed") return {
					id: String(event.seq),
					role: "start"
				};
				if (event.type !== "user/message" || !isAppendSurfaceEvent(event) || event.data.source.kind !== "shadow-report") return null;
				const captured = event.data.source.reports[0]?.capturedThroughSeq;
				if (captured === void 0 || event.data.source.reports.some((report) => report.capturedThroughSeq !== captured)) return null;
				return {
					id: String(captured),
					role: "update"
				};
			},
			start: (_context, match) => {
				if (match.event.type !== "turn/end") throw new Error("shadow-mind-review start requires a completed turn/end");
				return {
					capturedThroughSeq: match.event.seq,
					reports: []
				};
			},
			update: (context, match) => {
				if (match.event.type !== "user/message" || match.event.data.source.kind !== "shadow-report") return context.state;
				const reports = projectShadowReports(match.event.data.content, match.event.data.source, match.event.seq);
				return reports === null ? context.state : {
					...context.state,
					reports
				};
			},
			buildViewNode: buildShadowReviewChatNode
		};
		/** Retain one zero-height node beside a relay so CSS can suppress its generic Context row. */
		const shadowRelayMarkerDefinition = {
			kind: "shadow-mind-relay-marker",
			target: "chat",
			match: (event) => event.type === "user/message" && isAppendSurfaceEvent(event) && event.data.source.kind === "shadow-report" ? {
				id: String(event.data.id),
				role: "start"
			} : null,
			start: () => ({}),
			update: (context) => context.state,
			buildViewNode: (context) => context.start === void 0 ? null : {
				key: context.key,
				kind: "shadow-mind-relay-marker",
				id: context.id,
				target: "chat",
				anchorSeq: context.start.event.seq,
				location: context.start.location,
				visibility: "visible",
				data: {}
			}
		};
		const POLL_INTERVAL_MS = 500;
		const EMPTY_CYCLES = Object.freeze([]);
		/** One deduplicated Remote poller per mounted root session. */
		var ShadowReviewStore = class {
			load;
			loadStatus;
			sessions = /* @__PURE__ */ new Map();
			disposed = false;
			/** @param load Remote cycle snapshot loader. @param loadStatus Remote status loader. */
			constructor(load, loadStatus) {
				this.load = load;
				this.loadStatus = loadStatus;
			}
			/** Read the reference-stable cycle snapshot for React. */
			snapshot(sessionId) {
				return this.sessions.get(sessionId)?.snapshot ?? EMPTY_CYCLES;
			}
			/** Read the reference-stable orchestration status for React. */
			status(sessionId) {
				return this.sessions.get(sessionId)?.status;
			}
			/** Trigger an immediate refresh for one session (e.g. after a manual retry or pause). */
			poke(sessionId) {
				const entry = this.sessions.get(sessionId);
				if (entry === void 0 || this.disposed) return;
				entry.timer = setTimeout(() => {
					entry.timer = void 0;
					this.refresh(sessionId, entry);
				}, 0);
			}
			/** Subscribe one view and refresh immediately; concurrent mounts share one request. */
			subscribe(sessionId, listener) {
				const entry = this.entry(sessionId);
				entry.listeners.add(listener);
				this.refresh(sessionId, entry);
				return () => {
					entry.listeners.delete(listener);
					if (entry.listeners.size !== 0) return;
					if (entry.timer !== void 0) clearTimeout(entry.timer);
					this.sessions.delete(sessionId);
				};
			}
			/** Stop every timer and ignore later Remote settlements. */
			dispose() {
				this.disposed = true;
				for (const entry of this.sessions.values()) if (entry.timer !== void 0) clearTimeout(entry.timer);
				this.sessions.clear();
			}
			entry(sessionId) {
				const current = this.sessions.get(sessionId);
				if (current !== void 0) return current;
				const created = {
					snapshot: EMPTY_CYCLES,
					status: void 0,
					listeners: /* @__PURE__ */ new Set(),
					inFlight: void 0,
					statusInFlight: void 0,
					timer: void 0
				};
				this.sessions.set(sessionId, created);
				return created;
			}
			refresh(sessionId, entry) {
				if (this.disposed) return Promise.resolve();
				this.refreshStatus(sessionId, entry);
				if (entry.inFlight !== void 0) return entry.inFlight;
				const request = this.load(sessionId).then((cycles) => {
					if (this.disposed || this.sessions.get(sessionId) !== entry) return;
					entry.snapshot = Object.freeze([...cycles]);
					for (const listener of entry.listeners) listener();
					if (this.unsettled(cycles) && entry.listeners.size > 0) this.schedule(sessionId, entry);
				}, () => {
					if (!this.disposed && this.sessions.get(sessionId) === entry && entry.listeners.size > 0 && this.unsettled(entry.snapshot)) this.schedule(sessionId, entry);
				}).finally(() => {
					if (entry.inFlight === request) entry.inFlight = void 0;
				});
				entry.inFlight = request;
				return request;
			}
			/** Load the pause/resume-aware status snapshot once per in-flight window. */
			refreshStatus(sessionId, entry) {
				if (this.disposed) return Promise.resolve();
				if (entry.statusInFlight !== void 0) return entry.statusInFlight;
				const request = this.loadStatus(sessionId).then((status) => {
					if (this.disposed || this.sessions.get(sessionId) !== entry) return;
					entry.status = status;
					for (const listener of entry.listeners) listener();
				}, () => {}).finally(() => {
					if (entry.statusInFlight === request) entry.statusInFlight = void 0;
				});
				entry.statusInFlight = request;
				return request;
			}
			schedule(sessionId, entry) {
				if (entry.timer !== void 0) clearTimeout(entry.timer);
				entry.timer = setTimeout(() => {
					entry.timer = void 0;
					this.refresh(sessionId, entry);
				}, POLL_INTERVAL_MS);
			}
			unsettled(cycles) {
				return cycles.some((cycle) => cycle.scheduling || cycle.runs.some((run) => run.phase === "running" || run.phase === "report" && run.relayed !== true));
			}
		};
		/** Select one anchored cycle through React's external-store protocol. */
		function useShadowReviewCycle(store, sessionId, capturedThroughSeq) {
			const subscribe = (0, react.useCallback)((listener) => store.subscribe(sessionId, listener), [store, sessionId]);
			const getSnapshot = (0, react.useCallback)(() => store.snapshot(sessionId), [store, sessionId]);
			return (0, react.useSyncExternalStore)(subscribe, getSnapshot, getSnapshot).find((cycle) => cycle.capturedThroughSeq === capturedThroughSeq);
		}
		/** Select the pause/resume-aware orchestration status for one session. */
		function useShadowMindStatus(store, sessionId) {
			const subscribe = (0, react.useCallback)((listener) => store.subscribe(sessionId, listener), [store, sessionId]);
			const getSnapshot = (0, react.useCallback)(() => store.status(sessionId), [store, sessionId]);
			return (0, react.useSyncExternalStore)(subscribe, getSnapshot, getSnapshot);
		}
		/** Shadow report card presentation preferences mirrored from the Host settings document. */
		/**
		* Settings namespace owning the card presentation preference. The Host runtime
		* registers this namespace as `SHADOW_MIND_SETTINGS_NAMESPACE`; the client
		* bundle must not import the runtime module, so the string is mirrored here.
		*/
		const SHADOW_MIND_CARD_SETTINGS_NAMESPACE = "shadow-mind";
		/** Field carrying whether new Shadow report cards start collapsed. */
		const COLLAPSED_BY_DEFAULT_FIELD = "collapsedByDefault";
		/**
		* Select the collapsed-by-default preference through React's external-store
		* protocol. Falls back to the collapsed default while the Host settings mirror
		* is loading or unavailable, so cards never block on the settings transport.
		* @param scope - the bound Shadow Mind settings namespace scope.
		* @returns the current collapsed-by-default preference.
		*/
		function useCardCollapsedByDefault(scope) {
			const subscribe = (0, react.useCallback)((listener) => scope.subscribe(listener), [scope]);
			const getSnapshot = (0, react.useCallback)(() => scope.getSnapshot().value?.collapsedByDefault ?? true, [scope]);
			return (0, react.useSyncExternalStore)(subscribe, getSnapshot, getSnapshot);
		}
		/** Simplified Chinese dictionary and locale key source. */
		const zh = {
			tab: "Shadow Mind",
			title: "Shadow Mind",
			intro: "一个后台 Shadow 审查者：完成轮次按设定概率启动，用全新的只读子会话独立复查主 agent 的工作并回传结论。",
			commandCompleted: "Shadow Mind 命令已完成。",
			reportCardTitle: "Shadow Mind 报告",
			reviewCardTitle: "Shadow Mind 审查",
			reviewRunCount: "{count} 个 Shadow",
			expandCard: "展开报告内容",
			collapseCard: "收起报告内容",
			collapsedByDefault: "默认收起审查报告",
			collapsedByDefaultHint: "新生成的审查卡片默认只展示 Shadow 名称、运行状态和子会话信息，报告内容需手动展开。",
			reviewRunning: "审查中",
			reviewReport: "报告",
			reviewSilent: "静默完成",
			reviewNotRelevant: "无需审查",
			reviewAborted: "已中断",
			reviewFailed: "失败",
			reviewRunningDetail: "Shadow agent 正在独立检查本轮结果。",
			reviewInputWarning: "Shadow 正在审查；此时发送新消息会取消本轮审查。",
			reviewSilentDetail: "Shadow 已正常完成，但没有需要回传给主 agent 的内容。",
			reviewNotRelevantDetail: "Shadow 已正常完成，判定本轮内容与其职责不相关。",
			reviewAbortedDetail: "Shadow 审查在完成前被中断，具体原因见下方原因码。",
			reviewFailedDetail: "Shadow 审查未正常完成，具体阶段和错误见下方诊断。",
			retryRun: "重试",
			retrying: "重试中…",
			retryError: "重试失败",
			pauseReview: "暂停审查",
			resumeReview: "继续审查",
			pausePending: "处理中…",
			pauseError: "暂停操作失败",
			reviewPaused: "Shadow 审查已暂停；新消息不会触发审查，点击「继续审查」恢复。",
			reviewScheduling: "Shadow 调度",
			reviewSchedulingDetail: "正在加载定义并决定本轮是否运行 Shadow agent。",
			reviewStage: "阶段",
			reviewReason: "原因",
			reviewProviderStop: "Provider 终态",
			reportWaitingRelay: "审查报告已生成，正在等待回传给主 agent。",
			reportCountOne: "{count} 份报告",
			reportCountOther: "{count} 份报告",
			openChildSession: "打开子会话 {id}",
			reportCapturedSeq: "主会话截取序号 {seq}",
			relayedToRoot: "Shadow Mind 审查意见已回传给主 agent",
			childSession: "子会话",
			shadowCardTitle: "Shadow 审查",
			shadowCardDescription: "每个完成且使用过工具的轮次，按下方概率决定是否启动一次独立审查。",
			shadowOn: "已开启",
			shadowOff: "已关闭",
			triggerProbability: "触发概率",
			triggerProbabilityHint: "每轮触发审查的概率，范围 10%–100%。审查使用全新的只读子会话，不会看到主 agent 的隐藏推理。",
			presetLabel: "审查风格预设",
			presetPlaceholder: "选择预设以预填职责提示词…",
			presetHint: "选择后会用对应职责提示词覆盖下方内容，保存后才生效。",
			shadowName: "名称",
			shadowNameHint: "显示在报告卡片中的审查者名称。",
			shadowPrompt: "职责提示词",
			shadowPromptHint: "描述要检查什么，以及何时返回 report、silent 或 not_relevant。",
			lastRunSummary: "最近一次审查：{outcome} · {time}",
			advancedSettings: "高级设置",
			runModel: "运行模型",
			runModelHint: "留空表示沿用主 agent 的模型与默认思考强度。",
			timeoutSeconds: "超时（秒）",
			timeoutSecondsHint: "可选正数；留空使用全局默认值。",
			timeoutSecondsInherit: "留空使用全局默认值：{seconds} 秒（{minutes} 分钟）。",
			tools: "额外工具",
			toolsHint: "每行一个工具名，会加入默认 read、grep、glob allowlist。写工具仍受继承的沙箱限制。",
			capture: "轨迹截取",
			captureHint: "full 使用完整轨迹；since-compaction 从最近成功压缩开始。",
			context: "上下文继承",
			contextHint: "minimal 移除模型可见的动态运行时上下文。",
			thinkFirst: "先思考再调查",
			debug: "记录运行生命周期诊断",
			legacyDefinitions: "发现 {count} 个旧定义文件（只读保留，不再参与调度）：{ids}。如需清理请直接编辑定义目录。",
			diagnosticsNotice: "{count} 个定义文件存在问题、已被忽略：{paths}",
			discard: "放弃修改",
			saveShadow: "保存",
			saving: "保存中…",
			saved: "已保存并生效",
			loadError: "无法读取 Shadow Mind 数据。",
			noDefaultDefinition: "默认 Shadow 定义尚未生成，请点击「刷新」重试。",
			renderErrorTitle: "Shadow Mind 页面渲染失败。",
			renderErrorHint: "请刷新页面；若问题持续，请保留下方错误信息。",
			operationFailed: "操作失败",
			errorNotWritable: "保存失败：当前设置不可写。",
			errorHoldout: "保存失败：holdout 脱敏需要操作方手工维护的侧车文件，请编辑定义文件或联系操作方。",
			errorAlreadyExists: "保存失败：目标定义已存在。",
			toastDismiss: "关闭通知",
			refresh: "刷新",
			outcomeReport: "报告已回传",
			outcomeSilent: "无需补充",
			outcomeNotRelevant: "与职责不相关",
			outcomeAborted: "运行已中断",
			outcomeFailed: "运行失败",
			providerLabel: "供应商",
			modelLabel: "模型",
			effortLabel: "思考强度",
			templateNameContrarian: "反方审查",
			templateDescriptionContrarian: "挑战根 agent 最强的结论，优先寻找具体反例。",
			templateNameHacker: "故障路径审查",
			templateDescriptionHacker: "检查失败处理、重试与异常路径，报告中注明探针类别。",
			templateNameResearcher: "证据审计",
			templateDescriptionResearcher: "核对每个结论是否被轨迹证据支持，把缺失数据视为证据缺口。",
			templateNameSimplifier: "简化审查",
			templateDescriptionSimplifier: "仅在轨迹能证明时指出重复劳动或不必要的机制。",
			templateNameArchitect: "一致性审查",
			templateDescriptionArchitect: "检查跨步骤一致性、陈旧读取与结论-证据矛盾。",
			templateNameImplementationReviewer: "实现质量审查",
			templateDescriptionImplementationReviewer: "核对需求覆盖、实现缺陷、验证声明与证据一致性。"
		};
		/** English dictionary checked against the Chinese key set. */
		const en = {
			tab: "Shadow Mind",
			title: "Shadow Mind",
			intro: "One background Shadow reviewer: completed turns trigger an independent read-only re-review at the configured probability, and findings are relayed to the root agent.",
			commandCompleted: "Shadow Mind command completed.",
			reportCardTitle: "Shadow Mind reports",
			reviewCardTitle: "Shadow Mind review",
			reviewRunCount: "{count} Shadows",
			expandCard: "Expand report content",
			collapseCard: "Collapse report content",
			collapsedByDefault: "Collapse review reports by default",
			collapsedByDefaultHint: "New review cards show only the Shadow name, run status, and child session; the report content stays collapsed until expanded manually.",
			reviewRunning: "Reviewing",
			reviewReport: "Report",
			reviewSilent: "Silent completion",
			reviewNotRelevant: "Not relevant",
			reviewAborted: "Aborted",
			reviewFailed: "Failed",
			reviewRunningDetail: "A Shadow agent is independently reviewing this turn.",
			reviewInputWarning: "Shadow is reviewing. Sending a new message now cancels this review.",
			reviewSilentDetail: "The Shadow completed normally and had nothing to relay to the root agent.",
			reviewNotRelevantDetail: "The Shadow completed normally and found this turn outside its responsibility.",
			reviewAbortedDetail: "The Shadow stopped before completion. See the reason code below.",
			reviewFailedDetail: "The Shadow did not complete normally. See the stage and diagnostic below.",
			retryRun: "Retry",
			retrying: "Retrying…",
			retryError: "Retry failed",
			pauseReview: "Pause review",
			resumeReview: "Resume review",
			pausePending: "Updating…",
			pauseError: "Pause action failed",
			reviewPaused: "Shadow review is paused; new messages will not trigger a review. Click Resume review to re-enable.",
			reviewScheduling: "Shadow scheduling",
			reviewSchedulingDetail: "Loading the definition and deciding whether this turn runs a Shadow agent.",
			reviewStage: "Stage",
			reviewReason: "Reason",
			reviewProviderStop: "Provider stop",
			reportWaitingRelay: "The review report is ready and waiting to be relayed to the root agent.",
			reportCountOne: "{count} report",
			reportCountOther: "{count} reports",
			openChildSession: "Open child session {id}",
			reportCapturedSeq: "Root capture sequence {seq}",
			relayedToRoot: "Shadow Mind review relayed to the root agent",
			childSession: "Child session",
			shadowCardTitle: "Shadow review",
			shadowCardDescription: "Each completed tool-using turn starts one independent review with the probability below.",
			shadowOn: "Enabled",
			shadowOff: "Disabled",
			triggerProbability: "Trigger probability",
			triggerProbabilityHint: "Probability from 10% to 100% that a turn triggers a review. Reviews use a fresh read-only child session without the root's hidden reasoning.",
			presetLabel: "Review style preset",
			presetPlaceholder: "Choose a preset to pre-fill the duty prompt…",
			presetHint: "Choosing a preset overwrites the duty prompt below; nothing applies until you save.",
			shadowName: "Name",
			shadowNameHint: "The reviewer name shown on report cards.",
			shadowPrompt: "Duty prompt",
			shadowPromptHint: "Describe what to inspect and when to return report, silent, or not_relevant.",
			lastRunSummary: "Latest review: {outcome} · {time}",
			advancedSettings: "Advanced settings",
			runModel: "Execution model",
			runModelHint: "Leave empty to inherit the root agent's model and default reasoning effort.",
			timeoutSeconds: "Timeout (seconds)",
			timeoutSecondsHint: "Optional positive number. Empty uses the global default.",
			timeoutSecondsInherit: "Empty uses the global default: {seconds}s ({minutes} minutes).",
			tools: "Additional tools",
			toolsHint: "One tool name per line, added to the read, grep, and glob allowlist. Write tools remain confined by the inherited sandbox.",
			capture: "Trajectory capture",
			captureHint: "full uses the entire trajectory; since-compaction starts at the latest successful compaction.",
			context: "Context inheritance",
			contextHint: "minimal removes model-visible dynamic runtime context.",
			thinkFirst: "Think before investigating",
			debug: "Record run lifecycle diagnostics",
			legacyDefinitions: "Found {count} legacy definition files (kept read-only, no longer scheduled): {ids}. Edit the definition directory directly to clean them up.",
			diagnosticsNotice: "{count} definition files have problems and were ignored: {paths}",
			discard: "Discard changes",
			saveShadow: "Save",
			saving: "Saving…",
			saved: "Saved and applied",
			loadError: "Shadow Mind data is unavailable.",
			noDefaultDefinition: "The default Shadow definition has not been generated yet; click Refresh to retry.",
			renderErrorTitle: "Shadow Mind failed to render.",
			renderErrorHint: "Refresh the page. If the problem continues, retain the error below.",
			operationFailed: "Operation failed",
			errorNotWritable: "Save failed: the current settings are not writable.",
			errorHoldout: "Save failed: holdout redaction needs an operator-managed sidecar file; edit the definition file directly or contact the operator.",
			errorAlreadyExists: "Save failed: the target definition already exists.",
			toastDismiss: "Dismiss notification",
			refresh: "Refresh",
			outcomeReport: "Report relayed",
			outcomeSilent: "No additional finding",
			outcomeNotRelevant: "Not relevant",
			outcomeAborted: "Run aborted",
			outcomeFailed: "Run failed",
			providerLabel: "Provider",
			modelLabel: "Model",
			effortLabel: "Reasoning effort",
			templateNameContrarian: "Contrarian review",
			templateDescriptionContrarian: "Challenges the strongest root claim and prefers concrete counterexamples.",
			templateNameHacker: "Failure-path review",
			templateDescriptionHacker: "Inspects failure handling, retries, and exception paths; names the probe class in reports.",
			templateNameResearcher: "Evidence audit",
			templateDescriptionResearcher: "Checks whether every conclusion is supported by trajectory evidence and treats omitted data as an evidence gap.",
			templateNameSimplifier: "Simplification review",
			templateDescriptionSimplifier: "Points out repeated work or unnecessary mechanisms only when the trajectory proves them.",
			templateNameArchitect: "Consistency review",
			templateDescriptionArchitect: "Inspects cross-step consistency, stale reads, and conclusion-evidence contradictions.",
			templateNameImplementationReviewer: "Implementation review",
			templateDescriptionImplementationReviewer: "Checks requirement coverage, implementation defects, verification claims, and evidence consistency."
		};
		/** Dictionary namespace owned by this plugin. */
		const NS = "settings.shadowMind";
		/** Bridge `ctx.sessions` to the client session service face. */
		function clientSessions(ctx) {
			return ctx.sessions;
		}
		/** Services required by the Settings tab, Remote methods, and slash-command acknowledgment. */
		const inject = [
			"slots",
			"locale",
			"sessions",
			"remote",
			"uiConversation",
			"settingsScope"
		];
		/** Unwrap one generated Remote business result. */
		async function remoteValue(operation, request) {
			const result = await request;
			if (!result.ok) throw new Error(`${operation} failed: ${result.error.code}: ${result.error.message}`);
			return result.value;
		}
		/** Mount the Shadow Mind Settings tab and visible slash-command acknowledgment. */
		async function apply(ctx) {
			const unmountRemote = await ctx.remote.$mount(TYPERT_REMOTE);
			ctx.effect(() => unmountRemote, "ui-shadow-mind: remote contribution");
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-shadow-mind: dictionaries");
			const t = ctx.locale.bind(NS);
			const cardSettings = ctx.settingsScope.bind({ namespace: SHADOW_MIND_CARD_SETTINGS_NAMESPACE });
			const collapsedByDefault = () => useCardCollapsedByDefault(cardSettings);
			const sessions = clientSessions(ctx);
			ctx.on("command/executed", (sessionId, name, result) => {
				if (name !== "shadow" || result.text === void 0) return;
				const sessionContext = sessions.scope(sessionId);
				const conversation = sessionContext?.get("conversation");
				if (sessionContext === void 0 || conversation === void 0) return;
				conversation.input.for(sessionContext).notify(result.kind === "error" ? "error" : "info", result.text);
			});
			ctx.inject(["slots", "remote.shadowMind"], (scope) => {
				const sessions = clientSessions(scope);
				const remote = scope.remote.shadowMind;
				const reviewStore = new ShadowReviewStore((sessionId) => remoteValue("shadowMind.cycles", remote.cycles(sessionId)), (sessionId) => remoteValue("shadowMind.status", remote.status(sessionId)));
				scope.effect(() => () => {
					reviewStore.dispose();
				}, "ui-shadow-mind: review lifecycle store");
				scope.uiConversation.events.register(shadowReviewDefinition);
				scope.uiConversation.events.register(shadowRelayMarkerDefinition);
				scope.slots.inject("conversation.chat.node", () => scope.slots.register({
					name: "conversation.chat.node",
					key: "shadow-mind-review",
					locale: NS,
					inject: () => ({
						openSession: (sessionId) => {
							sessions.open(sessionId);
						},
						useCycle: (sessionId, capturedThroughSeq) => useShadowReviewCycle(reviewStore, sessionId, capturedThroughSeq),
						useStatus: (sessionId) => useShadowMindStatus(reviewStore, sessionId),
						retry: (sessionId, runId) => remoteValue("shadowMind.retry", remote.retry(sessionId, runId)),
						pause: (sessionId) => remoteValue("shadowMind.pause", remote.pause(sessionId)),
						resume: (sessionId) => remoteValue("shadowMind.resume", remote.resume(sessionId)),
						poke: (sessionId) => {
							reviewStore.poke(sessionId);
						},
						useCollapsedByDefault: collapsedByDefault
					})
				}, ShadowReportCard));
				scope.slots.inject("conversation.chat.node", () => scope.slots.register({
					name: "conversation.chat.node",
					key: "shadow-mind-relay-marker"
				}, ShadowRelayMarker));
				const injected = () => ({
					saveDefault: (input) => remoteValue("shadowMind.saveDefault", remote.saveDefault(input)),
					catalog: () => remoteValue("shadowMind.catalog", remote.catalog()),
					status: (sessionId) => remoteValue("shadowMind.status", remote.status(sessionId)),
					useCollapsedByDefault: collapsedByDefault,
					setCollapsedByDefault: (collapsed) => cardSettings.set(COLLAPSED_BY_DEFAULT_FIELD, collapsed)
				});
				scope.slots.inject("settings.plugins.tab", () => scope.slots.register({
					name: "settings.plugins.tab",
					id: "shadow-mind",
					order: 5,
					label: () => t("tab"),
					locale: NS,
					inject: injected
				}, ShadowMindSettingsTab));
			});
		}
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
