/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: message-trimmer 유닛 테스트
 *
 * 📝 주요 테스트:
 * - Plan 모드에서 초기 사용자 요청 보존
 * - 일반 대화 모드 기존 동작 유지
 * - 토큰 한도 초과 시 trimming 동작
 *
 * 🔄 변경이력:
 * - 2026-02-01: 테스트 추가
 */

import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { trimMessages } from "./message-trimmer";

describe("message-trimmer", () => {
  describe("Plan 모드 초기 요청 보존", () => {
    it("should preserve initial HumanMessage in Plan mode even after many messages", () => {
      // Given: Plan 모드에서 초기 사용자 요청과 여러 메시지
      const initialRequest = new HumanMessage({ content: "/finops 보고서 생성해줘" });
      const messages = [
        initialRequest,
        new AIMessage({ content: "Plan을 생성하겠습니다." }),
        // Plan 실행으로 20개 메시지 추가 (Step 실행)
        ...Array.from({ length: 20 }, (_, i) => [
          new AIMessage({ content: `Step ${i + 1} 실행 중...` }),
          new AIMessage({ content: `Step ${i + 1} 완료` }),
        ]).flat(),
      ];

      // When: Plan 모드로 trimming (preserveRecentCount=4로 일반적으로 초기 메시지 삭제됨)
      const result = trimMessages(messages, {
        provider: "anthropic",
        preserveRecentCount: 4,
        isPlanMode: true, // 🆕 Plan 모드 플래그
      });

      // Then: 초기 HumanMessage가 보존되어야 함
      const humanMessages = result.messages.filter((msg) => msg instanceof HumanMessage);
      expect(humanMessages.length).toBeGreaterThan(0);
      expect(humanMessages[0].content).toBe("/finops 보고서 생성해줘");
    });

    it("should preserve initial HumanMessage even when token limit is exceeded", () => {
      // Given: 토큰 한도 초과하는 긴 메시지들
      const initialRequest = new HumanMessage({ content: "/finops 분석" });
      const longContent = "A".repeat(10000); // 긴 내용

      const messages = [
        initialRequest,
        new AIMessage({ content: "분석 시작" }),
        ...Array.from({ length: 30 }, (_, i) => new AIMessage({ content: `Step ${i}: ${longContent}` })),
      ];

      // When: Plan 모드로 trimming
      const result = trimMessages(messages, {
        provider: "anthropic",
        maxTokens: 50000, // 낮은 토큰 한도
        isPlanMode: true,
      });

      // Then: 토큰 한도로 많은 메시지가 삭제되어도 초기 요청은 유지
      expect(result.wasTrimmed).toBe(true);
      expect(result.removedCount).toBeGreaterThan(0);

      const humanMessages = result.messages.filter((msg) => msg instanceof HumanMessage);
      expect(humanMessages.length).toBeGreaterThan(0);
      expect(humanMessages[0].content).toBe("/finops 분석");
    });
  });

  describe("일반 대화 모드 기존 동작 유지", () => {
    it("should NOT preserve initial message in normal mode (recent messages priority)", () => {
      // Given: 일반 대화에서 초기 메시지와 여러 메시지
      const initialMessage = new HumanMessage({ content: "첫 번째 질문" });
      const longContent = "A".repeat(10000); // 토큰 한도 초과를 위한 긴 내용
      const messages = [
        initialMessage,
        new AIMessage({ content: "첫 번째 답변" }),
        ...Array.from({ length: 30 }, (_, i) => [
          new HumanMessage({ content: `질문 ${i + 2}: ${longContent}` }),
          new AIMessage({ content: `답변 ${i + 2}: ${longContent}` }),
        ]).flat(),
      ];

      // When: 일반 모드로 trimming (isPlanMode 없음, 낮은 토큰 한도로 강제 trimming)
      const result = trimMessages(messages, {
        provider: "anthropic",
        preserveRecentCount: 4,
        maxTokens: 10000, // 매우 낮은 한도로 trimming 강제
      });

      // Then: trimming 발생
      expect(result.wasTrimmed).toBe(true);

      // 초기 메시지는 삭제되어야 함 (일반 모드는 최근 메시지 우선)
      const humanMessages = result.messages.filter((msg) => msg instanceof HumanMessage);
      if (humanMessages.length > 0) {
        // 초기 메시지가 없거나, 있더라도 "첫 번째 질문"이 아니어야 함
        expect(humanMessages[0].content).not.toBe("첫 번째 질문");
      }
    });

    it("should preserve SystemMessage in both modes", () => {
      // Given: SystemMessage와 여러 메시지
      const systemMsg = new SystemMessage({ content: "You are a helpful assistant." });
      const messages = [
        systemMsg,
        new HumanMessage({ content: "안녕" }),
        ...Array.from({ length: 20 }, () => new AIMessage({ content: "응답" })),
      ];

      // When: Plan 모드로 trimming
      const planResult = trimMessages(messages, {
        provider: "anthropic",
        preserveRecentCount: 4,
        isPlanMode: true,
      });

      // Then: SystemMessage는 항상 보존
      expect(planResult.messages[0]).toBeInstanceOf(SystemMessage);
      expect(planResult.messages[0].content).toBe("You are a helpful assistant.");

      // When: 일반 모드로 trimming
      const normalResult = trimMessages(messages, {
        provider: "anthropic",
        preserveRecentCount: 4,
      });

      // Then: 일반 모드에서도 SystemMessage 보존
      expect(normalResult.messages[0]).toBeInstanceOf(SystemMessage);
    });
  });

  describe("엣지 케이스", () => {
    it("should handle case with no HumanMessage in Plan mode", () => {
      // Given: HumanMessage 없는 메시지 배열 (비정상이지만 처리 가능해야 함)
      const messages = [
        new SystemMessage({ content: "System prompt" }),
        new AIMessage({ content: "AI 응답 1" }),
        new AIMessage({ content: "AI 응답 2" }),
      ];

      // When: Plan 모드로 trimming
      const result = trimMessages(messages, {
        provider: "anthropic",
        isPlanMode: true,
      });

      // Then: 오류 없이 처리되어야 함
      expect(result.messages.length).toBeGreaterThan(0);
    });

    it("should handle multiple HumanMessages in Plan mode", () => {
      // Given: 여러 HumanMessage
      const messages = [
        new HumanMessage({ content: "/finops 초기 요청" }),
        new AIMessage({ content: "Plan 생성" }),
        ...Array.from({ length: 10 }, () => new AIMessage({ content: "Step" })),
        new HumanMessage({ content: "추가 질문" }),
        new AIMessage({ content: "추가 답변" }),
      ];

      // When: Plan 모드로 trimming
      const result = trimMessages(messages, {
        provider: "anthropic",
        preserveRecentCount: 4,
        isPlanMode: true,
      });

      // Then: 첫 번째 HumanMessage는 보존
      const humanMessages = result.messages.filter((msg) => msg instanceof HumanMessage);
      expect(humanMessages.length).toBeGreaterThan(0);
      expect(humanMessages[0].content).toBe("/finops 초기 요청");
    });

    it("should work when messages are fewer than preserveRecentCount", () => {
      // Given: 매우 적은 메시지 (preserveRecentCount보다 적음)
      const messages = [new HumanMessage({ content: "/finops" }), new AIMessage({ content: "Plan 생성" })];

      // When: Plan 모드로 trimming
      const result = trimMessages(messages, {
        provider: "anthropic",
        preserveRecentCount: 4,
        isPlanMode: true,
      });

      // Then: 모든 메시지 유지
      expect(result.messages.length).toBe(2);
      expect(result.wasTrimmed).toBe(false);
    });
  });

  describe("기존 기능 회귀 테스트", () => {
    it("should trim messages when token limit exceeded (existing behavior)", () => {
      // Given: 토큰 한도 초과하는 메시지
      const longContent = "A".repeat(10000);
      const messages = Array.from({ length: 20 }, (_, i) => new AIMessage({ content: `${i}: ${longContent}` }));

      // When: 낮은 토큰 한도로 trimming
      const result = trimMessages(messages, {
        provider: "anthropic",
        maxTokens: 10000,
      });

      // Then: trimming 발생
      expect(result.wasTrimmed).toBe(true);
      expect(result.trimmedCount).toBeLessThan(result.originalCount);
    });

    it("should preserve recent messages by default", () => {
      // Given: 많은 메시지
      const messages = Array.from({ length: 20 }, (_, i) => new HumanMessage({ content: `메시지 ${i}` }));

      // When: preserveRecentCount=4로 trimming
      const result = trimMessages(messages, {
        provider: "anthropic",
        preserveRecentCount: 4,
        maxTokens: 100, // 강제 trimming
      });

      // Then: 최근 4개 이상 보존 시도
      expect(result.messages.length).toBeGreaterThanOrEqual(4);

      // 가장 최근 메시지 확인
      const lastMessage = result.messages[result.messages.length - 1];
      expect(lastMessage.content).toBe("메시지 19");
    });
  });
});
