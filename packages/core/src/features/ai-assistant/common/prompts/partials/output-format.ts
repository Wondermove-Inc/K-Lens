/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Output format rules partial for prompts.
 *
 * Defines formatting rules for LLM responses to ensure consistent,
 * clean output without decorative elements.
 *
 * @remarks
 * - Markdown tables should be used for structured data
 * - ASCII art and box drawing characters are forbidden
 * - Simple, clean formatting is required
 *
 * @example
 * ```typescript
 * const systemPrompt = `${OUTPUT_FORMAT_RULES}
 * [ROLE] YourAgent@DAIVE
 * ...
 * `;
 * ```
 *
 * @packageDocumentation
 */

/**
 * Output format rules instruction.
 *
 * Defines formatting requirements for responses.
 */
export const OUTPUT_FORMAT_RULES = `[OUTPUT_RULES]
REQUIRED formatting:
- Use Markdown tables for structured data
- Use simple headers (###) for sections
- Use lists (- or *) for items
- Use code blocks (\`\`\`) for code examples

FORBIDDEN formatting:
- ASCII art or box drawing characters (━ ┌ ┐ └ ┘ │ ├ ┤ ┬ ┴ ┼)
- Decorative separators
- Complex visual elements
- Any Unicode box-drawing characters

Keep formatting clean, simple, and professional.

`;
