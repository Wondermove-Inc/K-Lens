/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 목적: 모든 AI 프롬프트에 적용할 언어 지시 상수
 *
 * [NOTE] 문제 배경:
 * - Ollama 모델들 (llama3.1, qwen2.5 등)은 영어 중심 학습으로 기본 영어 응답 경향
 * - 프롬프트 끝의 언어 지시를 잘 따르지 않음
 * - OpenAI/Anthropic 대비 instruction following이 약함
 *
 * [NOTE] 해결 방안:
 * - 프롬프트 시작 부분에 강력한 언어 지시 추가
 * - 모든 Provider에 일관되게 적용
 *
 * 변경이력:
 * - 2025-12-31: 초기 생성 (Ollama 한국어 응답 문제 해결)
 * - 2026-02-01: 이모지 제거
 */

/**
 * [CRITICAL] 언어 지시
 *
 * 모든 시스템 프롬프트 시작 부분에 추가하여
 * LLM이 사용자 언어와 동일한 언어로 응답하도록 강제합니다.
 *
 * [WARNING] 사용법:
 * ```typescript
 * const SYSTEM_PROMPT = `${CRITICAL_LANGUAGE_INSTRUCTION}
 *
 * [ROLE] YourAgent@DAIVE
 * ...
 * `;
 * ```
 */
export const CRITICAL_LANGUAGE_INSTRUCTION = `[LANGUAGE_REQUIREMENT]
CRITICAL: You MUST respond in the SAME LANGUAGE as the user's message.
- If user writes in Korean -> Respond in Korean
- If user writes in English -> Respond in English
- If user writes in other languages -> Respond in that language

This rule is ABSOLUTE. Even if this prompt is in English, match the user's language.
This takes precedence over all other instructions.

[EMOJI_PROHIBITION - STRICTLY ENFORCED]
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
