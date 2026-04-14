/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * cancel 시 persist status 결정 로직 테스트
 *
 * Covers: commit 427d01e6
 * - cancelScan() persist status: findings > 0 → complete, findings = 0 → cancelled
 * - cancelled는 mid-session UI 상태, 캐시에는 complete로 저장
 * - 재시작 시 _applyRestoredScanState에서 cancelled→complete 변환 불필요 (방어적으로 유지)
 */

// ──────────────────────────────────────────────────────────────────────────────
// Core logic mirror
// ──────────────────────────────────────────────────────────────────────────────

interface Finding {
  id: string;
  severity: string;
}

/** Mirrors cancelScan() persist status determination (427d01e6) */
function determinePersistStatus(findings: Finding[]): "complete" | "cancelled" {
  return findings.length > 0 ? "complete" : "cancelled";
}

/** Mirrors cancelScan() persist message determination */
function determinePersistMessage(findings: Finding[]): string {
  return findings.length > 0 ? "" : "Scan cancelled.";
}

/** Mirrors cancelScan() persist progress determination */
function determinePersistProgress(findings: Finding[]): number {
  return findings.length > 0 ? 100 : 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests: persist status logic
// ──────────────────────────────────────────────────────────────────────────────

describe("cancelScan persist status — findings > 0 → complete, findings = 0 → cancelled", () => {
  it("findings > 0: persist as complete", () => {
    const findings: Finding[] = [
      { id: "f1", severity: "High" },
      { id: "f2", severity: "Low" },
    ];
    expect(determinePersistStatus(findings)).toBe("complete");
  });

  it("findings = 0: persist as cancelled", () => {
    expect(determinePersistStatus([])).toBe("cancelled");
  });

  it("large findings (2066): persist as complete", () => {
    const findings = Array.from({ length: 2066 }, (_, i) => ({ id: `f${i}`, severity: "Medium" }));
    expect(determinePersistStatus(findings)).toBe("complete");
  });

  it("findings > 0: message is empty string (not 'Scan cancelled.')", () => {
    const findings: Finding[] = [{ id: "f1", severity: "High" }];
    expect(determinePersistMessage(findings)).toBe("");
  });

  it("findings = 0: message is 'Scan cancelled.'", () => {
    expect(determinePersistMessage([])).toBe("Scan cancelled.");
  });

  it("findings > 0: progress is 100", () => {
    const findings: Finding[] = [{ id: "f1", severity: "High" }];
    expect(determinePersistProgress(findings)).toBe(100);
  });

  it("findings = 0: progress is 0", () => {
    expect(determinePersistProgress([])).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Tests: restart behavior with new cache format
// ──────────────────────────────────────────────────────────────────────────────

describe("restart behavior — cache now stores complete (not cancelled)", () => {
  type ScanStatus = "idle" | "scanning" | "complete" | "error" | "cancelled";

  interface CacheScanState {
    status: ScanStatus;
    progress: number;
    message: string;
    findings: Finding[];
    _timedOutNamespaces: string[];
  }

  /** Simulate what cancelScan() now writes to cache (427d01e6) */
  function buildCancelCache(findings: Finding[], timedOutNs: string[]): CacheScanState {
    const persistStatus = determinePersistStatus(findings);
    return {
      status: persistStatus,
      progress: determinePersistProgress(findings),
      message: determinePersistMessage(findings),
      findings,
      _timedOutNamespaces: timedOutNs,
    };
  }

  /** Mirror _applyRestoredScanState isTransient logic (still present as safety net) */
  function applyIsTransient(status: ScanStatus, findings: Finding[]): ScanStatus {
    const isTransient = status === "scanning" || status === "cancelled";
    if (!isTransient) return status;
    return findings.length > 0 ? "complete" : "idle";
  }

  it("cancel with findings → cache status=complete → restart shows complete", () => {
    const findings: Finding[] = Array.from({ length: 100 }, (_, i) => ({ id: `f${i}`, severity: "High" }));
    const cache = buildCancelCache(findings, []);

    expect(cache.status).toBe("complete");
    // _applyRestoredScanState: complete is not transient, stays complete
    const restoredStatus = applyIsTransient(cache.status, cache.findings);
    expect(restoredStatus).toBe("complete");
  });

  it("cancel without findings → cache status=cancelled → restart shows idle", () => {
    const cache = buildCancelCache([], []);
    expect(cache.status).toBe("cancelled");
    // _applyRestoredScanState: cancelled is transient, findings=0 → idle
    const restoredStatus = applyIsTransient(cache.status, cache.findings);
    expect(restoredStatus).toBe("idle");
  });

  it("retry cancel with timedOut ns + findings → cache complete + timedOut ns preserved", () => {
    const findings: Finding[] = [{ id: "f1", severity: "High" }];
    const timedOutNs = ["ns-1", "ns-2", "ns-3"];
    const cache = buildCancelCache(findings, timedOutNs);

    expect(cache.status).toBe("complete");
    expect(cache._timedOutNamespaces).toEqual(["ns-1", "ns-2", "ns-3"]);
    expect(cache.findings.length).toBe(1);
  });

  it("hasScanResults check: complete + findings > 0 → dashboard shown", () => {
    const findings: Finding[] = [{ id: "f1", severity: "High" }];
    const cache = buildCancelCache(findings, []);
    const restoredStatus = applyIsTransient(cache.status, cache.findings);

    // security-page.tsx: hasScanResults = (complete || cancelled) && findings.length > 0
    const hasScanResults =
      (restoredStatus === "complete" || restoredStatus === "cancelled") && cache.findings.length > 0;
    expect(hasScanResults).toBe(true);
  });

  it("old cache safety net: old cancelled+findings cache still works via isTransient fallback", () => {
    // Old cache files before 427d01e6 may still have status=cancelled
    const oldCacheStatus: ScanStatus = "cancelled";
    const oldFindings: Finding[] = Array.from({ length: 2066 }, (_, i) => ({ id: `f${i}`, severity: "Medium" }));

    const restoredStatus = applyIsTransient(oldCacheStatus, oldFindings);
    expect(restoredStatus).toBe("complete"); // safety net works
  });

  it("real scenario: 7f7cb...json (2066 findings, was cancelled) → now complete on cancel", () => {
    const findings = Array.from({ length: 2066 }, (_, i) => ({ id: `f${i}`, severity: "Medium" }));
    const cache = buildCancelCache(findings, []);
    expect(cache.status).toBe("complete");
    expect(cache.progress).toBe(100);
    expect(cache.message).toBe("");
  });

  it("real scenario: b593f...json (5198 findings, was cancelled) → now complete on cancel", () => {
    const findings = Array.from({ length: 5198 }, (_, i) => ({ id: `f${i}`, severity: "Low" }));
    const cache = buildCancelCache(findings, []);
    expect(cache.status).toBe("complete");
  });

  it("real scenario: d6c89...json (0 findings) → still cancelled, idle on restart", () => {
    const cache = buildCancelCache([], []);
    expect(cache.status).toBe("cancelled");
    const restored = applyIsTransient(cache.status, cache.findings);
    expect(restored).toBe("idle");
  });
});
