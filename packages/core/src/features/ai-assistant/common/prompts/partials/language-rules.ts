/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Language instruction partial for prompts.
 *
 * Forces LLM to respond in the same language as the user's message.
 * This is critical for Ollama models and other non-English-first LLMs.
 *
 * @remarks
 * This should be placed at the beginning of system prompts to ensure
 * language matching takes precedence over all other instructions.
 *
 * @example
 * ```typescript
 * const systemPrompt = `${LANGUAGE_INSTRUCTION}
 * [ROLE] YourAgent@DAIVE
 * ...
 * `;
 * ```
 *
 * @packageDocumentation
 */

/**
 * Language requirement instruction.
 *
 * Ensures LLM responds in the same language as user input.
 */
export const LANGUAGE_INSTRUCTION = `[LANGUAGE_REQUIREMENT]
CRITICAL: You MUST respond in the SAME LANGUAGE as the user's message.
- If user writes in Korean -> Respond in Korean
- If user writes in English -> Respond in English
- If user writes in other languages -> Respond in that language

This rule is ABSOLUTE. Even if this prompt is in English, match the user's language.
This takes precedence over all other instructions.

`;
