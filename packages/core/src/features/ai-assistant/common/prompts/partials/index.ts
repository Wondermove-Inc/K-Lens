/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Prompt partials module.
 *
 * Provides reusable prompt fragments that can be composed into complete prompts.
 * Each partial handles a specific aspect of LLM behavior control.
 *
 * @remarks
 * Partials included:
 * - LANGUAGE_INSTRUCTION: Forces response in user's language
 * - EMOJI_PROHIBITION: Forbids emoji usage
 * - OUTPUT_FORMAT_RULES: Defines formatting requirements
 * - STANDARD_RULES: Combines all three partials
 *
 * @example
 * ```typescript
 * import { STANDARD_RULES, LANGUAGE_INSTRUCTION } from './partials';
 *
 * // Use all standard rules
 * const prompt1 = `${STANDARD_RULES}
 * [ROLE] YourAgent@DAIVE
 * ...
 * `;
 *
 * // Use only language instruction
 * const prompt2 = `${LANGUAGE_INSTRUCTION}
 * [ROLE] YourAgent@DAIVE
 * ...
 * `;
 * ```
 *
 * @packageDocumentation
 */

export { EMOJI_PROHIBITION } from "./emoji-prohibition";
export { LANGUAGE_INSTRUCTION } from "./language-rules";
export { OUTPUT_FORMAT_RULES } from "./output-format";

import { EMOJI_PROHIBITION } from "./emoji-prohibition";
import { LANGUAGE_INSTRUCTION } from "./language-rules";
import { OUTPUT_FORMAT_RULES } from "./output-format";

/**
 * Standard rules combining all prompt partials.
 *
 * Includes language matching, emoji prohibition, and output formatting rules.
 * This should be used at the beginning of most system prompts.
 *
 * @remarks
 * Equivalent to the previous CRITICAL_LANGUAGE_INSTRUCTION constant
 * but now modular and composable.
 */
export const STANDARD_RULES = LANGUAGE_INSTRUCTION + EMOJI_PROHIBITION + OUTPUT_FORMAT_RULES;
