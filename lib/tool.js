import { defineTool } from "@deepseek-ai/dsh-tools";
//#region .build/tool/index.js
/** Model management tools and the `/shadow` root-agent command. @module @whutzefengxie-ops/dsh-shadow-mind/tool */
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
		agent_preset: definition.agentPreset ?? null,
		timeout_seconds: definition.timeoutSeconds ?? null,
		tools: definition.tools,
		capture: definition.capture,
		context: definition.context,
		think_first: definition.thinkFirst,
		pre_filter: definition.preFilters,
		boost_filter: definition.boostFilters,
		boost_factor: definition.boostFactor,
		holdout: definition.holdout,
		prompt: definition.prompt
	};
}
/** Stable pretty JSON for management-tool output. */
function result(value) {
	return { result: JSON.stringify(value, null, 2) };
}
/** Recover the definition id type after tool schema validation. */
function shadowId(value) {
	return value;
}
/** Definition authoring parameter schema shared conceptually by create and update. */
const DEFINITION_PARAMETERS = {
	name: {
		type: "string",
		description: "Human-readable Shadow name."
	},
	enabled: {
		type: "boolean",
		description: "Whether automatic scheduling may select this Shadow."
	},
	debug: {
		type: "boolean",
		description: "Whether run lifecycle transitions append local JSONL diagnostics."
	},
	activation_probability: {
		type: "number",
		description: "Independent probability from 0 through 1."
	},
	active_for_models: {
		type: "array",
		description: "Optional model or provider/model glob filters.",
		items: { type: "string" }
	},
	run_with_model: {
		oneOf: [{ type: "string" }, { type: "null" }],
		description: "Optional provider/model route; null clears the override."
	},
	reasoning_effort: {
		oneOf: [{ type: "string" }, { type: "null" }],
		description: "Optional adapter-owned reasoning effort; null clears the override."
	},
	agent_preset: {
		oneOf: [{ type: "string" }, { type: "null" }],
		description: "Optional DSH agent preset id whose persona this Shadow adopts; null clears the override."
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
	pre_filter: {
		type: "array",
		description: "Named deterministic predicates that skip a selected run before spawn.",
		items: {
			type: "string",
			enum: [
				"last-report-covers",
				"tool-failure",
				"no-tool-calls"
			]
		}
	},
	boost_filter: {
		type: "array",
		description: "Named deterministic predicates that multiply activation probability.",
		items: {
			type: "string",
			enum: [
				"misleading-success",
				"repeated-failure",
				"long-output"
			]
		}
	},
	boost_factor: {
		type: "number",
		description: "Probability multiplier applied when any boost predicate matches."
	},
	holdout: {
		type: "boolean",
		description: "Apply owner-side literal redaction using the local holdout sidecar."
	},
	prompt: {
		type: "string",
		description: "Non-empty Shadow instructions."
	}
};
/** Register all Shadow management tools and the human command. */
function apply(ctx) {
	ctx.commands.register({
		name: "shadow",
		description: "Show, pause, resume, or toggle Shadow Mind scheduling",
		input: {
			hint: "[status|pause|resume|toggle]",
			images: false
		},
		handler: ({ agent, rawInput }) => {
			const operation = rawInput.trim() || "status";
			const status = operation === "status" ? ctx.shadowMind.status(agent) : operation === "pause" ? ctx.shadowMind.pause(agent) : operation === "resume" ? ctx.shadowMind.resume(agent) : operation === "toggle" ? ctx.shadowMind.toggle(agent) : void 0;
			if (status === void 0) return {
				kind: "error",
				text: "Usage: /shadow [status|pause|resume|toggle]"
			};
			const lastRun = status.lastRun === void 0 ? "no completed runs" : [
				`last ${status.lastRun.shadowId} ${status.lastRun.outcome} at ${status.lastRun.finishedAt}`,
				`stage ${status.lastRun.stage}`,
				...status.lastRun.reasonCode === void 0 ? [] : [`reason ${status.lastRun.reasonCode}`]
			].join(", ");
			return {
				kind: "success",
				text: `Shadow Mind ${status.paused ? "paused" : "active"}; ${String(status.active.length)} running; ${String(status.pendingSchedules)} pending schedules; ${String(status.totalRuns)} total runs; ${String(status.prefilterSkips)} prefilter skips; ${status.budgetTier} budget (${String(status.spentChars)} chars); ${String(status.synthesisRuns)} syntheses/${String(status.synthesisFailures)} failed; ${String(status.recentReviews.length)} recent reports; ${lastRun}.`
			};
		}
	});
	ctx.tools.register(defineTool({
		name: "list_shadows",
		description: "List Shadow Mind definitions and isolated file diagnostics. This does not start a Shadow.",
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
		name: "create_shadow",
		description: "Create one Markdown-backed Shadow definition. This changes local configuration and requires user approval.",
		parameters: {
			id: {
				type: "string",
				required: true,
				description: "Lowercase stable id used as the filename."
			},
			...DEFINITION_PARAMETERS,
			name: {
				...DEFINITION_PARAMETERS.name,
				required: true
			},
			prompt: {
				...DEFINITION_PARAMETERS.prompt,
				required: true
			}
		},
		output: textOutput(),
		execute: async (args, exec) => {
			const id = shadowId(args.id);
			await approve(ctx, exec, `Create Shadow definition ${id}`);
			const input = {
				id,
				name: args.name,
				enabled: args.enabled ?? true,
				debug: args.debug ?? false,
				activationProbability: args.activation_probability ?? .3,
				activeForModels: args.active_for_models ?? [],
				...args.run_with_model == null ? {} : { runWithModel: args.run_with_model },
				...args.reasoning_effort == null ? {} : { reasoningEffort: args.reasoning_effort },
				...args.agent_preset == null ? {} : { agentPreset: args.agent_preset },
				...args.timeout_seconds == null ? {} : { timeoutSeconds: args.timeout_seconds },
				tools: args.tools ?? [],
				capture: args.capture ?? "full",
				context: args.context ?? "standard",
				thinkFirst: args.think_first ?? false,
				preFilters: args.pre_filter ?? [],
				boostFilters: args.boost_filter ?? [],
				boostFactor: args.boost_factor ?? 1,
				holdout: args.holdout ?? false,
				prompt: args.prompt
			};
			return result(definitionView(await ctx.shadowMind.createDefinition(input)));
		},
		presentCall: (args) => {
			const id = shadowId(args.id);
			return {
				card: "generic",
				title: `Create Shadow ${id}`,
				kind: "execute",
				rawInput: id
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "update_shadow",
		description: "Update selected fields of one Shadow definition. This changes local configuration and requires user approval.",
		parameters: {
			id: {
				type: "string",
				required: true,
				description: "Existing Shadow id."
			},
			...DEFINITION_PARAMETERS
		},
		output: textOutput(),
		execute: async (args, exec) => {
			const id = shadowId(args.id);
			const patch = {
				...args.name === void 0 ? {} : { name: args.name },
				...args.enabled === void 0 ? {} : { enabled: args.enabled },
				...args.debug === void 0 ? {} : { debug: args.debug },
				...args.activation_probability === void 0 ? {} : { activationProbability: args.activation_probability },
				...args.active_for_models === void 0 ? {} : { activeForModels: args.active_for_models },
				...args.run_with_model === void 0 ? {} : { runWithModel: args.run_with_model ?? void 0 },
				...args.reasoning_effort === void 0 ? {} : { reasoningEffort: args.reasoning_effort ?? void 0 },
				...args.agent_preset === void 0 ? {} : { agentPreset: args.agent_preset ?? void 0 },
				...args.timeout_seconds === void 0 ? {} : { timeoutSeconds: args.timeout_seconds ?? void 0 },
				...args.tools === void 0 ? {} : { tools: args.tools },
				...args.capture === void 0 ? {} : { capture: args.capture },
				...args.context === void 0 ? {} : { context: args.context },
				...args.think_first === void 0 ? {} : { thinkFirst: args.think_first },
				...args.pre_filter === void 0 ? {} : { preFilters: args.pre_filter },
				...args.boost_filter === void 0 ? {} : { boostFilters: args.boost_filter },
				...args.boost_factor === void 0 ? {} : { boostFactor: args.boost_factor },
				...args.holdout === void 0 ? {} : { holdout: args.holdout },
				...args.prompt === void 0 ? {} : { prompt: args.prompt }
			};
			if (Object.keys(patch).length === 0) throw new Error("update_shadow requires at least one field to update");
			await approve(ctx, exec, `Update Shadow definition ${id}`);
			return result(definitionView(await ctx.shadowMind.updateDefinition(id, patch)));
		},
		presentCall: (args) => {
			const id = shadowId(args.id);
			return {
				card: "generic",
				title: `Update Shadow ${id}`,
				kind: "execute",
				rawInput: id
			};
		}
	}));
	for (const [toolName, enabled] of [["enable_shadow", true], ["disable_shadow", false]]) ctx.tools.register(defineTool({
		name: toolName,
		description: `${enabled ? "Enable" : "Disable"} one Shadow definition. This changes local configuration and requires user approval.`,
		parameters: { id: {
			type: "string",
			required: true,
			description: "Existing Shadow id."
		} },
		output: textOutput(),
		execute: async (args, exec) => {
			const id = shadowId(args.id);
			await approve(ctx, exec, `${enabled ? "Enable" : "Disable"} Shadow definition ${id}`);
			return result(definitionView(await ctx.shadowMind.setEnabled(id, enabled)));
		},
		presentCall: (args) => {
			const id = shadowId(args.id);
			return {
				card: "generic",
				title: `${enabled ? "Enable" : "Disable"} Shadow ${id}`,
				kind: "execute",
				rawInput: id
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "delete_shadow",
		description: "Delete one Shadow definition while preserving its debug log. This requires user approval.",
		parameters: { id: {
			type: "string",
			required: true,
			description: "Existing Shadow id."
		} },
		output: textOutput(),
		execute: async (args, exec) => {
			const id = shadowId(args.id);
			await approve(ctx, exec, `Delete Shadow definition ${id}`);
			await ctx.shadowMind.deleteDefinition(id);
			return result({ deleted: id });
		},
		presentCall: (args) => {
			const id = shadowId(args.id);
			return {
				card: "generic",
				title: `Delete Shadow ${id}`,
				kind: "execute",
				rawInput: id
			};
		}
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
			heartbeatProbability: {
				type: "number",
				description: "Turn-level heartbeat probability from 0 through 1."
			},
			maxParallelShadows: {
				type: "number",
				description: "Positive integer concurrency bound per root."
			},
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
			defaultShadowModel: {
				oneOf: [{ type: "string" }, { type: "null" }],
				description: "Fallback provider/model route; null clears the user override."
			},
			defaultReasoningEffort: {
				oneOf: [{ type: "string" }, { type: "null" }],
				description: "Fallback adapter-owned reasoning effort; null clears the user override."
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
				description: "Positive complete prompt bound."
			},
			maxReportChars: {
				type: "number",
				description: "Positive accepted report bound."
			},
			preferIndependentVendor: {
				type: "boolean",
				description: "Prefer independently-vendored candidate routes when at least two remain."
			},
			longOutputBoostChars: {
				type: "number",
				description: "Tool-result size that triggers the long-output boost."
			},
			lastReportCoversCount: {
				type: "number",
				description: "Repeated envelope count for last-report suppression."
			},
			repeatedFailureBoostThreshold: {
				type: "number",
				description: "Same-tool failure count that triggers a boost."
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
			},
			conflictSynthesisEnabled: {
				type: "boolean",
				description: "Replace one conflicting report pair with one synthesis."
			},
			conflictSynthesisTimeoutSeconds: {
				type: "number",
				description: "Positive synthesis deadline."
			},
			defaultAgentPreset: {
				oneOf: [{ type: "string" }, { type: "null" }],
				description: "DSH agent preset adopted by Shadows that bind no preset; null clears the user override."
			},
			synthesisModel: {
				oneOf: [{ type: "string" }, { type: "null" }],
				description: "Provider/model route for conflict-synthesis runs; null clears the user override."
			},
			synthesisReasoningEffort: {
				oneOf: [{ type: "string" }, { type: "null" }],
				description: "Reasoning effort for conflict-synthesis runs; null clears the user override."
			},
			synthesisAgentPreset: {
				oneOf: [{ type: "string" }, { type: "null" }],
				description: "DSH agent preset for conflict-synthesis runs; null clears the user override."
			},
			commandGateEnabled: {
				type: "boolean",
				description: "Whether root pwsh-style commands pass through the command gate."
			},
			commandGateTools: {
				type: "array",
				description: "Tool names the gate intercepts.",
				items: { type: "string" }
			},
			commandGateScope: {
				type: "string",
				enum: ["root-only", "root-and-subagents"],
				description: "Which agents the gate inspects."
			},
			commandGateDenyPatterns: {
				type: "array",
				description: "Regular expressions that deny a command before any judge runs.",
				items: { type: "string" }
			},
			commandGateAllowPatterns: {
				type: "array",
				description: "Regular expressions that allow a command when no deny pattern matches.",
				items: { type: "string" }
			},
			commandGateProtectedProcesses: {
				type: "array",
				description: "Protected process names; destructive commands naming one are denied.",
				items: { type: "string" }
			},
			commandGateProtectedServices: {
				type: "array",
				description: "Protected service names; destructive commands naming one are denied.",
				items: { type: "string" }
			},
			commandGateContext: {
				oneOf: [{ type: "string" }, { type: "null" }],
				description: "Free-text environment declaration injected into every gate judge prompt; null clears it."
			},
			commandGateModel: {
				oneOf: [{ type: "string" }, { type: "null" }],
				description: "Provider/model route for the gate judge; null clears the user override."
			},
			commandGateReasoningEffort: {
				oneOf: [{ type: "string" }, { type: "null" }],
				description: "Reasoning effort for the gate judge; null clears the user override."
			},
			commandGateAgentPreset: {
				oneOf: [{ type: "string" }, { type: "null" }],
				description: "DSH agent preset for the gate judge; null clears the user override."
			},
			commandGateJudgeTimeoutSeconds: {
				type: "number",
				description: "Deadline for one gate judge verdict in seconds."
			},
			commandGateOnJudgeFailure: {
				type: "string",
				enum: ["deny", "allow"],
				description: "Fail closed or fail open when the judge times out or fails."
			},
			commandGateMaxParallel: {
				type: "number",
				description: "Maximum concurrent gate judges."
			},
			commandGateVerdictTtlSeconds: {
				type: "number",
				description: "Seconds an identical command reuses the previous judge verdict."
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
