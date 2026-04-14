/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * SECURITY_SCAN_PANEL Feature Flag 단위 test
 */

import {
  applySecurityFeatureEnvironmentOverrides,
  getEnabledSecurityFeatures,
  isSecurityFeatureEnabled,
  resetSecurityFeatureFlags,
  SECURITY_FLAGS,
  setSecurityFeatureEnabled,
} from "../feature-flags";

describe("Security Feature Flags", () => {
  beforeEach(() => {
    resetSecurityFeatureFlags();
  });

  describe("기본값", () => {
    it("SECURITY_SCAN_PANEL 기본값은 true다", () => {
      expect(isSecurityFeatureEnabled("SECURITY_SCAN_PANEL")).toBe(true);
    });

    it("RBAC_AUDIT 기본값은 false다", () => {
      expect(isSecurityFeatureEnabled("RBAC_AUDIT")).toBe(false);
    });

    it("AUTO_PATCH 기본값은 false다", () => {
      expect(isSecurityFeatureEnabled("AUTO_PATCH")).toBe(false);
    });

    it("SECURITY_REPORT 기본값은 false다", () => {
      expect(isSecurityFeatureEnabled("SECURITY_REPORT")).toBe(false);
    });
  });

  describe("setSecurityFeatureEnabled", () => {
    it("Flag를 false로 설정할 수 있다", () => {
      setSecurityFeatureEnabled("SECURITY_SCAN_PANEL", false);
      expect(isSecurityFeatureEnabled("SECURITY_SCAN_PANEL")).toBe(false);
    });

    it("Flag를 true로 설정할 수 있다", () => {
      setSecurityFeatureEnabled("RBAC_AUDIT", true);
      expect(isSecurityFeatureEnabled("RBAC_AUDIT")).toBe(true);
    });
  });

  describe("resetSecurityFeatureFlags", () => {
    it("변경 후 리셋하면 기본값으로 돌아온다", () => {
      setSecurityFeatureEnabled("SECURITY_SCAN_PANEL", false);
      setSecurityFeatureEnabled("RBAC_AUDIT", true);
      resetSecurityFeatureFlags();
      expect(isSecurityFeatureEnabled("SECURITY_SCAN_PANEL")).toBe(true);
      expect(isSecurityFeatureEnabled("RBAC_AUDIT")).toBe(false);
    });
  });

  describe("SECURITY_FLAGS Proxy", () => {
    it("SECURITY_FLAGS.SECURITY_SCAN_PANEL은 현재 상태를 반영한다", () => {
      expect(SECURITY_FLAGS.SECURITY_SCAN_PANEL).toBe(true);
      setSecurityFeatureEnabled("SECURITY_SCAN_PANEL", false);
      expect(SECURITY_FLAGS.SECURITY_SCAN_PANEL).toBe(false);
    });

    it("SECURITY_FLAGS 직접 수정 시도는 TypeError를 발생시킨다 (Proxy set trap)", () => {
      // Proxy set trap이 false를 반환하면 strict mode에서 TypeError 발생
      // 이는 의도된 동작 — 외부에서 직접 수정 불가
      expect(() => {
        (SECURITY_FLAGS as any).SECURITY_SCAN_PANEL = false;
      }).toThrow(TypeError);
    });
  });

  describe("getEnabledSecurityFeatures", () => {
    it("기본값에서는 SECURITY_SCAN_PANEL만 반환된다", () => {
      const enabled = getEnabledSecurityFeatures();
      expect(enabled).toEqual(["SECURITY_SCAN_PANEL"]);
    });

    it("Flag 활성화 후 목록에 포함된다", () => {
      setSecurityFeatureEnabled("RBAC_AUDIT", true);
      const enabled = getEnabledSecurityFeatures();
      expect(enabled).toContain("SECURITY_SCAN_PANEL");
      expect(enabled).toContain("RBAC_AUDIT");
    });
  });

  describe("applySecurityFeatureEnvironmentOverrides", () => {
    it("환경변수 SKUBERPLUS_FEATURE_SECURITY_SCAN_PANEL=false 오버라이드 적용", () => {
      process.env.SKUBERPLUS_FEATURE_SECURITY_SCAN_PANEL = "false";
      applySecurityFeatureEnvironmentOverrides();
      expect(isSecurityFeatureEnabled("SECURITY_SCAN_PANEL")).toBe(false);
      delete process.env.SKUBERPLUS_FEATURE_SECURITY_SCAN_PANEL;
    });

    it("환경변수 SKUBERPLUS_FEATURE_RBAC_AUDIT=true 오버라이드 적용", () => {
      process.env.SKUBERPLUS_FEATURE_RBAC_AUDIT = "true";
      applySecurityFeatureEnvironmentOverrides();
      expect(isSecurityFeatureEnabled("RBAC_AUDIT")).toBe(true);
      delete process.env.SKUBERPLUS_FEATURE_RBAC_AUDIT;
    });

    it("환경변수 없으면 기본값 유지", () => {
      applySecurityFeatureEnvironmentOverrides();
      expect(isSecurityFeatureEnabled("SECURITY_SCAN_PANEL")).toBe(true);
    });
  });
});
