/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Emoji prohibition partial for prompts.
 *
 * Strictly forbids LLM from using emojis and provides text-based alternatives.
 * This ensures consistent, professional output across all responses.
 *
 * @remarks
 * - All Unicode emojis (U+1F300-U+1F9FF, U+2600-U+27BF) are forbidden
 * - Text markers like [OK], [ERROR], [WARNING] should be used instead
 * - This rule has no exceptions unless user explicitly requests emojis
 *
 * @example
 * ```typescript
 * const systemPrompt = `${EMOJI_PROHIBITION}
 * [ROLE] YourAgent@DAIVE
 * ...
 * `;
 * ```
 *
 * @packageDocumentation
 */

/**
 * Emoji prohibition instruction.
 *
 * Forbids all emojis and provides text-based alternatives.
 */
export const EMOJI_PROHIBITION = `[EMOJI_PROHIBITION - STRICTLY ENFORCED]
CRITICAL: You MUST NEVER use ANY emojis in your responses. This is a HARD REQUIREMENT.

FORBIDDEN (absolutely prohibited):
- Unicode emojis: All characters from U+1F300 to U+1F9FF
- Symbol emojis: All characters from U+2600 to U+27BF
- Common examples that are BANNED:
  * Checkmarks: (no checkmark symbols allowed)
  * Warning signs: (no warning symbols allowed)
  * Arrows, stars, hearts, faces, hands, objects
  * Fire, target, memo, clipboard, rocket, etc.

REQUIRED (use these instead):
- Status markers: [OK], [ERROR], [WARNING], [NOTE], [INFO]
- List bullets: - (hyphen) or * (asterisk)
- Section headers: ### or **bold**
- Emphasis: *italic* or **bold**

VIOLATION CONSEQUENCE:
- Any emoji in your response is considered a CRITICAL ERROR
- Responses containing emojis will be REJECTED

This rule has NO exceptions unless the user EXPLICITLY asks for emojis.

`;
