/**
 * 🎯 목적: Feature Flags 모듈 단위 테스트
 *
 * 01: Feature Flags 상수 및 유틸리티 함수
 *
 * 테스트 범위:
 * - AI_ASSISTANT_FLAGS 상수 정의 검증
 * - FEATURE_GROUPS 그룹 정의 검증
 * - isFeatureEnabled 함수 동작 검증
 * - enableFeatureGroup 함수 동작 검증
 * - 환경 변수 오버라이드 검증
 *
 * @packageDocumentation
 */

import {
  AI_ASSISTANT_FLAGS,
  disableFeatureGroup,
  enableFeatureGroup,
  FEATURE_GROUPS,
  type FeatureFlagKey,
  type FeatureGroupKey,
  isFeatureEnabled,
  resetFeatureFlags,
} from "../feature-flags";

describe("Feature Flags 모듈", () => {
  // 각 테스트 후 상태 초기화
  afterEach(() => {
    resetFeatureFlags();
  });

  describe("AI_ASSISTANT_FLAGS 상수", () => {
    it("AC1: 모든 PRD 기능에 대한 Flag가 정의되어 있어야 한다", () => {
      // Phase 1 기능
      expect(AI_ASSISTANT_FLAGS).toHaveProperty("CONTEXT_PILLS");
      expect(AI_ASSISTANT_FLAGS).toHaveProperty("MENTION_AUTOCOMPLETE");
      expect(AI_ASSISTANT_FLAGS).toHaveProperty("SLASH_COMMANDS");
      expect(AI_ASSISTANT_FLAGS).toHaveProperty("MCP_INTEGRATION");

      // Phase 1+ 기능
      expect(AI_ASSISTANT_FLAGS).toHaveProperty("STREAMING_RESPONSE");
      expect(AI_ASSISTANT_FLAGS).toHaveProperty("THINKING_INDICATOR");
      expect(AI_ASSISTANT_FLAGS).toHaveProperty("PLAN_MODE");

      // Phase 2 기능
      expect(AI_ASSISTANT_FLAGS).toHaveProperty("DIFF_VIEWER");
      expect(AI_ASSISTANT_FLAGS).toHaveProperty("AGENT_MODE");
      expect(AI_ASSISTANT_FLAGS).toHaveProperty("SESSION_RESUME");

      // Phase 3 기능
      expect(AI_ASSISTANT_FLAGS).toHaveProperty("AUDIT_LOGGING");
      expect(AI_ASSISTANT_FLAGS).toHaveProperty("IMAGE_ATTACHMENT");
      expect(AI_ASSISTANT_FLAGS).toHaveProperty("BACKGROUND_AGENT");
    });

    it("P0 기능은 기본적으로 활성화되어 있어야 한다", () => {
      // P0 기능 (v2.0)
      expect(AI_ASSISTANT_FLAGS.CONTEXT_PILLS).toBe(true);
      expect(AI_ASSISTANT_FLAGS.MENTION_AUTOCOMPLETE).toBe(true);
      expect(AI_ASSISTANT_FLAGS.SLASH_COMMANDS).toBe(true);
      expect(AI_ASSISTANT_FLAGS.MCP_INTEGRATION).toBe(true);

      // P0 기능 (v2.1 Gap 분석 기반)
      expect(AI_ASSISTANT_FLAGS.STREAMING_RESPONSE).toBe(true);
      expect(AI_ASSISTANT_FLAGS.THINKING_INDICATOR).toBe(true);
      expect(AI_ASSISTANT_FLAGS.PLAN_MODE).toBe(true);
    });

    it("P1/P2 기능은 기본적으로 비활성화되어 있어야 한다", () => {
      // P1 기능
      expect(AI_ASSISTANT_FLAGS.DIFF_VIEWER).toBe(false);
      expect(AI_ASSISTANT_FLAGS.AUDIT_LOGGING).toBe(false);
      expect(AI_ASSISTANT_FLAGS.AGENT_MODE).toBe(false);
      expect(AI_ASSISTANT_FLAGS.SESSION_RESUME).toBe(false);

      // P2 기능
      expect(AI_ASSISTANT_FLAGS.IMAGE_ATTACHMENT).toBe(false);
    });
  });

  describe("FEATURE_GROUPS 상수", () => {
    it("AC2: Phase별 그룹이 정의되어 있어야 한다", () => {
      expect(FEATURE_GROUPS).toHaveProperty("PHASE_1");
      expect(FEATURE_GROUPS).toHaveProperty("PHASE_1_PLUS");
      expect(FEATURE_GROUPS).toHaveProperty("PHASE_2");
      expect(FEATURE_GROUPS).toHaveProperty("PHASE_3");
    });

    it("PHASE_1 그룹에 올바른 Flag가 포함되어야 한다", () => {
      expect(FEATURE_GROUPS.PHASE_1).toContain("CONTEXT_PILLS");
      expect(FEATURE_GROUPS.PHASE_1).toContain("MENTION_AUTOCOMPLETE");
      expect(FEATURE_GROUPS.PHASE_1).toContain("SLASH_COMMANDS");
      expect(FEATURE_GROUPS.PHASE_1).toContain("MCP_INTEGRATION");
    });

    it("PHASE_1_PLUS 그룹에 올바른 Flag가 포함되어야 한다", () => {
      expect(FEATURE_GROUPS.PHASE_1_PLUS).toContain("STREAMING_RESPONSE");
      expect(FEATURE_GROUPS.PHASE_1_PLUS).toContain("THINKING_INDICATOR");
      expect(FEATURE_GROUPS.PHASE_1_PLUS).toContain("PLAN_MODE");
    });

    it("PHASE_2 그룹에 올바른 Flag가 포함되어야 한다", () => {
      expect(FEATURE_GROUPS.PHASE_2).toContain("DIFF_VIEWER");
      expect(FEATURE_GROUPS.PHASE_2).toContain("AGENT_MODE");
      expect(FEATURE_GROUPS.PHASE_2).toContain("SESSION_RESUME");
    });

    it("PHASE_3 그룹에 올바른 Flag가 포함되어야 한다", () => {
      expect(FEATURE_GROUPS.PHASE_3).toContain("AUDIT_LOGGING");
      expect(FEATURE_GROUPS.PHASE_3).toContain("IMAGE_ATTACHMENT");
      expect(FEATURE_GROUPS.PHASE_3).toContain("BACKGROUND_AGENT");
    });
  });

  describe("isFeatureEnabled 함수", () => {
    it("AC3: 활성화된 기능에 대해 true를 반환해야 한다", () => {
      expect(isFeatureEnabled("CONTEXT_PILLS")).toBe(true);
      expect(isFeatureEnabled("STREAMING_RESPONSE")).toBe(true);
    });

    it("비활성화된 기능에 대해 false를 반환해야 한다", () => {
      expect(isFeatureEnabled("DIFF_VIEWER")).toBe(false);
      expect(isFeatureEnabled("AGENT_MODE")).toBe(false);
    });

    it("존재하지 않는 기능에 대해 false를 반환해야 한다", () => {
      // @ts-expect-error 존재하지 않는 기능 테스트
      expect(isFeatureEnabled("NON_EXISTENT_FEATURE")).toBe(false);
    });
  });

  describe("enableFeatureGroup 함수", () => {
    it("AC4: 그룹 단위로 기능을 활성화할 수 있어야 한다", () => {
      // 초기 상태: PHASE_2 기능들은 비활성화
      expect(isFeatureEnabled("DIFF_VIEWER")).toBe(false);
      expect(isFeatureEnabled("AGENT_MODE")).toBe(false);
      expect(isFeatureEnabled("SESSION_RESUME")).toBe(false);

      // PHASE_2 그룹 활성화
      enableFeatureGroup("PHASE_2");

      // 활성화 후 확인
      expect(isFeatureEnabled("DIFF_VIEWER")).toBe(true);
      expect(isFeatureEnabled("AGENT_MODE")).toBe(true);
      expect(isFeatureEnabled("SESSION_RESUME")).toBe(true);
    });

    it("다른 그룹의 기능에 영향을 주지 않아야 한다", () => {
      // 초기 상태: PHASE_3 기능들은 비활성화
      expect(isFeatureEnabled("AUDIT_LOGGING")).toBe(false);

      // PHASE_2 그룹만 활성화
      enableFeatureGroup("PHASE_2");

      // PHASE_3 기능들은 여전히 비활성화
      expect(isFeatureEnabled("AUDIT_LOGGING")).toBe(false);
      expect(isFeatureEnabled("IMAGE_ATTACHMENT")).toBe(false);
    });
  });

  describe("disableFeatureGroup 함수", () => {
    it("그룹 단위로 기능을 비활성화할 수 있어야 한다", () => {
      // 초기 상태: PHASE_1 기능들은 활성화
      expect(isFeatureEnabled("CONTEXT_PILLS")).toBe(true);
      expect(isFeatureEnabled("MENTION_AUTOCOMPLETE")).toBe(true);

      // PHASE_1 그룹 비활성화
      disableFeatureGroup("PHASE_1");

      // 비활성화 후 확인
      expect(isFeatureEnabled("CONTEXT_PILLS")).toBe(false);
      expect(isFeatureEnabled("MENTION_AUTOCOMPLETE")).toBe(false);
    });
  });

  describe("resetFeatureFlags 함수", () => {
    it("모든 기능을 기본 상태로 리셋할 수 있어야 한다", () => {
      // PHASE_2 활성화
      enableFeatureGroup("PHASE_2");
      expect(isFeatureEnabled("DIFF_VIEWER")).toBe(true);

      // PHASE_1 비활성화
      disableFeatureGroup("PHASE_1");
      expect(isFeatureEnabled("CONTEXT_PILLS")).toBe(false);

      // 리셋
      resetFeatureFlags();

      // 기본 상태로 복원 확인
      expect(isFeatureEnabled("CONTEXT_PILLS")).toBe(true); // P0: 기본 활성화
      expect(isFeatureEnabled("DIFF_VIEWER")).toBe(false); // P1: 기본 비활성화
    });
  });

  describe("타입 안전성", () => {
    it("FeatureFlagKey 타입이 올바르게 정의되어야 한다", () => {
      // 타입 체크: 올바른 키만 허용
      const validKey: FeatureFlagKey = "CONTEXT_PILLS";

      expect(validKey).toBe("CONTEXT_PILLS");
    });

    it("FeatureGroupKey 타입이 올바르게 정의되어야 한다", () => {
      // 타입 체크: 올바른 그룹 키만 허용
      const validGroup: FeatureGroupKey = "PHASE_1";

      expect(validGroup).toBe("PHASE_1");
    });
  });
});
