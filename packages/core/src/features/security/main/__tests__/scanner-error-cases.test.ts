/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * @jest-environment node
 *
 * 스캔 실패·타임아웃 에러 케이스 test
 *
 * TrivyScanner, KubescapeScanner의 run() 메서드에서
 * - BINARY_NOT_FOUND (spawn error)
 * - EXECUTION_ERROR (non-zero exit + no stdout)
 * - PARSE_ERROR (invalid JSON stdout)
 * - TIMEOUT (timeoutMs 초과)
 * - CANCELLED (AbortSignal)
 * - 정상 성공 케이스 (mock stdout)
 * 를 verify합니다.
 */

import { EventEmitter } from "events";
import { isScannerFailure, isScannerSuccess, ScannerErrorType } from "../../common/scanner-engine";
import { KubescapeScanner } from "../kubescape-scanner";
import { TrivyScanner } from "../trivy-scanner";

// ============================================
// child_process spawn 모킹
// ============================================

jest.mock("child_process", () => ({
  spawn: jest.fn(),
}));

import { spawn } from "child_process";

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

// spawn mock 프로세스 빌더
interface MockProcOptions {
  /** stdout으로 emit할 데이터 */
  stdoutData?: string;
  /** stderr으로 emit할 데이터 */
  stderrData?: string;
  /** close 이벤트에서 반환할 exit code */
  exitCode?: number | null;
  /** error 이벤트 발생 여부 + 에러 메시지 */
  spawnError?: string;
  /** close 이벤트까지 지연 (ms) */
  delayMs?: number;
}

function buildMockProc(opts: MockProcOptions): EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: jest.Mock;
} {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: jest.Mock;
  };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = jest.fn();

  Promise.resolve().then(() => {
    if (opts.spawnError) {
      proc.emit("error", new Error(opts.spawnError));
      return;
    }
    if (opts.stderrData) {
      proc.stderr.emit("data", Buffer.from(opts.stderrData));
    }
    const emitClose = () => {
      if (opts.stdoutData) {
        proc.stdout.emit("data", Buffer.from(opts.stdoutData));
      }
      proc.emit("close", opts.exitCode ?? 0);
    };
    if (opts.delayMs) {
      setTimeout(emitClose, opts.delayMs);
    } else {
      emitClose();
    }
  });

  return proc;
}

const BASE_OPTIONS = {
  clusterId: "test-cluster",
  kubeconfigPath: "/tmp/kubeconfig",
};

const VALID_TRIVY_JSON = JSON.stringify({
  SchemaVersion: 2,
  Results: [],
});

const VALID_KUBESCAPE_JSON = JSON.stringify({
  results: [],
  resources: [],
});

// ============================================
// TrivyScanner 에러 케이스
// ============================================

describe("TrivyScanner — 에러 케이스", () => {
  let scanner: TrivyScanner;

  beforeEach(() => {
    scanner = new TrivyScanner("/usr/local/bin/trivy");
    jest.clearAllMocks();
  });

  describe("BINARY_NOT_FOUND", () => {
    it("spawn error 발생 시 BINARY_NOT_FOUND 반환", async () => {
      mockSpawn.mockReturnValue(buildMockProc({ spawnError: "ENOENT: no such file" }) as any);
      const result = await scanner.run(BASE_OPTIONS);
      expect(isScannerFailure(result)).toBe(true);
      if (isScannerFailure(result)) {
        expect(result.error.type).toBe(ScannerErrorType.BINARY_NOT_FOUND);
        expect(result.error.message).toContain("ENOENT");
      }
    });
  });

  describe("EXECUTION_ERROR", () => {
    it("exit code != 0이고 stdout 없으면 EXECUTION_ERROR 반환", async () => {
      mockSpawn.mockReturnValue(
        buildMockProc({
          exitCode: 1,
          stderrData: "trivy: command not found",
        }) as any,
      );
      const result = await scanner.run(BASE_OPTIONS);
      expect(isScannerFailure(result)).toBe(true);
      if (isScannerFailure(result)) {
        expect(result.error.type).toBe(ScannerErrorType.EXECUTION_ERROR);
        expect(result.error.message).toContain("trivy: command not found");
      }
    });

    it("stderr 없고 exit code != 0이면 code를 포함한 메시지 반환", async () => {
      mockSpawn.mockReturnValue(buildMockProc({ exitCode: 2 }) as any);
      const result = await scanner.run(BASE_OPTIONS);
      expect(isScannerFailure(result)).toBe(true);
      if (isScannerFailure(result)) {
        expect(result.error.type).toBe(ScannerErrorType.EXECUTION_ERROR);
        expect(result.error.message).toContain("2");
      }
    });
  });

  describe("PARSE_ERROR", () => {
    it("stdout이 유효하지 않은 JSON이면 PARSE_ERROR 반환", async () => {
      mockSpawn.mockReturnValue(buildMockProc({ stdoutData: "not json {{" }) as any);
      const result = await scanner.run(BASE_OPTIONS);
      expect(isScannerFailure(result)).toBe(true);
      if (isScannerFailure(result)) {
        expect(result.error.type).toBe(ScannerErrorType.PARSE_ERROR);
        expect(result.error.message).toContain("parse");
      }
    });

    it("PARSE_ERROR에 cause가 포함된다", async () => {
      mockSpawn.mockReturnValue(buildMockProc({ stdoutData: "{invalid" }) as any);
      const result = await scanner.run(BASE_OPTIONS);
      if (isScannerFailure(result)) {
        expect(result.error.cause).toBeDefined();
      }
    });
  });

  describe("TIMEOUT", () => {
    it("timeoutMs 초과 시 TIMEOUT 반환", async () => {
      mockSpawn.mockReturnValue(buildMockProc({ delayMs: 500 }) as any);
      const result = await scanner.run({ ...BASE_OPTIONS, timeoutMs: 50 });
      expect(isScannerFailure(result)).toBe(true);
      if (isScannerFailure(result)) {
        expect(result.error.type).toBe(ScannerErrorType.TIMEOUT);
        expect(result.error.message).toContain("timed out");
      }
    });

    it("TIMEOUT 메시지에 timeoutMs 값이 포함된다", async () => {
      mockSpawn.mockReturnValue(buildMockProc({ delayMs: 500 }) as any);
      const result = await scanner.run({ ...BASE_OPTIONS, timeoutMs: 100 });
      if (isScannerFailure(result)) {
        expect(result.error.message).toContain("100");
      }
    });
  });

  describe("CANCELLED", () => {
    it("AbortSignal 취소 시 CANCELLED 반환", async () => {
      mockSpawn.mockReturnValue(buildMockProc({ delayMs: 500 }) as any);
      const controller = new AbortController();
      const resultPromise = scanner.run({ ...BASE_OPTIONS, signal: controller.signal });
      setTimeout(() => controller.abort(), 20);
      const result = await resultPromise;
      expect(isScannerFailure(result)).toBe(true);
      if (isScannerFailure(result)) {
        expect(result.error.type).toBe(ScannerErrorType.CANCELLED);
        expect(result.error.message).toContain("cancelled");
      }
    });
  });

  describe("정상 성공", () => {
    it("유효한 JSON stdout → success: true 반환", async () => {
      mockSpawn.mockReturnValue(buildMockProc({ stdoutData: VALID_TRIVY_JSON }) as any);
      const result = await scanner.run(BASE_OPTIONS);
      expect(isScannerSuccess(result)).toBe(true);
      if (isScannerSuccess(result)) {
        expect(result.result.clusterId).toBe("test-cluster");
        expect(Array.isArray(result.result.findings)).toBe(true);
      }
    });

    it("onProgress 콜백이 호출된다", async () => {
      mockSpawn.mockReturnValue(buildMockProc({ stdoutData: VALID_TRIVY_JSON }) as any);
      const onProgress = jest.fn();
      await scanner.run({ ...BASE_OPTIONS, onProgress });
      expect(onProgress).toHaveBeenCalled();
      const percents = onProgress.mock.calls.map((c: any) => c[0].percent);
      expect(percents).toContain(100);
    });
  });
});

// ============================================
// KubescapeScanner 에러 케이스
// ============================================

describe("KubescapeScanner — 에러 케이스", () => {
  let scanner: KubescapeScanner;

  beforeEach(() => {
    scanner = new KubescapeScanner("/usr/local/bin/kubescape");
    jest.clearAllMocks();
  });

  describe("BINARY_NOT_FOUND", () => {
    it("spawn error 발생 시 BINARY_NOT_FOUND 반환", async () => {
      mockSpawn.mockReturnValue(buildMockProc({ spawnError: "ENOENT" }) as any);
      const result = await scanner.run(BASE_OPTIONS);
      expect(isScannerFailure(result)).toBe(true);
      if (isScannerFailure(result)) {
        expect(result.error.type).toBe(ScannerErrorType.BINARY_NOT_FOUND);
      }
    });
  });

  describe("EXECUTION_ERROR", () => {
    it("stdout 없고 exit code != 0이면 EXECUTION_ERROR 반환", async () => {
      mockSpawn.mockReturnValue(
        buildMockProc({
          exitCode: 1,
          stderrData: "kubescape: connection refused",
        }) as any,
      );
      const result = await scanner.run(BASE_OPTIONS);
      expect(isScannerFailure(result)).toBe(true);
      if (isScannerFailure(result)) {
        expect(result.error.type).toBe(ScannerErrorType.EXECUTION_ERROR);
        expect(result.error.message).toContain("connection refused");
      }
    });

    it("Kubescape는 취약점 발견 시 exit != 0이어도 stdout 있으면 파싱 시도", async () => {
      // Kubescape는 findings 있으면 exit code != 0
      mockSpawn.mockReturnValue(
        buildMockProc({
          stdoutData: VALID_KUBESCAPE_JSON,
          exitCode: 1,
        }) as any,
      );
      const result = await scanner.run(BASE_OPTIONS);
      // stdout 있으면 파싱 시도 → 성공
      expect(isScannerSuccess(result)).toBe(true);
    });
  });

  describe("PARSE_ERROR", () => {
    it("stdout이 유효하지 않은 JSON이면 PARSE_ERROR 반환", async () => {
      mockSpawn.mockReturnValue(buildMockProc({ stdoutData: "invalid json" }) as any);
      const result = await scanner.run(BASE_OPTIONS);
      expect(isScannerFailure(result)).toBe(true);
      if (isScannerFailure(result)) {
        expect(result.error.type).toBe(ScannerErrorType.PARSE_ERROR);
      }
    });
  });

  describe("TIMEOUT", () => {
    it("timeoutMs 초과 시 TIMEOUT 반환", async () => {
      mockSpawn.mockReturnValue(buildMockProc({ delayMs: 500 }) as any);
      const result = await scanner.run({ ...BASE_OPTIONS, timeoutMs: 50 });
      expect(isScannerFailure(result)).toBe(true);
      if (isScannerFailure(result)) {
        expect(result.error.type).toBe(ScannerErrorType.TIMEOUT);
      }
    });
  });

  describe("CANCELLED", () => {
    it("AbortSignal 취소 시 CANCELLED 반환", async () => {
      mockSpawn.mockReturnValue(buildMockProc({ delayMs: 500 }) as any);
      const controller = new AbortController();
      const resultPromise = scanner.run({ ...BASE_OPTIONS, signal: controller.signal });
      setTimeout(() => controller.abort(), 20);
      const result = await resultPromise;
      expect(isScannerFailure(result)).toBe(true);
      if (isScannerFailure(result)) {
        expect(result.error.type).toBe(ScannerErrorType.CANCELLED);
      }
    });
  });

  describe("정상 성공", () => {
    it("유효한 JSON stdout → success: true 반환", async () => {
      mockSpawn.mockReturnValue(buildMockProc({ stdoutData: VALID_KUBESCAPE_JSON }) as any);
      const result = await scanner.run(BASE_OPTIONS);
      expect(isScannerSuccess(result)).toBe(true);
      if (isScannerSuccess(result)) {
        expect(result.result.clusterId).toBe("test-cluster");
      }
    });

    it("onProgress 콜백이 호출된다", async () => {
      mockSpawn.mockReturnValue(buildMockProc({ stdoutData: VALID_KUBESCAPE_JSON }) as any);
      const onProgress = jest.fn();
      await scanner.run({ ...BASE_OPTIONS, onProgress });
      expect(onProgress).toHaveBeenCalled();
    });
  });
});

// ============================================
// isScannerSuccess / isScannerFailure 타입 가드
// ============================================

describe("isScannerSuccess / isScannerFailure 타입 가드", () => {
  it("success: true → isScannerSuccess 반환 true", () => {
    const result = {
      success: true as const,
      result: { clusterId: "c", findings: [], scannedAt: "", scannerVersion: undefined },
    };
    expect(isScannerSuccess(result)).toBe(true);
    expect(isScannerFailure(result)).toBe(false);
  });

  it("success: false → isScannerFailure 반환 true", () => {
    const result = {
      success: false as const,
      error: { type: ScannerErrorType.UNKNOWN, message: "error" },
    };
    expect(isScannerFailure(result)).toBe(true);
    expect(isScannerSuccess(result)).toBe(false);
  });
});
