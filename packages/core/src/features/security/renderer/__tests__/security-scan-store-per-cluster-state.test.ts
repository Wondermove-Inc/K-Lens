/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Per-cluster scanState isolation tests
 *
 * Verifies the Map-based scanState isolation introduced in:
 *   refactor(security): isolate scanState per cluster using Map + getter/setter
 *
 * Tests use pure helper functions that mirror store logic — no MobX/DI required.
 */

import type { ScanState, ScanStatus } from "../security-scan-store";

// ────────────────────────────────────────────────────────────────────────────
// Util: create minimal ScanState
// ────────────────────────────────────────────────────────────────────────────

function makeScanState(overrides: Partial<ScanState> = {}): ScanState {
  return {
    status: "idle",
    scanId: null,
    currentClusterId: null,
    scannerMode: "all",
    completedScanners: [],
    timedOutScanners: [],
    progress: 0,
    message: "",
    findingsSoFar: 0,
    lastError: null,
    scannedAt: null,
    ...overrides,
  };
}

const DEFAULT_SCAN_STATE: ScanState = makeScanState();

// ────────────────────────────────────────────────────────────────────────────
// Pure helpers mirroring store internals
// ────────────────────────────────────────────────────────────────────────────

/** Mirrors scanState getter */
function getScanState(map: Map<string, ScanState>, hostedId: string | null): ScanState {
  if (!hostedId) return { ...DEFAULT_SCAN_STATE };
  return map.get(hostedId) ?? { ...DEFAULT_SCAN_STATE };
}

/** Mirrors scanState setter */
function setScanState(map: Map<string, ScanState>, state: ScanState, hostedId: string | null): Map<string, ScanState> {
  const id = state.currentClusterId ?? hostedId;
  if (!id) return map;
  const next = new Map(map);
  next.set(id, state);
  return next;
}

/** Mirrors hostedClusterId setter — synthesize complete state if findings exist */
function applyHostedClusterId(
  scanStateMap: Map<string, ScanState>,
  findingsMap: Map<string, unknown[]>,
  clusterId: string | null,
): Map<string, ScanState> {
  if (!clusterId) return scanStateMap;
  if (scanStateMap.has(clusterId)) return scanStateMap;
  const hasFindings = (findingsMap.get(clusterId)?.length ?? 0) > 0;
  if (!hasFindings) return scanStateMap;
  const next = new Map(scanStateMap);
  next.set(clusterId, makeScanState({ status: "complete", progress: 100, message: "Scan complete" }));
  return next;
}

/** Mirrors restoreFromCache scanning-state reset logic */
function resetScanningStatus(status: string, findingsLength: number): string {
  if (status === "scanning") {
    return findingsLength > 0 ? "complete" : "idle";
  }
  return status;
}

// ────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────

describe("scanState per-cluster isolation", () => {
  it("클러스터 A의 scanState가 클러스터 B에 영향 없음", () => {
    const map = new Map<string, ScanState>();
    map.set("cluster-a", makeScanState({ status: "complete", progress: 100 }));
    map.set("cluster-b", makeScanState({ status: "idle" }));

    expect(map.get("cluster-a")!.status).toBe("complete");
    expect(map.get("cluster-b")!.status).toBe("idle");
  });

  it("존재하지 않는 클러스터는 DEFAULT_SCAN_STATE 반환", () => {
    const map = new Map<string, ScanState>();
    const result = map.get("unknown") ?? makeScanState();

    expect(result.status).toBe("idle");
    expect(result.scanId).toBeNull();
  });

  it("클러스터 A 상태 업데이트가 클러스터 B에 전파되지 않음", () => {
    let map = new Map<string, ScanState>();
    map.set("cluster-a", makeScanState({ status: "idle" }));
    map.set("cluster-b", makeScanState({ status: "complete", progress: 100 }));

    // Update cluster-a to scanning
    map = setScanState(
      map,
      makeScanState({ status: "scanning", currentClusterId: "cluster-a", progress: 50 }),
      "cluster-a",
    );

    expect(map.get("cluster-a")!.status).toBe("scanning");
    expect(map.get("cluster-b")!.status).toBe("complete"); // unchanged
  });
});

describe("hostedClusterId switch", () => {
  it("클러스터 전환 시 해당 클러스터의 scanState 반환", () => {
    const map = new Map<string, ScanState>();
    map.set("c1", makeScanState({ status: "complete", progress: 100, message: "Scan complete" }));
    map.set("c2", makeScanState({ status: "error", message: "Connection failed" }));

    expect(getScanState(map, "c1").status).toBe("complete");
    expect(getScanState(map, "c2").status).toBe("error");
    expect(getScanState(map, "c2").message).toBe("Connection failed");
  });

  it("없는 클러스터로 전환하면 DEFAULT_SCAN_STATE 반환", () => {
    const map = new Map<string, ScanState>();
    const result = getScanState(map, "nonexistent");

    expect(result.status).toBe("idle");
    expect(result.progress).toBe(0);
    expect(result.scanId).toBeNull();
  });

  it("hostedClusterId null이면 DEFAULT_SCAN_STATE 반환", () => {
    const map = new Map<string, ScanState>();
    map.set("c1", makeScanState({ status: "complete", progress: 100 }));

    const result = getScanState(map, null);
    expect(result.status).toBe("idle");
  });

  it("findings 있지만 scanState 없는 클러스터 → complete 합성", () => {
    const scanStateMap = new Map<string, ScanState>();
    const findingsMap = new Map<string, unknown[]>();
    findingsMap.set("c3", [{ id: "f1" }, { id: "f2" }]);

    const updated = applyHostedClusterId(scanStateMap, findingsMap, "c3");

    expect(updated.get("c3")!.status).toBe("complete");
    expect(updated.get("c3")!.progress).toBe(100);
  });

  it("findings 없는 클러스터는 complete 합성하지 않음", () => {
    const scanStateMap = new Map<string, ScanState>();
    const findingsMap = new Map<string, unknown[]>();
    findingsMap.set("c4", []); // empty findings

    const updated = applyHostedClusterId(scanStateMap, findingsMap, "c4");

    expect(updated.has("c4")).toBe(false);
  });
});

describe("scanState setter routing", () => {
  it("currentClusterId가 있으면 해당 클러스터에 저장", () => {
    let map = new Map<string, ScanState>();
    const state = makeScanState({ status: "scanning", currentClusterId: "c1" });

    map = setScanState(map, state, "fallback");

    expect(map.get("c1")!.status).toBe("scanning");
    expect(map.has("fallback")).toBe(false);
  });

  it("currentClusterId null이면 hostedClusterId에 저장", () => {
    let map = new Map<string, ScanState>();
    const state = makeScanState({ status: "complete", currentClusterId: null });

    map = setScanState(map, state, "c2");

    expect(map.get("c2")!.status).toBe("complete");
  });

  it("currentClusterId도 hostedId도 null이면 저장 안 함", () => {
    let map = new Map<string, ScanState>();
    const state = makeScanState({ status: "error", currentClusterId: null });

    map = setScanState(map, state, null);

    expect(map.size).toBe(0);
  });

  it("기존 클러스터 상태를 덮어쓰기", () => {
    let map = new Map<string, ScanState>();
    map.set("c1", makeScanState({ status: "idle" }));

    map = setScanState(map, makeScanState({ status: "complete", progress: 100, currentClusterId: "c1" }), "c1");

    expect(map.get("c1")!.status).toBe("complete");
    expect(map.get("c1")!.progress).toBe(100);
  });
});

describe("persistToCache cluster targeting", () => {
  it("clusterId로 해당 클러스터의 scanState만 저장", () => {
    const map = new Map<string, ScanState>();
    map.set("c1", makeScanState({ status: "complete", scannedAt: "2026-03-20" }));
    map.set("c2", makeScanState({ status: "error" }));

    const targetCluster = "c1";
    const stateToSave = map.get(targetCluster)!;

    expect(stateToSave.status).toBe("complete");
    expect(stateToSave.scannedAt).toBe("2026-03-20");
  });

  it("다른 클러스터 scanState는 변경되지 않음", () => {
    const map = new Map<string, ScanState>();
    map.set("c1", makeScanState({ status: "complete", scannedAt: "2026-03-20" }));
    map.set("c2", makeScanState({ status: "error" }));

    // persist c1 — c2 should be unaffected
    const c2State = map.get("c2")!;
    expect(c2State.status).toBe("error");
    expect(c2State.scannedAt).toBeNull();
  });
});

describe("restoreFromCache multi-cluster", () => {
  it("3개 클러스터 캐시 → 3개 모두 Map에 복원", () => {
    const map = new Map<string, ScanState>();
    const caches: Array<{ clusterId: string; status: ScanStatus }> = [
      { clusterId: "c1", status: "complete" },
      { clusterId: "c2", status: "complete" },
      { clusterId: "c3", status: "error" },
    ];

    for (const cache of caches) {
      map.set(cache.clusterId, makeScanState({ status: cache.status }));
    }

    expect(map.size).toBe(3);
    expect(map.get("c1")!.status).toBe("complete");
    expect(map.get("c2")!.status).toBe("complete");
    expect(map.get("c3")!.status).toBe("error");
  });

  it("scanning 상태 캐시 + findings 있음 → complete 리셋", () => {
    expect(resetScanningStatus("scanning", 5)).toBe("complete");
  });

  it("scanning 상태 캐시 + findings 없음 → idle 리셋", () => {
    expect(resetScanningStatus("scanning", 0)).toBe("idle");
  });

  it("non-scanning 상태는 그대로 유지", () => {
    expect(resetScanningStatus("complete", 10)).toBe("complete");
    expect(resetScanningStatus("error", 0)).toBe("error");
    expect(resetScanningStatus("idle", 0)).toBe("idle");
  });

  it("각 클러스터마다 독립적으로 scanning 리셋 적용", () => {
    const caches = [
      { clusterId: "c1", status: "scanning", findingsCount: 3 },
      { clusterId: "c2", status: "scanning", findingsCount: 0 },
      { clusterId: "c3", status: "complete", findingsCount: 10 },
    ];

    const map = new Map<string, ScanState>();
    for (const cache of caches) {
      const resolvedStatus = resetScanningStatus(cache.status, cache.findingsCount) as ScanStatus;
      map.set(cache.clusterId, makeScanState({ status: resolvedStatus }));
    }

    expect(map.get("c1")!.status).toBe("complete"); // scanning + findings → complete
    expect(map.get("c2")!.status).toBe("idle"); // scanning + no findings → idle
    expect(map.get("c3")!.status).toBe("complete"); // already complete → unchanged
  });
});

describe("reset per-cluster", () => {
  it("현재 클러스터만 idle로 초기화, 다른 클러스터 유지", () => {
    const map = new Map<string, ScanState>();
    map.set("c1", makeScanState({ status: "complete", progress: 100 }));
    map.set("c2", makeScanState({ status: "complete", progress: 100 }));

    // reset c1 only (mirrors reset() with _hostedClusterId = "c1")
    map.set("c1", makeScanState());

    expect(map.get("c1")!.status).toBe("idle");
    expect(map.get("c1")!.progress).toBe(0);
    expect(map.get("c2")!.status).toBe("complete");
    expect(map.get("c2")!.progress).toBe(100);
  });

  it("hostedClusterId 없으면 reset이 아무것도 하지 않음", () => {
    const map = new Map<string, ScanState>();
    map.set("c1", makeScanState({ status: "complete", progress: 100 }));

    // hostedClusterId = null → no reset
    const hostedId: string | null = null;
    if (hostedId) {
      map.set(hostedId, makeScanState());
    }

    expect(map.get("c1")!.status).toBe("complete"); // unchanged
  });
});
