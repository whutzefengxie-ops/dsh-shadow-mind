import { j as DEFAULT_SHADOW_ID } from "./chunks/runtime-B6bDrJjw.js";
import { defineTool } from "@deepseek-ai/dsh-tools";
//#region .build/tool/index.js
/** Shadow management tools and the `/shadow` root-agent command. @module @whutzefengxie-ops/dsh-shadow-mind/tool */
/** Cordis plugin name. */
const name = "tool-shadow-mind";
/** Required runtime, tool, command, and approval services. */
const inject = [
	"tools",
	"shadowMind",
	"commands",
	"approval"
];
/** Shared canonical text result declaration. */
function textOutput() {
	return {
		schema: {
			type: "object",
			additionalProperties: false,
			properties: { result: {
				type: "string",
				required: true
			} }
		},
		render: (_args, value) => [{
			type: "text",
			text: value.result
		}]
	};
}
/** Request explicit approval for one definition or settings mutation. */
async function approve(ctx, exec, reason) {
	if (exec.agent === void 0) throw new Error(`${exec.name} requires a calling agent`);
	const outcome = await ctx.approval.request({
		agent: exec.agent,
		toolName: exec.name,
		callId: exec.callId,
		reason,
		signal: exec.signal
	});
	if (outcome !== "allowed-once") throw new Error(`Shadow Mind mutation was not approved (${outcome})`);
}
/** JSON-safe definition view returned to the model. */
function definitionView(definition) {
	return {
		id: definition.id,
		name: definition.name,
		enabled: definition.enabled,
		debug: definition.debug,
		activation_probability: definition.activationProbability,
		active_for_models: definition.activeForModels,
		run_with_model: definition.runWithModel ?? null,
		reasoning_effort: definition.reasoningEffort ?? null,
		timeout_seconds: definition.timeoutSeconds ?? null,
		tools: definition.tools,
		capture: definition.capture,
		context: definition.context,
		think_first: definition.thinkFirst,
		holdout: definition.holdout,
		prompt: definition.prompt
	};
}
/** Stable pretty JSON for management-tool output. */
function result(value) {
	return { result: JSON.stringify(value, null, 2) };
}
/** Convert one parsed update_default_shadow argument record into a merged default-definition input. */
function mergedDefault(args, current) {
	return {
		id: DEFAULT_SHADOW_ID,
		name: args.name === void 0 ? current.name : args.name,
		enabled: args.enabled === void 0 ? current.enabled : args.enabled,
		debug: args.debug === void 0 ? current.debug : args.debug,
		activationProbability: args.activation_probability === void 0 ? current.activationProbability : args.activation_probability,
		activeForModels: args.active_for_models === void 0 ? current.activeForModels : args.active_for_models,
		runWithModel: args.run_with_model === void 0 ? current.runWithModel ?? null : args.run_with_model,
		reasoningEffort: args.reasoning_effort === void 0 ? current.reasoningEffort ?? null : args.reasoning_effort,
		timeoutSeconds: args.timeout_seconds === void 0 ? current.timeoutSeconds ?? null : args.timeout_seconds,
		tools: args.tools === void 0 ? current.tools : args.tools,
		capture: args.capture === void 0 ? current.capture : args.capture,
		context: args.context === void 0 ? current.context : args.context,
		thinkFirst: args.think_first === void 0 ? current.thinkFirst : args.think_first,
		holdout: current.holdout,
		prompt: args.prompt === void 0 ? current.prompt : args.prompt
	};
}
/** Editable fields of the single default Shadow definition. */
const DEFAULT_SHADOW_PARAMETERS = {
	name: {
		type: "string",
		description: "Human-readable Shadow name."
	},
	enabled: {
		type: "boolean",
		description: "Whether automatic scheduling may select the Shadow."
	},
	debug: {
		type: "boolean",
		description: "Whether run lifecycle transitions append local JSONL diagnostics."
	},
	activation_probability: {
		type: "number",
		description: "Per-turn review probability from 0 through 1."
	},
	active_for_models: {
		type: "array",
		description: "Optional model or provider/model glob filters.",
		items: { type: "string" }
	},
	run_with_model: {
		oneOf: [{ type: "string" }, { type: "null" }],
		description: "Optional provider/model route; null clears the override and inherits the root agent model."
	},
	reasoning_effort: {
		oneOf: [{ type: "string" }, { type: "null" }],
		description: "Optional adapter-owned reasoning effort; null clears the override."
	},
	timeout_seconds: {
		oneOf: [{ type: "number" }, { type: "null" }],
		description: "Optional positive run deadline; null clears the override."
	},
	tools: {
		type: "array",
		description: "Extra tools added to read, grep, and glob.",
		items: { type: "string" }
	},
	capture: {
		type: "string",
		enum: ["full", "since-compaction"],
		description: "Root trajectory window captured by the Shadow."
	},
	context: {
		type: "string",
		enum: ["standard", "minimal"],
		description: "Whether model-visible dynamic runtime context is inherited."
	},
	think_first: {
		type: "boolean",
		description: "Require a tool-free planning request before investigation."
	},
	prompt: {
		type: "string",
		description: "Non-empty Shadow instructions."
	}
};
/** Compact acknowledgment for one admitted manual Shadow run. */
function admittedConfirmation(operation, status) {
	const runs = status.active.map((entry) => `${entry.shadowId}/${entry.runId}`);
	return runs.length === 0 ? `Shadow ${operation} acknowledged; no run is active.` : `Shadow ${operation} admitted; ${String(runs.length)} running: ${runs.join(", ")}.`;
}
/** Register all Shadow management tools and the human command. */
function apply(ctx) {
	ctx.commands.register({
		name: "shadow",
		description: "Retry the latest failed Shadow review or force a fresh review",
		input: {
			hint: "[retry|new]",
			images: false
		},
		handler: async ({ agent, rawInput }) => {
			const operation = rawInput.trim();
			if (operation !== "retry" && operation !== "new") return {
				kind: "error",
				text: "Usage: /shadow [retry|new]"
			};
			try {
				return {
					kind: "success",
					text: admittedConfirmation(operation, operation === "retry" ? await ctx.shadowMind.retryLatest(agent) : await ctx.shadowMind.reviewNow(agent))
				};
			} catch (error) {
				return {
					kind: "error",
					text: error instanceof Error ? error.message : String(error)
				};
			}
		}
	});
	ctx.tools.register(defineTool({
		name: "list_shadows",
		description: "List Shadow definitions and isolated file diagnostics. The single scheduled Shadow is `default`; other files are read-only legacy definitions.",
		parameters: {},
		output: textOutput(),
		execute: async () => {
			const catalog = await ctx.shadowMind.listDefinitions();
			return result({
				definitions: catalog.definitions.map(definitionView),
				diagnostics: catalog.diagnostics
			});
		},
		presentCall: () => ({
			card: "generic",
			title: "List Shadow Minds",
			kind: "read"
		})
	}));
	ctx.tools.register(defineTool({
		name: "update_default_shadow",
		description: "Update selected fields of the single default Shadow definition. This changes local configuration and requires user approval.",
		parameters: { ...DEFAULT_SHADOW_PARAMETERS },
		output: textOutput(),
		execute: async (args, exec) => {
			const entries = Object.entries(args).filter(([, value]) => value !== void 0);
			if (entries.length === 0) throw new Error("update_default_shadow requires at least one field to update");
			const current = (await ctx.shadowMind.listDefinitions()).definitions.find((definition) => definition.id === DEFAULT_SHADOW_ID);
			if (current === void 0) throw new Error(`the default Shadow (${DEFAULT_SHADOW_ID}) does not exist yet`);
			await approve(ctx, exec, "Update the default Shadow definition");
			const next = mergedDefault(Object.fromEntries(entries), current);
			return result(definitionView(await ctx.shadowMind.saveDefaultDefinition(next)));
		},
		presentCall: () => ({
			card: "generic",
			title: "Update default Shadow",
			kind: "execute",
			rawInput: DEFAULT_SHADOW_ID
		})
	}));
	ctx.tools.register(defineTool({
		name: "get_shadow_config",
		description: "Read the current resolved Shadow Mind scheduling configuration.",
		parameters: {},
		output: textOutput(),
		execute: () => Promise.resolve(result(ctx.shadowMind.currentSettings())),
		presentCall: () => ({
			card: "generic",
			title: "Read Shadow Mind config",
			kind: "read"
		})
	}));
	ctx.tools.register(defineTool({
		name: "update_shadow_config",
		description: "Update selected Shadow Mind scheduling settings. This changes local configuration and requires user approval.",
		parameters: {
			defaultShadowTimeoutSeconds: {
				type: "number",
				description: "Positive default run deadline."
			},
			headlessDrainTimeoutSeconds: {
				type: "number",
				description: "Positive headless convergence deadline."
			},
			resultBatchWindowMs: {
				type: "number",
				description: "Non-negative report batching window."
			},
			argumentDisclosure: {
				type: "string",
				enum: ["redacted", "full"],
				description: "Tool-call argument projection policy."
			},
			randomSeed: {
				oneOf: [{ type: "number" }, { type: "null" }],
				description: "Deterministic scheduler seed; null clears the user override."
			},
			maxPromptChars: {
				type: "number",
				description: "Complete prompt bound; oversized prompts are trimmed to fit. 0 uses the selected model context window."
			},
			maxReportChars: {
				type: "number",
				description: "Accepted report bound; oversized reports are truncated. 0 disables the limit."
			},
			valueLoopEnabled: {
				type: "boolean",
				description: "Persist metadata-only challenge dispositions."
			},
			valueLoopWindowTurns: {
				type: "number",
				description: "Root turns observed before a challenge becomes ignored."
			},
			reviewWindowSize: {
				type: "number",
				description: "Accepted report entries retained per definition."
			},
			spinningRepeatCount: {
				type: "number",
				description: "Identical-envelope threshold for spinning."
			},
			oscillationPeriods: {
				type: "number",
				description: "Alternating verdict periods required for oscillation."
			},
			noDriftRepeatCount: {
				type: "number",
				description: "Unchanged confirmation threshold for no-drift."
			},
			diminishingWindowSize: {
				type: "number",
				description: "Suffix length for diminishing novelty."
			},
			diminishingNoveltyThreshold: {
				type: "number",
				description: "Minimum novel-envelope share from 0 through 1."
			},
			stagnationCooldownSeconds: {
				type: "number",
				description: "Wall-clock stagnation cooldown."
			},
			stagnationEscalationEnabled: {
				type: "boolean",
				description: "Escalate oscillating reviewers by one reasoning-effort rung."
			},
			reasoningEffortLadder: {
				type: "array",
				description: "Ordered unique reasoning-effort rung names.",
				items: { type: "string" }
			},
			sessionShadowSoftBudgetChars: {
				oneOf: [{ type: "number" }, { type: "null" }],
				description: "Character spend that activates the frugal route; null clears the user override."
			},
			sessionShadowHardBudgetChars: {
				oneOf: [{ type: "number" }, { type: "null" }],
				description: "Character spend that stops new Shadow runs; null clears the user override."
			},
			frugalShadowModel: {
				oneOf: [{ type: "string" }, { type: "null" }],
				description: "Provider/model route used after the soft budget; null clears the user override."
			},
			staleReportDecay: {
				type: "number",
				description: "Repeated-envelope probability decay from 0 through 1."
			}
		},
		output: textOutput(),
		execute: async (args, exec) => {
			const entries = Object.entries(args).filter(([, value]) => value !== void 0);
			const patch = Object.fromEntries(entries);
			if (Object.keys(patch).length === 0) throw new Error("update_shadow_config requires at least one setting");
			await approve(ctx, exec, "Update Shadow Mind scheduling configuration");
			await ctx.shadowMind.updateSettings(patch);
			return result(ctx.shadowMind.currentSettings());
		},
		presentCall: () => ({
			card: "generic",
			title: "Update Shadow Mind config",
			kind: "execute"
		})
	}));
}
//#endregion
export { apply, inject, name };
