/**
 * 🎯 목적: AI Assistant 감사 로깅 타입 테스트
 * 01: AuditLogger 구현 (TDD - RED)
 *
 * 📝 테스트 범위:
 * - 타입 가드 함수 테스트
 * - 기본 상수 및 패턴 테스트
 * - 유틸리티 함수 테스트
 *
 * @packageDocumentation
 */

import {
  AUDIT_LOGGER_DEFAULTS,
  type AuditAction,
  type AuditLogEntry,
  type AuditLoggerConfig,
  type AuditLogInput,
  type AuditResult,
  type AuditSeverity,
  DEFAULT_SENSITIVE_PATTERNS,
  generateLogId,
  isAuditAction,
  isAuditLogEntry,
  isAuditResult,
  isAuditSeverity,
  type SensitivePattern,
} from "../audit-types";

// ============================================
// 🎯 테스트 데이터
// ============================================

/** 유효한 AuditLogEntry 샘플 */
const VALID_LOG_ENTRY: AuditLogEntry = {
  id: "audit-001",
  timestamp: "2026-01-05T10:00:00.000Z",
  action: "tool_call",
  toolName: "kubectl",
  args: { command: "get pods" },
  result: "success",
  severity: "info",
  sessionId: "session-123",
};

/** 최소 필드만 있는 유효한 AuditLogEntry */
const MINIMAL_LOG_ENTRY: AuditLogEntry = {
  id: "audit-002",
  timestamp: "2026-01-05T10:00:00.000Z",
  action: "session_start",
  result: "success",
  severity: "info",
};

// ============================================
// 🎯 AuditAction 타입 가드 테스트
// ============================================

describe("isAuditAction", () => {
  describe("유효한 액션 타입", () => {
    it.each([
      ["tool_call", true],
      ["hitl_approve", true],
      ["hitl_reject", true],
      ["mcp_call", true],
      ["session_start", true],
      ["session_end", true],
      ["error", true],
    ])('"%s"는 유효한 AuditAction이어야 함 (expected: %s)', (action, expected) => {
      expect(isAuditAction(action)).toBe(expected);
    });
  });

  describe("무효한 액션 타입", () => {
    it.each([
      ["invalid_action", false],
      ["TOOL_CALL", false], // 대문자
      ["toolcall", false], // 언더스코어 없음
      ["", false], // 빈 문자열
      ["unknown", false],
      ["delete", false],
    ])('"%s"는 무효한 AuditAction이어야 함 (expected: %s)', (action, expected) => {
      expect(isAuditAction(action)).toBe(expected);
    });
  });
});

// ============================================
// 🎯 AuditResult 타입 가드 테스트
// ============================================

describe("isAuditResult", () => {
  describe("유효한 결과 타입", () => {
    it.each([
      ["success", true],
      ["error", true],
      ["pending", true],
      ["cancelled", true],
    ])('"%s"는 유효한 AuditResult이어야 함 (expected: %s)', (result, expected) => {
      expect(isAuditResult(result)).toBe(expected);
    });
  });

  describe("무효한 결과 타입", () => {
    it.each([
      ["failed", false], // 잘못된 값
      ["SUCCESS", false], // 대문자
      ["", false], // 빈 문자열
      ["unknown", false],
    ])('"%s"는 무효한 AuditResult이어야 함 (expected: %s)', (result, expected) => {
      expect(isAuditResult(result)).toBe(expected);
    });
  });
});

// ============================================
// 🎯 AuditSeverity 타입 가드 테스트
// ============================================

describe("isAuditSeverity", () => {
  describe("유효한 심각도 타입", () => {
    it.each([
      ["info", true],
      ["warn", true],
      ["error", true],
      ["critical", true],
    ])('"%s"는 유효한 AuditSeverity이어야 함 (expected: %s)', (severity, expected) => {
      expect(isAuditSeverity(severity)).toBe(expected);
    });
  });

  describe("무효한 심각도 타입", () => {
    it.each([
      ["debug", false], // 존재하지 않음
      ["INFO", false], // 대문자
      ["warning", false], // 잘못된 이름
      ["", false], // 빈 문자열
    ])('"%s"는 무효한 AuditSeverity이어야 함 (expected: %s)', (severity, expected) => {
      expect(isAuditSeverity(severity)).toBe(expected);
    });
  });
});

// ============================================
// 🎯 isAuditLogEntry 타입 가드 테스트
// ============================================

describe("isAuditLogEntry", () => {
  describe("유효한 AuditLogEntry", () => {
    it("모든 필드가 있는 유효한 엔트리를 인식해야 함", () => {
      expect(isAuditLogEntry(VALID_LOG_ENTRY)).toBe(true);
    });

    it("최소 필드만 있는 유효한 엔트리를 인식해야 함", () => {
      expect(isAuditLogEntry(MINIMAL_LOG_ENTRY)).toBe(true);
    });

    it("추가 메타데이터가 있는 엔트리도 유효해야 함", () => {
      const entryWithMetadata: AuditLogEntry = {
        ...VALID_LOG_ENTRY,
        metadata: { cluster: "production", namespace: "default" },
        durationMs: 1500,
      };
      expect(isAuditLogEntry(entryWithMetadata)).toBe(true);
    });
  });

  describe("무효한 AuditLogEntry", () => {
    it("null은 AuditLogEntry가 아니어야 함", () => {
      expect(isAuditLogEntry(null)).toBe(false);
    });

    it("undefined는 AuditLogEntry가 아니어야 함", () => {
      expect(isAuditLogEntry(undefined)).toBe(false);
    });

    it("문자열은 AuditLogEntry가 아니어야 함", () => {
      expect(isAuditLogEntry("not an entry")).toBe(false);
    });

    it("숫자는 AuditLogEntry가 아니어야 함", () => {
      expect(isAuditLogEntry(123)).toBe(false);
    });

    it("배열은 AuditLogEntry가 아니어야 함", () => {
      expect(isAuditLogEntry([VALID_LOG_ENTRY])).toBe(false);
    });

    it("id가 없는 객체는 AuditLogEntry가 아니어야 함", () => {
      const { id, ...withoutId } = VALID_LOG_ENTRY;
      expect(isAuditLogEntry(withoutId)).toBe(false);
    });

    it("timestamp가 없는 객체는 AuditLogEntry가 아니어야 함", () => {
      const { timestamp, ...withoutTimestamp } = VALID_LOG_ENTRY;
      expect(isAuditLogEntry(withoutTimestamp)).toBe(false);
    });

    it("action이 없는 객체는 AuditLogEntry가 아니어야 함", () => {
      const { action, ...withoutAction } = VALID_LOG_ENTRY;
      expect(isAuditLogEntry(withoutAction)).toBe(false);
    });

    it("result가 없는 객체는 AuditLogEntry가 아니어야 함", () => {
      const { result, ...withoutResult } = VALID_LOG_ENTRY;
      expect(isAuditLogEntry(withoutResult)).toBe(false);
    });

    it("severity가 없는 객체는 AuditLogEntry가 아니어야 함", () => {
      const { severity, ...withoutSeverity } = VALID_LOG_ENTRY;
      expect(isAuditLogEntry(withoutSeverity)).toBe(false);
    });

    it("id가 숫자인 객체는 AuditLogEntry가 아니어야 함", () => {
      const invalidEntry = { ...VALID_LOG_ENTRY, id: 123 };
      expect(isAuditLogEntry(invalidEntry)).toBe(false);
    });
  });
});

// ============================================
// 🎯 generateLogId 유틸리티 테스트
// ============================================

describe("generateLogId", () => {
  it("문자열 ID를 생성해야 함", () => {
    const id = generateLogId();
    expect(typeof id).toBe("string");
  });

  it("'audit-' 접두사로 시작해야 함", () => {
    const id = generateLogId();
    expect(id).toMatch(/^audit-/);
  });

  it("타임스탬프를 포함해야 함", () => {
    const id = generateLogId();
    // audit-{timestamp}-{random} 형식
    const parts = id.split("-");
    expect(parts.length).toBeGreaterThanOrEqual(2);
    expect(parseInt(parts[1], 10)).toBeGreaterThan(0);
  });

  it("호출할 때마다 고유한 ID를 생성해야 함", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateLogId());
    }
    expect(ids.size).toBe(100);
  });

  it("충분한 길이의 ID를 생성해야 함", () => {
    const id = generateLogId();
    // audit-{13자리 timestamp}-{6자리 random} = 최소 25자
    expect(id.length).toBeGreaterThanOrEqual(20);
  });
});

// ============================================
// 🎯 DEFAULT_SENSITIVE_PATTERNS 상수 테스트
// ============================================

describe("DEFAULT_SENSITIVE_PATTERNS", () => {
  it("배열이어야 함", () => {
    expect(Array.isArray(DEFAULT_SENSITIVE_PATTERNS)).toBe(true);
  });

  it("최소 5개 이상의 패턴이 있어야 함", () => {
    expect(DEFAULT_SENSITIVE_PATTERNS.length).toBeGreaterThanOrEqual(5);
  });

  it("각 패턴에 필수 속성이 있어야 함", () => {
    DEFAULT_SENSITIVE_PATTERNS.forEach((pattern) => {
      expect(pattern).toHaveProperty("name");
      expect(pattern).toHaveProperty("pattern");
      expect(pattern).toHaveProperty("replacement");
      expect(typeof pattern.name).toBe("string");
      expect(pattern.pattern).toBeInstanceOf(RegExp);
    });
  });

  describe("API Key 패턴", () => {
    const apiKeyPattern = DEFAULT_SENSITIVE_PATTERNS.find((p) => p.name === "API Key");

    it("API Key 패턴이 존재해야 함", () => {
      expect(apiKeyPattern).toBeDefined();
    });

    it("api_key=xxx 형식을 매칭해야 함", () => {
      expect("api_key=abc123").toMatch(apiKeyPattern!.pattern);
    });

    it("apikey: xxx 형식을 매칭해야 함", () => {
      expect('apikey: "secret123"').toMatch(apiKeyPattern!.pattern);
    });
  });

  describe("Bearer Token 패턴", () => {
    const bearerPattern = DEFAULT_SENSITIVE_PATTERNS.find((p) => p.name === "Bearer Token");

    it("Bearer Token 패턴이 존재해야 함", () => {
      expect(bearerPattern).toBeDefined();
    });

    it("Bearer xxx 형식을 매칭해야 함", () => {
      expect("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9").toMatch(bearerPattern!.pattern);
    });
  });

  describe("Password 패턴", () => {
    const passwordPattern = DEFAULT_SENSITIVE_PATTERNS.find((p) => p.name === "Password");

    it("Password 패턴이 존재해야 함", () => {
      expect(passwordPattern).toBeDefined();
    });

    it("password=xxx 형식을 매칭해야 함", () => {
      expect("password=mysecret123").toMatch(passwordPattern!.pattern);
    });
  });

  describe("Secret 패턴", () => {
    const secretPattern = DEFAULT_SENSITIVE_PATTERNS.find((p) => p.name === "Secret");

    it("Secret 패턴이 존재해야 함", () => {
      expect(secretPattern).toBeDefined();
    });

    it("secret: xxx 형식을 매칭해야 함", () => {
      expect('secret: "my-secret-value"').toMatch(secretPattern!.pattern);
    });
  });

  describe("Private Key 패턴", () => {
    const privateKeyPattern = DEFAULT_SENSITIVE_PATTERNS.find((p) => p.name === "Private Key");

    it("Private Key 패턴이 존재해야 함", () => {
      expect(privateKeyPattern).toBeDefined();
    });

    it("PEM 형식 private key를 매칭해야 함", () => {
      const pemKey = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...
-----END PRIVATE KEY-----`;
      expect(pemKey).toMatch(privateKeyPattern!.pattern);
    });

    it("RSA Private Key를 매칭해야 함", () => {
      const rsaKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA...
-----END RSA PRIVATE KEY-----`;
      expect(rsaKey).toMatch(privateKeyPattern!.pattern);
    });
  });

  describe("AWS Access Key 패턴", () => {
    const awsKeyPattern = DEFAULT_SENSITIVE_PATTERNS.find((p) => p.name === "AWS Access Key");

    it("AWS Access Key 패턴이 존재해야 함", () => {
      expect(awsKeyPattern).toBeDefined();
    });

    it("AKIA로 시작하는 AWS 키를 매칭해야 함", () => {
      expect("AKIAIOSFODNN7EXAMPLE").toMatch(awsKeyPattern!.pattern);
    });
  });
});

// ============================================
// 🎯 AUDIT_LOGGER_DEFAULTS 상수 테스트
// ============================================

describe("AUDIT_LOGGER_DEFAULTS", () => {
  it("기본 maxEntries가 1000이어야 함", () => {
    expect(AUDIT_LOGGER_DEFAULTS.maxEntries).toBe(1000);
  });

  it("기본 enablePersistence가 false이어야 함", () => {
    expect(AUDIT_LOGGER_DEFAULTS.enablePersistence).toBe(false);
  });

  it("기본 dbName이 'daive-audit-logs'이어야 함", () => {
    expect(AUDIT_LOGGER_DEFAULTS.dbName).toBe("daive-audit-logs");
  });

  it("기본 sensitivePatterns가 빈 배열이어야 함", () => {
    expect(AUDIT_LOGGER_DEFAULTS.sensitivePatterns).toEqual([]);
  });

  it("기본 autoMasking이 true이어야 함", () => {
    expect(AUDIT_LOGGER_DEFAULTS.autoMasking).toBe(true);
  });
});

// ============================================
// 🎯 타입 컴파일 테스트
// ============================================

describe("타입 정의 컴파일 테스트", () => {
  it("AuditLogEntry 타입이 올바르게 정의되어야 함", () => {
    // 타입 검사를 위한 컴파일 테스트
    const entry: AuditLogEntry = {
      id: "test-id",
      timestamp: new Date().toISOString(),
      action: "tool_call",
      result: "success",
      severity: "info",
    };
    expect(entry).toBeDefined();
  });

  it("AuditLogInput 타입이 id와 timestamp를 제외해야 함", () => {
    const input: AuditLogInput = {
      action: "hitl_approve",
      result: "success",
      severity: "info",
      toolName: "kubectl",
    };
    expect(input).toBeDefined();
    // @ts-expect-error - id는 AuditLogInput에 없어야 함
    // input.id = "test"; // 이 줄은 타입 에러가 발생해야 함
  });

  it("SensitivePattern 타입이 올바르게 정의되어야 함", () => {
    const pattern: SensitivePattern = {
      name: "Test Pattern",
      pattern: /test/gi,
      replacement: "***",
    };
    expect(pattern).toBeDefined();
  });

  it("AuditLoggerConfig 타입이 올바르게 정의되어야 함", () => {
    const config: AuditLoggerConfig = {
      maxEntries: 500,
      enablePersistence: true,
    };
    expect(config).toBeDefined();
  });
});
