/**
 * 🎯 목적: AuditLogger 클래스 테스트
 * 01: AuditLogger 구현 (TDD - RED)
 *
 * 📝 테스트 범위:
 * - 로그 기록 기능
 * - FIFO 로그 관리 (최대 1000개)
 * - 민감 정보 마스킹
 * - 로그 조회 및 필터링
 * - 내보내기/가져오기
 *
 * @packageDocumentation
 */

import { AuditLogger } from "../audit-logger";
import { AUDIT_LOGGER_DEFAULTS, type AuditLogEntry, type AuditLoggerConfig } from "../audit-types";

// ============================================
// 🎯 테스트 설정
// ============================================

describe("AuditLogger", () => {
  let logger: AuditLogger;

  beforeEach(() => {
    // 각 테스트 전 새 인스턴스 생성
    logger = new AuditLogger();
  });

  afterEach(() => {
    // 테스트 후 정리
    logger.clear();
  });

  // ============================================
  // 🎯 인스턴스 생성 테스트
  // ============================================

  describe("인스턴스 생성", () => {
    it("기본 설정으로 생성되어야 함", () => {
      const newLogger = new AuditLogger();
      expect(newLogger).toBeInstanceOf(AuditLogger);
      expect(newLogger.getLogCount()).toBe(0);
    });

    it("커스텀 설정으로 생성되어야 함", () => {
      const config: AuditLoggerConfig = {
        maxEntries: 500,
        autoMasking: false,
      };
      const customLogger = new AuditLogger(config);
      expect(customLogger).toBeInstanceOf(AuditLogger);
    });

    it("싱글톤 패턴으로 getInstance 사용 가능해야 함", () => {
      const instance1 = AuditLogger.getInstance();
      const instance2 = AuditLogger.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  // ============================================
  // 🎯 log() 메서드 테스트
  // ============================================

  describe("log()", () => {
    it("새 로그 엔트리를 기록해야 함", () => {
      const entry = logger.log({
        action: "tool_call",
        toolName: "kubectl",
        args: { command: "get pods" },
        result: "success",
        severity: "info",
      });

      expect(entry).toHaveProperty("id");
      expect(entry).toHaveProperty("timestamp");
      expect(entry.action).toBe("tool_call");
      expect(entry.toolName).toBe("kubectl");
      expect(entry.result).toBe("success");
    });

    it("고유한 ID를 자동 생성해야 함", () => {
      const entry1 = logger.log({
        action: "tool_call",
        result: "success",
        severity: "info",
      });
      const entry2 = logger.log({
        action: "tool_call",
        result: "success",
        severity: "info",
      });

      expect(entry1.id).not.toBe(entry2.id);
    });

    it("타임스탬프를 자동 설정해야 함", () => {
      const before = new Date().toISOString();
      const entry = logger.log({
        action: "session_start",
        result: "success",
        severity: "info",
      });
      const after = new Date().toISOString();

      expect(entry.timestamp >= before).toBe(true);
      expect(entry.timestamp <= after).toBe(true);
    });

    it("로그 개수가 증가해야 함", () => {
      expect(logger.getLogCount()).toBe(0);

      logger.log({ action: "session_start", result: "success", severity: "info" });
      expect(logger.getLogCount()).toBe(1);

      logger.log({ action: "tool_call", result: "success", severity: "info" });
      expect(logger.getLogCount()).toBe(2);
    });

    it("민감 정보가 자동으로 마스킹되어야 함", () => {
      const entry = logger.log({
        action: "tool_call",
        toolName: "kubectl",
        args: {
          command: "create secret",
          data: "password=mysecret123",
        },
        result: "success",
        severity: "info",
      });

      const argsStr = JSON.stringify(entry.args);
      expect(argsStr).not.toContain("mysecret123");
      expect(argsStr).toContain("MASKED");
    });
  });

  // ============================================
  // 🎯 logToolCall() 헬퍼 메서드 테스트
  // ============================================

  describe("logToolCall()", () => {
    it("도구 호출 로그를 기록해야 함", () => {
      const entry = logger.logToolCall("kubectl", { command: "get pods", namespace: "default" }, "success", 150);

      expect(entry.action).toBe("tool_call");
      expect(entry.toolName).toBe("kubectl");
      expect(entry.args).toEqual({ command: "get pods", namespace: "default" });
      expect(entry.result).toBe("success");
      expect(entry.durationMs).toBe(150);
      expect(entry.severity).toBe("info");
    });

    it("에러 결과 시 severity가 error이어야 함", () => {
      const entry = logger.logToolCall("kubectl", { command: "delete pod" }, "error");

      expect(entry.result).toBe("error");
      expect(entry.severity).toBe("error");
    });

    it("durationMs가 선택적이어야 함", () => {
      const entry = logger.logToolCall("helm", { chart: "nginx" }, "success");

      expect(entry.durationMs).toBeUndefined();
    });
  });

  // ============================================
  // 🎯 logHitlApprove() 메서드 테스트
  // ============================================

  describe("logHitlApprove()", () => {
    it("HITL 승인 로그를 기록해야 함", () => {
      const entry = logger.logHitlApprove("kubectl", { command: "apply -f deployment.yaml" });

      expect(entry.action).toBe("hitl_approve");
      expect(entry.toolName).toBe("kubectl");
      expect(entry.result).toBe("success");
      expect(entry.severity).toBe("info");
    });
  });

  // ============================================
  // 🎯 logHitlReject() 메서드 테스트
  // ============================================

  describe("logHitlReject()", () => {
    it("HITL 거부 로그를 기록해야 함", () => {
      const entry = logger.logHitlReject("kubectl", { command: "delete namespace production" }, "위험한 작업");

      expect(entry.action).toBe("hitl_reject");
      expect(entry.toolName).toBe("kubectl");
      expect(entry.result).toBe("cancelled");
      expect(entry.severity).toBe("warn");
      expect(entry.metadata?.reason).toBe("위험한 작업");
    });

    it("거부 사유 없이도 기록 가능해야 함", () => {
      const entry = logger.logHitlReject("helm", { chart: "dangerous-chart" });

      expect(entry.action).toBe("hitl_reject");
      expect(entry.metadata?.reason).toBeUndefined();
    });
  });

  // ============================================
  // 🎯 logError() 메서드 테스트
  // ============================================

  describe("logError()", () => {
    it("Error 객체로 에러 로그를 기록해야 함", () => {
      const error = new Error("Connection failed");
      const entry = logger.logError(error, { cluster: "production" });

      expect(entry.action).toBe("error");
      expect(entry.result).toBe("error");
      expect(entry.severity).toBe("error");
      expect(entry.errorMessage).toBe("Connection failed");
      expect(entry.metadata?.cluster).toBe("production");
    });

    it("문자열로 에러 로그를 기록해야 함", () => {
      const entry = logger.logError("Timeout occurred");

      expect(entry.errorMessage).toBe("Timeout occurred");
    });

    it("컨텍스트 없이도 기록 가능해야 함", () => {
      const entry = logger.logError(new Error("Simple error"));

      expect(entry.errorMessage).toBe("Simple error");
      expect(entry.metadata).toBeUndefined();
    });
  });

  // ============================================
  // 🎯 getRecentLogs() 메서드 테스트
  // ============================================

  describe("getRecentLogs()", () => {
    beforeEach(() => {
      // 5개 로그 생성
      for (let i = 0; i < 5; i++) {
        logger.log({
          action: "tool_call",
          toolName: `tool-${i}`,
          result: "success",
          severity: "info",
        });
      }
    });

    it("최근 N개 로그를 반환해야 함", () => {
      const logs = logger.getRecentLogs(3);
      expect(logs).toHaveLength(3);
    });

    it("최신순으로 정렬되어야 함", () => {
      const logs = logger.getRecentLogs(5);
      // 마지막에 추가된 것이 첫 번째
      expect(logs[0].toolName).toBe("tool-4");
      expect(logs[4].toolName).toBe("tool-0");
    });

    it("전체 개수보다 많이 요청하면 전체 반환해야 함", () => {
      const logs = logger.getRecentLogs(100);
      expect(logs).toHaveLength(5);
    });

    it("0개 요청하면 빈 배열 반환해야 함", () => {
      const logs = logger.getRecentLogs(0);
      expect(logs).toHaveLength(0);
    });

    it("음수 요청하면 빈 배열 반환해야 함", () => {
      const logs = logger.getRecentLogs(-1);
      expect(logs).toHaveLength(0);
    });
  });

  // ============================================
  // 🎯 getLogsByAction() 메서드 테스트
  // ============================================

  describe("getLogsByAction()", () => {
    beforeEach(() => {
      logger.log({ action: "tool_call", result: "success", severity: "info" });
      logger.log({ action: "hitl_approve", result: "success", severity: "info" });
      logger.log({ action: "tool_call", result: "success", severity: "info" });
      logger.log({ action: "error", result: "error", severity: "error" });
      logger.log({ action: "tool_call", result: "success", severity: "info" });
    });

    it("특정 액션의 로그만 반환해야 함", () => {
      const toolLogs = logger.getLogsByAction("tool_call");
      expect(toolLogs).toHaveLength(3);
      toolLogs.forEach((log) => expect(log.action).toBe("tool_call"));
    });

    it("count 파라미터로 개수를 제한할 수 있어야 함", () => {
      const logs = logger.getLogsByAction("tool_call", 2);
      expect(logs).toHaveLength(2);
    });

    it("해당 액션이 없으면 빈 배열 반환해야 함", () => {
      const logs = logger.getLogsByAction("mcp_call");
      expect(logs).toHaveLength(0);
    });
  });

  // ============================================
  // 🎯 getLogsBySession() 메서드 테스트
  // ============================================

  describe("getLogsBySession()", () => {
    beforeEach(() => {
      logger.log({ action: "session_start", result: "success", severity: "info", sessionId: "session-1" });
      logger.log({ action: "tool_call", result: "success", severity: "info", sessionId: "session-1" });
      logger.log({ action: "tool_call", result: "success", severity: "info", sessionId: "session-2" });
      logger.log({ action: "session_end", result: "success", severity: "info", sessionId: "session-1" });
    });

    it("특정 세션의 로그만 반환해야 함", () => {
      const session1Logs = logger.getLogsBySession("session-1");
      expect(session1Logs).toHaveLength(3);
      session1Logs.forEach((log) => expect(log.sessionId).toBe("session-1"));
    });

    it("존재하지 않는 세션은 빈 배열 반환해야 함", () => {
      const logs = logger.getLogsBySession("non-existent");
      expect(logs).toHaveLength(0);
    });
  });

  // ============================================
  // 🎯 FIFO 로그 관리 테스트
  // ============================================

  describe("FIFO 로그 관리 (최대 1000개)", () => {
    it("maxEntries 초과 시 오래된 로그가 제거되어야 함", () => {
      const smallLogger = new AuditLogger({ maxEntries: 5 });

      // 7개 로그 추가 (최대 5개)
      for (let i = 0; i < 7; i++) {
        smallLogger.log({
          action: "tool_call",
          toolName: `tool-${i}`,
          result: "success",
          severity: "info",
        });
      }

      expect(smallLogger.getLogCount()).toBe(5);

      // 최신 5개만 남아있어야 함 (tool-2, tool-3, tool-4, tool-5, tool-6)
      const logs = smallLogger.getRecentLogs(5);
      expect(logs[0].toolName).toBe("tool-6");
      expect(logs[4].toolName).toBe("tool-2");
    });

    it("기본 maxEntries는 1000이어야 함", () => {
      // 1001개 로그 추가는 시간이 오래 걸리므로 설정만 확인
      expect(AUDIT_LOGGER_DEFAULTS.maxEntries).toBe(1000);
    });
  });

  // ============================================
  // 🎯 maskSensitiveData() 메서드 테스트
  // ============================================

  describe("maskSensitiveData()", () => {
    describe("문자열 마스킹", () => {
      it("API 키를 마스킹해야 함", () => {
        const data = "api_key=sk-1234567890abcdef";
        const masked = logger.maskSensitiveData(data);
        expect(masked).not.toContain("sk-1234567890abcdef");
        expect(masked).toContain("MASKED");
      });

      it("Bearer 토큰을 마스킹해야 함", () => {
        const data = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
        const masked = logger.maskSensitiveData(data);
        expect(masked).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
        expect(masked).toContain("MASKED");
      });

      it("비밀번호를 마스킹해야 함", () => {
        const data = 'password="super_secret_123"';
        const masked = logger.maskSensitiveData(data);
        expect(masked).not.toContain("super_secret_123");
        expect(masked).toContain("MASKED");
      });

      it("Secret 값을 마스킹해야 함", () => {
        const data = "secret: my-k8s-secret-value";
        const masked = logger.maskSensitiveData(data);
        expect(masked).not.toContain("my-k8s-secret-value");
        expect(masked).toContain("MASKED");
      });

      it("Private Key를 마스킹해야 함", () => {
        const data = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASC...
-----END PRIVATE KEY-----`;
        const masked = logger.maskSensitiveData(data);
        expect(masked).not.toContain("MIIEvgIBADANBgkqhkiG9w0BAQEFAASC");
        expect(masked).toContain("MASKED");
      });

      it("AWS Access Key를 마스킹해야 함", () => {
        const data = "aws_access_key_id=AKIAIOSFODNN7EXAMPLE";
        const masked = logger.maskSensitiveData(data);
        expect(masked).not.toContain("AKIAIOSFODNN7EXAMPLE");
        expect(masked).toContain("MASKED");
      });
    });

    describe("객체 마스킹", () => {
      it("객체 내 민감 정보를 마스킹해야 함", () => {
        const data = {
          command: "kubectl create secret",
          config: {
            apiKey: "api_key=secret123",
            password: "password=admin",
          },
        };
        const masked = logger.maskSensitiveData(data);
        expect(JSON.stringify(masked)).not.toContain("secret123");
        expect(JSON.stringify(masked)).not.toContain("admin");
      });

      it("중첩 객체도 마스킹해야 함", () => {
        const data = {
          level1: {
            level2: {
              level3: {
                token: "token=deep-secret",
              },
            },
          },
        };
        const masked = logger.maskSensitiveData(data);
        expect(JSON.stringify(masked)).not.toContain("deep-secret");
      });
    });

    describe("배열 마스킹", () => {
      it("배열 내 민감 정보를 마스킹해야 함", () => {
        const data = ["password=secret1", "api_key=secret2", "normal-value"];
        const masked = logger.maskSensitiveData(data);
        expect(JSON.stringify(masked)).not.toContain("secret1");
        expect(JSON.stringify(masked)).not.toContain("secret2");
        expect(JSON.stringify(masked)).toContain("normal-value");
      });
    });

    describe("특수 케이스", () => {
      it("null은 그대로 반환해야 함", () => {
        expect(logger.maskSensitiveData(null)).toBeNull();
      });

      it("undefined는 그대로 반환해야 함", () => {
        expect(logger.maskSensitiveData(undefined)).toBeUndefined();
      });

      it("숫자는 그대로 반환해야 함", () => {
        expect(logger.maskSensitiveData(12345)).toBe(12345);
      });

      it("boolean은 그대로 반환해야 함", () => {
        expect(logger.maskSensitiveData(true)).toBe(true);
      });

      it("민감 정보가 없는 문자열은 그대로 반환해야 함", () => {
        const data = "kubectl get pods -n default";
        expect(logger.maskSensitiveData(data)).toBe(data);
      });
    });
  });

  // ============================================
  // 🎯 autoMasking 설정 테스트
  // ============================================

  describe("autoMasking 설정", () => {
    it("autoMasking=false면 마스킹하지 않아야 함", () => {
      const noMaskLogger = new AuditLogger({ autoMasking: false });
      const entry = noMaskLogger.log({
        action: "tool_call",
        args: { password: "password=visible" },
        result: "success",
        severity: "info",
      });

      expect(JSON.stringify(entry.args)).toContain("visible");
    });
  });

  // ============================================
  // 🎯 clear() 메서드 테스트
  // ============================================

  describe("clear()", () => {
    it("모든 로그를 삭제해야 함", () => {
      logger.log({ action: "tool_call", result: "success", severity: "info" });
      logger.log({ action: "session_start", result: "success", severity: "info" });

      expect(logger.getLogCount()).toBe(2);

      logger.clear();

      expect(logger.getLogCount()).toBe(0);
      expect(logger.getRecentLogs(10)).toHaveLength(0);
    });
  });

  // ============================================
  // 🎯 export() / import() 메서드 테스트
  // ============================================

  describe("export() / import()", () => {
    it("로그를 JSON으로 내보내야 함", () => {
      logger.log({ action: "tool_call", toolName: "kubectl", result: "success", severity: "info" });
      logger.log({ action: "session_start", result: "success", severity: "info" });

      const exported = logger.export();
      expect(typeof exported).toBe("string");

      const parsed = JSON.parse(exported);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
    });

    it("JSON에서 로그를 가져와야 함", () => {
      const jsonData = JSON.stringify([
        {
          id: "imported-1",
          timestamp: "2026-01-05T10:00:00.000Z",
          action: "tool_call",
          result: "success",
          severity: "info",
        },
        {
          id: "imported-2",
          timestamp: "2026-01-05T10:01:00.000Z",
          action: "session_end",
          result: "success",
          severity: "info",
        },
      ]);

      logger.import(jsonData);

      expect(logger.getLogCount()).toBe(2);
      const logs = logger.getRecentLogs(2);
      expect(logs.some((l) => l.id === "imported-1")).toBe(true);
      expect(logs.some((l) => l.id === "imported-2")).toBe(true);
    });

    it("잘못된 JSON은 에러를 발생시켜야 함", () => {
      expect(() => logger.import("not valid json")).toThrow();
    });

    it("빈 배열도 가져올 수 있어야 함", () => {
      logger.log({ action: "tool_call", result: "success", severity: "info" });
      logger.import("[]");
      expect(logger.getLogCount()).toBe(0);
    });
  });

  // ============================================
  // 🎯 getLogCount() 메서드 테스트
  // ============================================

  describe("getLogCount()", () => {
    it("초기 로그 개수는 0이어야 함", () => {
      expect(logger.getLogCount()).toBe(0);
    });

    it("로그 추가 시 개수가 증가해야 함", () => {
      logger.log({ action: "tool_call", result: "success", severity: "info" });
      expect(logger.getLogCount()).toBe(1);

      logger.log({ action: "session_start", result: "success", severity: "info" });
      expect(logger.getLogCount()).toBe(2);
    });

    it("clear() 후 개수는 0이어야 함", () => {
      logger.log({ action: "tool_call", result: "success", severity: "info" });
      logger.log({ action: "session_start", result: "success", severity: "info" });
      logger.clear();
      expect(logger.getLogCount()).toBe(0);
    });
  });
});
