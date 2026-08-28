/** Shadow management tools and the `/shadow` root-agent command. @module @whutzefengxie-ops/dsh-shadow-mind/tool */
import type { Context } from '@deepseek-ai/cordis';
/** Cordis plugin name. */
export declare const name = "tool-shadow-mind";
/** Required runtime, tool, command, and approval services. */
export declare const inject: string[];
/** Register all Shadow management tools and the human command. */
export declare function apply(ctx: Context): void;
