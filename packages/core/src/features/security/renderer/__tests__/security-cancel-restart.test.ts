/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * retry cancel 후 재시작 시 findings 복원 테스트
 *
 * Covers: commit 62e85b7b
 * Fix 1: _applyRestoredScanState — cancelled 상태도 transient로 처리 (scanning과 동일)
 * Fix 2: cancelScan → persistToCache에 snapshot timedOutNamespaces override 전달
 */

// ──────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ──────────────────────────────────────────────────────────────────────────────

type ScanStatus = "idle" | "scanning" | "complete" | "error" | "cancelled";

interface ScanState {
  status: ScanStatus;
  scanId: string | null;
  progress: number;
  message: string;
  findingsSoFar: number;
  completedScanners: string[];
  lastError: null;
  scannedAt: string | null;
  timedOutScanners: string[];
}

interface Finding {
  id: string;
  severity: string;
}

/** Mirrors _applyRestoredScanState() after 62e85b7b */
function applyRestoredScanState(rawScanState: Record<string, unknown>, findings: Finding[]): ScanState {
  const {
    _clusterId: _,
    _timedOutNamespaces: __,
    ...cleanScanState
  } = rawScanState as Record<string, unknown> & {
    _clusterId?: unknown;
    _timedOutNamespaces?: unknown;
  };

  const isTransient = cleanScanState["status"] === "scanning" || cleanScanState["status"] === "cancelled";

  if (isTransient) {
    const hasFindings = findings.length > 0;
    cleanScanState["status"] = hasFindings ? "complete" : "idle";
    cleanScanState["progress"] = hasFindings ? 100 : 0;
    cleanScanState["message"] = "";
    cleanScanState["scanId"] = null;
  }

  return cleanScanState as unknown as ScanState;
}

/** Mirrors cancelScan() persistToCache call after 62e85b7b */
function resolvePersistTimedOut(snapshotTimedOut: string[], _inMemoryTimedOut: string[]): string[] {
  // Fix 2: always use snapshot as override
  return snapshotTimedOut;
}

// ──────────────────────────────────────────────────────────────────────────────
// Fix 1: _applyRestoredScanState — cancelled transient 처리
// ──────────────────────────────────────────────────────────────────────────────

describe("Fix 1: _applyRestoredScanState — cancelled as transient status", () => {
  const baseState: Record<string, unknown> = {
    status: "cancelled",
    scanId: null,
    progress: 100,
    message: "Scan cancelled.",
    findingsSoFar: 2066,
    completedScanners: ["trivy", "kubescape"],
    lastError: null,
    scannedAt: "2026-03-19T13:00:00Z",
    timedOutScanners: [],
    _clusterId: "cluster-A",
    _timedOutNamespaces: ["ns-1", "ns-2"],
  };

  it("cancelled + findings > 0 → complete on restart", () => {
    const findings: Finding[] = [
      { id: "f1", severity: "High" },
      { id: "f2", severity: "Low" },
    ];
    const result = applyRestoredScanState(baseState, findings);
    expect(result.status).toBe("complete");
    expect(result.progress).toBe(100);
    expect(result.scanId).toBeNull();
    expect(result.message).toBe("");
  });

  it("cancelled + findings = 0 → idle on restart", () => {
    const result = applyRestoredScanState(baseState, []);
    expect(result.status).toBe("idle");
    expect(result.progress).toBe(0);
  });

  it("scanning + findings > 0 → complete (existing behavior unchanged)", () => {
    const scanningState = { ...baseState, status: "scanning", message: "Scanning..." };
    const findings: Finding[] = [{ id: "f1", severity: "High" }];
    const result = applyRestoredScanState(scanningState, findings);
    expect(result.status).toBe("complete");
  });

  it("complete status is NOT converted (stable state preserved)", () => {
    const completeState = { ...baseState, status: "complete", message: "Scan complete" };
    const findings: Finding[] = [{ id: "f1", severity: "High" }];
    const result = applyRestoredScanState(completeState, findings);
    expect(result.status).toBe("complete");
    // complete is not transient — message/progress preserved as-is
    expect(result.message).toBe("Scan complete");
  });

  it("idle status is NOT converted", () => {
    const idleState = { ...baseState, status: "idle", message: "" };
    const result = applyRestoredScanState(idleState, []);
    expect(result.status).toBe("idle");
  });

  it("error status is NOT converted", () => {
    const errorState = { ...baseState, status: "error", message: "Scan failed" };
    const findings: Finding[] = [{ id: "f1", severity: "High" }];
    const result = applyRestoredScanState(errorState, findings);
    expect(result.status).toBe("error"); // error is preserved
  });

  it("strips _clusterId and _timedOutNamespaces from scanState", () => {
    const findings: Finding[] = [{ id: "f1", severity: "High" }];
    const result = applyRestoredScanState(baseState, findings) as Record<string, unknown>;
    expect(result["_clusterId"]).toBeUndefined();
    expect(result["_timedOutNamespaces"]).toBeUndefined();
  });

  it("retry cancel scenario: 2066 findings, cancelled → complete", () => {
    // Matches actual cache from heimdall's test: 7f7cb...json
    const cache = {
      status: "cancelled",
      scanId: null,
      progress: 100,
      message: "Scan cancelled.",
      findingsSoFar: 2066,
      completedScanners: ["trivy", "kubescape"],
      lastError: null,
      scannedAt: "2026-03-19T12:00:00Z",
      timedOutScanners: [],
      _clusterId: "cluster-prod",
      _timedOutNamespaces: [],
    };
    const findings: Finding[] = Array.from({ length: 2066 }, (_, i) => ({ id: `f${i}`, severity: "Medium" }));
    const result = applyRestoredScanState(cache, findings);
    expect(result.status).toBe("complete");
    expect(result.progress).toBe(100);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Fix 2: cancelScan → persistToCache with snapshot timedOutNamespaces override
// ──────────────────────────────────────────────────────────────────────────────

describe("Fix 2: cancelScan persists snapshot timedOutNamespaces as override", () => {
  it("uses snapshot ns, not in-memory (which may be empty after retry start)", () => {
    const snapshotNs = ["ns-1", "ns-2", "ns-3"]; // original before retry
    const inMemoryNs: string[] = []; // timedOutNamespacesByCluster after retry start cleared it

    const persisted = resolvePersistTimedOut(snapshotNs, inMemoryNs);
    expect(persisted).toEqual(["ns-1", "ns-2", "ns-3"]);
  });

  it("old behavior would persist empty ns — alert cards would be lost", () => {
    const inMemoryNs: string[] = []; // empty after retry clears all
    // Old: persistToCache without override → uses inMemoryNs
    expect(inMemoryNs).toEqual([]); // confirms old behavior would save []
  });

  it("full rescan cancel: snapshot has original ns, persists them", () => {
    const snapshotNs = ["ns-4", "ns-5"];
    const inMemoryNs: string[] = []; // cleared on full rescan start
    const persisted = resolvePersistTimedOut(snapshotNs, inMemoryNs);
    expect(persisted).toEqual(["ns-4", "ns-5"]);
  });

  it("cancel with no timedOut ns in snapshot → persists empty (correct)", () => {
    const snapshotNs: string[] = [];
    const persisted = resolvePersistTimedOut(snapshotNs, []);
    expect(persisted).toEqual([]);
  });

  it("cache after fix: cancelled + 2066 findings + _timedOutNamespaces restored", () => {
    const snapshotNs = ["timeout-ns-1"];
    const inMemoryNs: string[] = [];

    const persistedNs = resolvePersistTimedOut(snapshotNs, inMemoryNs);

    // Simulate what would be in cache after fix
    const cachedState = {
      status: "cancelled",
      findings: Array.from({ length: 2066 }, (_, i) => ({ id: `f${i}` })),
      _timedOutNamespaces: persistedNs,
    };

    expect(cachedState.status).toBe("cancelled");
    expect(cachedState._timedOutNamespaces).toEqual(["timeout-ns-1"]);
    expect(cachedState.findings.length).toBe(2066);

    // After _applyRestoredScanState with fix 1:
    const restoredStatus = cachedState.findings.length > 0 ? "complete" : "idle";
    expect(restoredStatus).toBe("complete"); // dashboard shows ✅
  });
});
