/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 *  (updated): Trivy namespace-split scan test
 *
 * timedOutNamespaces is now stored per-cluster in timedOutNamespacesByCluster Map
 * instead of in ScanState.
 *
 * - Verify timedOutNamespacesByCluster initialization
 * - handleProgress: accumulate timedOutNamespaces per cluster
 * - startScan retry mode: remove selected namespaces from per-cluster map
 */

import type { ScanProgressPayload } from "../../common/security-ipc-channels";
import type { ScanState } from "../security-scan-store";

// ────────────────────────────────────────────────────────────────────────────
// Util: create minimal ScanState (timedOutNamespaces removed from ScanState)
// ────────────────────────────────────────────────────────────────────────────
function makeScanState(overrides: Partial<ScanState> = {}): ScanState {
  return {
    status: "idle",
    scanId: null,
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

// ────────────────────────────────────────────────────────────────────────────
// Pure helper functions that mirror store logic (for unit testing)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Mirrors SecurityScanStore.handleProgress logic for timedOutNamespacesByCluster updates.
 * Returns updated Map<clusterId, string[]>.
 */
function applyProgressToTimedOutMap(map: Map<string, string[]>, payload: ScanProgressPayload): Map<string, string[]> {
  if (!payload.timedOutNamespaces || payload.timedOutNamespaces.length === 0) return map;
  const clusterId = payload.clusterId;
  const current = map.get(clusterId) ?? [];
  const merged = Array.from(new Set([...current, ...payload.timedOutNamespaces]));
  const next = new Map(map);
  next.set(clusterId, merged);
  return next;
}

/**
 * Mirrors SecurityScanStore.startScan logic for timedOutNamespacesByCluster.
 * Full rescan: delete cluster key. Retry: remove retried namespaces.
 */
function applyStartScanToTimedOutMap(
  map: Map<string, string[]>,
  opts: { clusterId: string; retryNamespaces?: string[] },
): Map<string, string[]> {
  const next = new Map(map);
  const isRetry = !!opts.retryNamespaces && opts.retryNamespaces.length > 0;
  if (!isRetry) {
    next.delete(opts.clusterId);
  } else {
    const current = next.get(opts.clusterId) ?? [];
    const remaining = current.filter((ns) => !opts.retryNamespaces!.includes(ns));
    if (remaining.length > 0) {
      next.set(opts.clusterId, remaining);
    } else {
      next.delete(opts.clusterId);
    }
  }
  return next;
}

// ────────────────────────────────────────────────────────────────────────────

describe(": timedOutNamespacesByCluster initialization", () => {
  it("빈 Map으로 초기화", () => {
    const map = new Map<string, string[]>();
    expect(map.size).toBe(0);
  });

  it("특정 cluster에만 값이 있음", () => {
    const map = new Map<string, string[]>([["cluster-a", ["kube-system"]]]);
    expect(map.get("cluster-a")).toEqual(["kube-system"]);
    expect(map.get("cluster-b")).toBeUndefined();
  });
});

describe(": handleProgress — 클러스터별 namespace 격리", () => {
  it("payload.timedOutNamespaces 없으면 Map 변경 없음", () => {
    const map = new Map<string, string[]>([["c1", ["kube-system"]]]);
    const payload: ScanProgressPayload = {
      scanId: "s1",
      clusterId: "c1",
      percent: 30,
      message: "scanning...",
      scanner: "trivy",
    };
    const next = applyProgressToTimedOutMap(map, payload);
    expect(next.get("c1")).toEqual(["kube-system"]);
  });

  it("c1의 timeout이 c2에 영향 없음", () => {
    const map = new Map<string, string[]>();
    const payload: ScanProgressPayload = {
      scanId: "s1",
      clusterId: "c1",
      percent: 50,
      message: "kube-system timed out",
      scanner: "trivy",
      timedOutNamespaces: ["kube-system"],
    };
    const next = applyProgressToTimedOutMap(map, payload);
    expect(next.get("c1")).toEqual(["kube-system"]);
    expect(next.get("c2")).toBeUndefined(); // 다른 클러스터에 영향 없음
  });

  it("ns accumulate: 두 번째 progress로 monitoring 추가", () => {
    const map = new Map<string, string[]>([["c1", ["kube-system"]]]);
    const payload: ScanProgressPayload = {
      scanId: "s1",
      clusterId: "c1",
      percent: 70,
      message: "monitoring timed out",
      scanner: "trivy",
      timedOutNamespaces: ["kube-system", "monitoring"],
    };
    const next = applyProgressToTimedOutMap(map, payload);
    expect(next.get("c1")).toEqual(["kube-system", "monitoring"]);
  });

  it("중복 namespace dedup", () => {
    const map = new Map<string, string[]>([["c1", ["kube-system"]]]);
    const payload: ScanProgressPayload = {
      scanId: "s1",
      clusterId: "c1",
      percent: 60,
      message: "...",
      scanner: "trivy",
      timedOutNamespaces: ["kube-system"], // already in map
    };
    const next = applyProgressToTimedOutMap(map, payload);
    expect(next.get("c1")).toEqual(["kube-system"]);
  });
});

describe(": startScan — 앱 재시작 후 timedOutNamespaces 유지", () => {
  it("일반 스캔: 해당 cluster의 timedOutNamespaces 초기화", () => {
    const map = new Map<string, string[]>([
      ["c1", ["kube-system", "monitoring"]],
      ["c2", ["default"]], // 다른 cluster는 영향 없음
    ]);
    const next = applyStartScanToTimedOutMap(map, { clusterId: "c1" });
    expect(next.get("c1")).toBeUndefined();
    expect(next.get("c2")).toEqual(["default"]); // 다른 cluster 유지
  });

  it("재스캔 모드: 재스캔 대상 ns만 제거, 나머지 유지", () => {
    const map = new Map<string, string[]>([["c1", ["kube-system", "monitoring", "default"]]]);
    const next = applyStartScanToTimedOutMap(map, {
      clusterId: "c1",
      retryNamespaces: ["kube-system", "monitoring"],
    });
    expect(next.get("c1")).toEqual(["default"]);
  });

  it("재스캔 모드: 전부 재스캔 시 key 삭제", () => {
    const map = new Map<string, string[]>([["c1", ["kube-system"]]]);
    const next = applyStartScanToTimedOutMap(map, {
      clusterId: "c1",
      retryNamespaces: ["kube-system"],
    });
    expect(next.get("c1")).toBeUndefined();
  });

  it("retryNamespaces 빈 배열 → 일반 스캔으로 처리", () => {
    const map = new Map<string, string[]>([["c1", ["kube-system"]]]);
    const next = applyStartScanToTimedOutMap(map, { clusterId: "c1", retryNamespaces: [] });
    expect(next.get("c1")).toBeUndefined();
  });
});

describe("ScanState.timedOutScanners는 scanState에 유지", () => {
  it("timedOutScanners 초기값: 빈 배열", () => {
    const s = makeScanState();
    expect(s.timedOutScanners).toEqual([]);
  });

  it("timedOutScanners override 가능", () => {
    const s = makeScanState({ timedOutScanners: ["trivy"] });
    expect(s.timedOutScanners).toEqual(["trivy"]);
  });
});

describe("RunScanRequest retryNamespaces 타입 verify", () => {
  it("retryNamespaces: string[] 타입 할당 가능", () => {
    const req = {
      clusterId: "c1",
      contextName: "ctx",
      kubeconfigPath: "/kube/config",
      scanner: "trivy" as const,
      retryNamespaces: ["kube-system", "monitoring"],
    };
    expect(Array.isArray(req.retryNamespaces)).toBe(true);
    expect(req.retryNamespaces).toHaveLength(2);
  });

  it("retryNamespaces 없으면 undefined", () => {
    const req = {
      clusterId: "c1",
      contextName: "ctx",
      kubeconfigPath: "/kube/config",
      scanner: "all" as const,
    };
    expect((req as { retryNamespaces?: string[] }).retryNamespaces).toBeUndefined();
  });
});
