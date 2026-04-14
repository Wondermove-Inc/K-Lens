/**
 * 🎯 THEME-040: Semantic Status Utility 단위 테스트
 * 📝 Pod/Workload 상태를 시맨틱 색상으로 매핑하는 유틸리티 테스트
 */

import {
  getBadgeStatusClasses,
  getSemanticStatus,
  getStatusClasses,
  getStatusCSSVars,
  type SemanticStatus,
} from "../semantic-status";

describe("semantic-status utility", () => {
  describe("getSemanticStatus", () => {
    describe("Running/Active 상태", () => {
      it.each([
        ["Running", "running"],
        ["running", "running"],
        ["RUNNING", "running"],
        ["ContainerCreating", "running"],
        ["container-creating", "running"],
        ["PodInitializing", "running"],
        ["ContainersReady", "running"],
      ])('"%s" → "%s"', (input, expected) => {
        expect(getSemanticStatus(input)).toBe(expected);
      });
    });

    describe("Success 상태", () => {
      it.each([
        ["Succeeded", "success"],
        ["succeeded", "success"],
        ["Completed", "success"],
        ["completed", "success"],
        ["Complete", "success"],
        ["Ready", "success"],
        ["Scheduled", "success"],
        ["Initialized", "success"],
      ])('"%s" → "%s"', (input, expected) => {
        expect(getSemanticStatus(input)).toBe(expected);
      });
    });

    describe("Warning/Pending 상태", () => {
      it.each([
        ["Pending", "warning"],
        ["pending", "warning"],
        ["Waiting", "warning"],
        ["waiting", "warning"],
        ["Init:Waiting", "warning"],
      ])('"%s" → "%s"', (input, expected) => {
        expect(getSemanticStatus(input)).toBe(expected);
      });
    });

    describe("Error 상태", () => {
      it.each([
        ["Failed", "error"],
        ["failed", "error"],
        ["Error", "error"],
        ["error", "error"],
        ["CrashLoopBackOff", "error"],
        ["crash-loop-back-off", "error"],
        ["crashloopbackoff", "error"],
        ["Evicted", "error"],
        ["evicted", "error"],
        ["ImagePullBackOff", "error"],
        ["ErrImagePull", "error"],
        ["OOMKilled", "error"],
      ])('"%s" → "%s"', (input, expected) => {
        expect(getSemanticStatus(input)).toBe(expected);
      });
    });

    describe("Neutral 상태", () => {
      it.each([
        ["Terminated", "neutral"],
        ["terminated", "neutral"],
        ["Terminating", "neutral"],
        ["terminating", "neutral"],
        ["Finalizing", "neutral"],
        ["Unknown", "neutral"],
        ["unknown", "neutral"],
        ["Restarted", "neutral"],
      ])('"%s" → "%s"', (input, expected) => {
        expect(getSemanticStatus(input)).toBe(expected);
      });
    });

    describe("엣지 케이스", () => {
      it("빈 문자열은 neutral 반환", () => {
        expect(getSemanticStatus("")).toBe("neutral");
      });

      it("알 수 없는 상태는 neutral 반환", () => {
        expect(getSemanticStatus("SomeUnknownStatus")).toBe("neutral");
        expect(getSemanticStatus("RandomString123")).toBe("neutral");
      });

      it("CamelCase 정규화 처리", () => {
        expect(getSemanticStatus("CrashLoopBackOff")).toBe("error");
        expect(getSemanticStatus("ContainerCreating")).toBe("running");
      });

      it("부분 문자열 매칭", () => {
        expect(getSemanticStatus("StillRunning")).toBe("running");
        expect(getSemanticStatus("PartiallyCompleted")).toBe("success");
        expect(getSemanticStatus("SomethingFailed")).toBe("error");
        expect(getSemanticStatus("WaitingForSomething")).toBe("warning");
      });
    });
  });

  describe("getStatusClasses", () => {
    it("running 상태에 올바른 클래스 반환", () => {
      const classes = getStatusClasses("Running");
      expect(classes).toContain("bg-semantic-running");
      expect(classes).toContain("text-semantic-running-text");
    });

    it("success 상태에 올바른 클래스 반환", () => {
      const classes = getStatusClasses("Succeeded");
      expect(classes).toContain("bg-semantic-success");
      expect(classes).toContain("text-semantic-success-text");
    });

    it("warning 상태에 올바른 클래스 반환", () => {
      const classes = getStatusClasses("Pending");
      expect(classes).toContain("bg-semantic-warning");
      expect(classes).toContain("text-semantic-warning-text");
    });

    it("error 상태에 올바른 클래스 반환", () => {
      const classes = getStatusClasses("Failed");
      expect(classes).toContain("bg-semantic-error");
      expect(classes).toContain("text-semantic-error-text");
    });

    it("neutral 상태에 올바른 클래스 반환", () => {
      const classes = getStatusClasses("Unknown");
      expect(classes).toContain("bg-semantic-neutral");
      expect(classes).toContain("text-semantic-neutral-text");
    });
  });

  describe("getStatusCSSVars", () => {
    it("running 상태에 올바른 CSS 변수 반환", () => {
      const vars = getStatusCSSVars("Running");
      expect(vars.bg).toBe("var(--semantic-running)");
      expect(vars.text).toBe("var(--semantic-running-text)");
    });

    it("success 상태에 올바른 CSS 변수 반환", () => {
      const vars = getStatusCSSVars("Succeeded");
      expect(vars.bg).toBe("var(--semantic-success)");
      expect(vars.text).toBe("var(--semantic-success-text)");
    });

    it("warning 상태에 올바른 CSS 변수 반환", () => {
      const vars = getStatusCSSVars("Pending");
      expect(vars.bg).toBe("var(--semantic-warning)");
      expect(vars.text).toBe("var(--semantic-warning-text)");
    });

    it("error 상태에 올바른 CSS 변수 반환", () => {
      const vars = getStatusCSSVars("Failed");
      expect(vars.bg).toBe("var(--semantic-error)");
      expect(vars.text).toBe("var(--semantic-error-text)");
    });

    it("neutral 상태에 올바른 CSS 변수 반환", () => {
      const vars = getStatusCSSVars("Unknown");
      expect(vars.bg).toBe("var(--semantic-neutral)");
      expect(vars.text).toBe("var(--semantic-neutral-text)");
    });
  });

  describe("getBadgeStatusClasses", () => {
    it("running 상태에 Badge 전용 클래스 반환", () => {
      const classes = getBadgeStatusClasses("Running");
      expect(classes).toContain("bg-badge-running-bg");
      expect(classes).toContain("text-badge-running-fg");
      expect(classes).toContain("hover:opacity-90");
    });

    it("success 상태에 Badge 전용 클래스 반환", () => {
      const classes = getBadgeStatusClasses("Succeeded");
      expect(classes).toContain("bg-badge-succeeded-bg");
      expect(classes).toContain("text-badge-succeeded-fg");
    });

    it("warning 상태에 Badge 전용 클래스 반환", () => {
      const classes = getBadgeStatusClasses("Pending");
      expect(classes).toContain("bg-badge-pending-bg");
      expect(classes).toContain("text-badge-pending-fg");
    });

    it("error 상태에 Badge 전용 클래스 반환", () => {
      const classes = getBadgeStatusClasses("Failed");
      expect(classes).toContain("bg-badge-failed-bg");
      expect(classes).toContain("text-badge-failed-fg");
    });

    it("neutral 상태에 Badge 전용 클래스 반환", () => {
      const classes = getBadgeStatusClasses("Unknown");
      expect(classes).toContain("bg-badge-unknown-bg");
      expect(classes).toContain("text-badge-unknown-fg");
    });
  });

  describe("SemanticStatus 타입", () => {
    it("5가지 상태만 허용", () => {
      const validStatuses: SemanticStatus[] = ["running", "success", "warning", "error", "neutral"];

      validStatuses.forEach((status) => {
        expect(["running", "success", "warning", "error", "neutral"]).toContain(status);
      });
    });
  });
});
