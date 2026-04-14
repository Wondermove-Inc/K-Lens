/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: PHASE 1-2 공통 프롬프트 partial 테스트
 * DAIVE Efficiency Optimization - Phase 1
 *
 * 📝 테스트 범위:
 * - AC-1: language-rules.ts 구현 (LANGUAGE_INSTRUCTION 포함 검증)
 * - AC-2: emoji-prohibition.ts 구현 (EMOJI_PROHIBITION 포함 검증)
 * - AC-3: output-format.ts 구현 (OUTPUT_FORMAT_RULES 포함 검증)
 * - AC-4: index.ts에서 통합 export + STANDARD_RULES 조합 검증
 * - AC-5: 각 partial이 50줄 이하
 *
 * @packageDocumentation
 */

import { EMOJI_PROHIBITION, LANGUAGE_INSTRUCTION, OUTPUT_FORMAT_RULES, STANDARD_RULES } from "../index";

// ============================================
// 🎯 테스트 설정
// ============================================

describe("Common Prompts Partials (PHASE 1-2)", () => {
  // ============================================
  // 🔹 AC-1: language-rules.ts 구현 검증
  // ============================================

  describe("AC-1: LANGUAGE_INSTRUCTION", () => {
    it("LANGUAGE_INSTRUCTION이 export되어야 함", () => {
      expect(LANGUAGE_INSTRUCTION).toBeDefined();
      expect(typeof LANGUAGE_INSTRUCTION).toBe("string");
    });

    it("LANGUAGE_REQUIREMENT 섹션을 포함해야 함", () => {
      expect(LANGUAGE_INSTRUCTION).toContain("[LANGUAGE_REQUIREMENT]");
    });

    it("한국어 응답 규칙을 포함해야 함", () => {
      expect(LANGUAGE_INSTRUCTION).toContain("Korean");
      expect(LANGUAGE_INSTRUCTION).toContain("SAME LANGUAGE");
    });

    it("영어 응답 규칙을 포함해야 함", () => {
      expect(LANGUAGE_INSTRUCTION).toContain("English");
    });

    it("CRITICAL 강조를 포함해야 함", () => {
      expect(LANGUAGE_INSTRUCTION).toContain("CRITICAL");
    });

    it("빈 문자열이 아니어야 함", () => {
      expect(LANGUAGE_INSTRUCTION.trim().length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // 🔹 AC-2: emoji-prohibition.ts 구현 검증
  // ============================================

  describe("AC-2: EMOJI_PROHIBITION", () => {
    it("EMOJI_PROHIBITION이 export되어야 함", () => {
      expect(EMOJI_PROHIBITION).toBeDefined();
      expect(typeof EMOJI_PROHIBITION).toBe("string");
    });

    it("EMOJI_PROHIBITION 섹션을 포함해야 함", () => {
      expect(EMOJI_PROHIBITION).toContain("EMOJI_PROHIBITION");
    });

    it("이모지 금지 명시가 있어야 함", () => {
      expect(EMOJI_PROHIBITION).toContain("FORBIDDEN");
      expect(EMOJI_PROHIBITION).toContain("prohibited");
    });

    it("Unicode 범위를 명시해야 함", () => {
      expect(EMOJI_PROHIBITION).toContain("U+1F300");
      expect(EMOJI_PROHIBITION).toContain("U+1F9FF");
    });

    it("대체 방법을 제시해야 함", () => {
      expect(EMOJI_PROHIBITION).toContain("REQUIRED");
      expect(EMOJI_PROHIBITION).toContain("[OK]");
      expect(EMOJI_PROHIBITION).toContain("[ERROR]");
    });

    it("빈 문자열이 아니어야 함", () => {
      expect(EMOJI_PROHIBITION.trim().length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // 🔹 AC-3: output-format.ts 구현 검증
  // ============================================

  describe("AC-3: OUTPUT_FORMAT_RULES", () => {
    it("OUTPUT_FORMAT_RULES가 export되어야 함", () => {
      expect(OUTPUT_FORMAT_RULES).toBeDefined();
      expect(typeof OUTPUT_FORMAT_RULES).toBe("string");
    });

    it("OUTPUT_RULES 섹션을 포함해야 함", () => {
      expect(OUTPUT_FORMAT_RULES).toContain("[OUTPUT_RULES]");
    });

    it("Markdown 테이블 규칙을 포함해야 함", () => {
      const hasTableRule = OUTPUT_FORMAT_RULES.includes("table") || OUTPUT_FORMAT_RULES.includes("Table");
      expect(hasTableRule).toBe(true);
    });

    it("금지 사항을 명시해야 함", () => {
      const hasForbidden = OUTPUT_FORMAT_RULES.includes("FORBIDDEN") || OUTPUT_FORMAT_RULES.includes("prohibited");
      expect(hasForbidden).toBe(true);
    });

    it("빈 문자열이 아니어야 함", () => {
      expect(OUTPUT_FORMAT_RULES.trim().length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // 🔹 AC-4: STANDARD_RULES 통합 검증
  // ============================================

  describe("AC-4: STANDARD_RULES 통합", () => {
    it("STANDARD_RULES가 export되어야 함", () => {
      expect(STANDARD_RULES).toBeDefined();
      expect(typeof STANDARD_RULES).toBe("string");
    });

    it("LANGUAGE_INSTRUCTION을 포함해야 함", () => {
      expect(STANDARD_RULES).toContain("[LANGUAGE_REQUIREMENT]");
    });

    it("EMOJI_PROHIBITION을 포함해야 함", () => {
      expect(STANDARD_RULES).toContain("EMOJI_PROHIBITION");
    });

    it("OUTPUT_FORMAT_RULES를 포함해야 함", () => {
      expect(STANDARD_RULES).toContain("[OUTPUT_RULES]");
    });

    it("세 개의 partial이 모두 포함되어야 함", () => {
      const hasAll =
        STANDARD_RULES.includes("[LANGUAGE_REQUIREMENT]") &&
        STANDARD_RULES.includes("EMOJI_PROHIBITION") &&
        STANDARD_RULES.includes("[OUTPUT_RULES]");

      expect(hasAll).toBe(true);
    });

    it("빈 문자열이 아니어야 함", () => {
      expect(STANDARD_RULES.trim().length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // 🔹 AC-5: 파일 크기 제한 검증 (간접)
  // ============================================

  describe("AC-5: 각 partial 크기 검증", () => {
    it("LANGUAGE_INSTRUCTION은 합리적인 크기여야 함 (< 2000자)", () => {
      expect(LANGUAGE_INSTRUCTION.length).toBeLessThan(2000);
    });

    it("EMOJI_PROHIBITION은 합리적인 크기여야 함 (< 2000자)", () => {
      expect(EMOJI_PROHIBITION.length).toBeLessThan(2000);
    });

    it("OUTPUT_FORMAT_RULES는 합리적인 크기여야 함 (< 2000자)", () => {
      expect(OUTPUT_FORMAT_RULES.length).toBeLessThan(2000);
    });
  });

  // ============================================
  // 🔹 통합 시나리오 테스트
  // ============================================

  describe("통합 시나리오", () => {
    it("모든 partial이 독립적으로 사용 가능해야 함", () => {
      expect(LANGUAGE_INSTRUCTION).toBeDefined();
      expect(EMOJI_PROHIBITION).toBeDefined();
      expect(OUTPUT_FORMAT_RULES).toBeDefined();

      expect(LANGUAGE_INSTRUCTION.trim().length).toBeGreaterThan(0);
      expect(EMOJI_PROHIBITION.trim().length).toBeGreaterThan(0);
      expect(OUTPUT_FORMAT_RULES.trim().length).toBeGreaterThan(0);
    });

    it("STANDARD_RULES는 세 partial의 조합이어야 함", () => {
      const expectedContent = LANGUAGE_INSTRUCTION + EMOJI_PROHIBITION + OUTPUT_FORMAT_RULES;

      expect(STANDARD_RULES).toBe(expectedContent);
    });

    it("기존 CRITICAL_LANGUAGE_INSTRUCTION과 동일한 효과를 가져야 함", () => {
      // LANGUAGE_REQUIREMENT 체크
      expect(STANDARD_RULES).toContain("[LANGUAGE_REQUIREMENT]");
      expect(STANDARD_RULES).toContain("CRITICAL");

      // EMOJI_PROHIBITION 체크
      expect(STANDARD_RULES).toContain("EMOJI_PROHIBITION");
      expect(STANDARD_RULES).toContain("FORBIDDEN");
    });
  });

  // ============================================
  // 🔹 이모지 실제 금지 검증
  // ============================================

  describe("이모지 실제 금지 검증", () => {
    const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;

    it("LANGUAGE_INSTRUCTION에 이모지가 없어야 함", () => {
      expect(LANGUAGE_INSTRUCTION.match(EMOJI_REGEX)).toBeNull();
    });

    it("EMOJI_PROHIBITION에 이모지가 없어야 함", () => {
      expect(EMOJI_PROHIBITION.match(EMOJI_REGEX)).toBeNull();
    });

    it("OUTPUT_FORMAT_RULES에 이모지가 없어야 함", () => {
      expect(OUTPUT_FORMAT_RULES.match(EMOJI_REGEX)).toBeNull();
    });

    it("STANDARD_RULES에 이모지가 없어야 함", () => {
      expect(STANDARD_RULES.match(EMOJI_REGEX)).toBeNull();
    });
  });
});
