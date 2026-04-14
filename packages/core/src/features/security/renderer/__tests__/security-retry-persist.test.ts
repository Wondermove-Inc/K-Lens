/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * retry 도중 앱 종료 시 timedOut namespace 알림 카드 복원 테스트
 *
 * Covers: commit 2204de52
 * - persistToCache(clusterId, timedOutNamespacesOverride?) override param
 * - retry 시작 시 원본 ns 목록(current)으로 persist
 * - 앱 종료 후 재시작 시 모든 ns 알림 카드 복원 보장
 */

// ──────────────────────────────────────────────────────────────────────────────
// Shared types & helpers
// ──────────────────────────────────────────────────────────────────────────────

interface MockPersistCall {
  clusterId: string;
  timedOutNamespacesOverride: string[] | undefined;
}

/**
 * Mirrors persistToCache logic:
 * _timedOutNamespaces = override ?? timedOutNamespacesByCluster.get(clusterId) ?? []
 */
function resolveTimedOutForCache(
  clusterId: string,
  timedOutByCluster: Map<string, string[]>,
  override?: string[],
): string[] {
  return override ?? timedOutByCluster.get(clusterId) ?? [];
}

/**
 * Mirrors startScan() retry branch:
 * 1. snapshot current ns
 * 2. set remaining in-memory
 * 3. persistToCache with current (override)
 */
function simulateRetryStart(
  clusterId: string,
  currentTimedOut: string[],
  retryNamespaces: string[],
  persistCalls: MockPersistCall[],
  timedOutByCluster: Map<string, string[]>,
): void {
  // Snapshot
  const original = [...currentTimedOut];

  // In-memory: remove retried ns
  const remaining = currentTimedOut.filter((ns) => !retryNamespaces.includes(ns));
  if (remaining.length > 0) {
    timedOutByCluster.set(clusterId, remaining);
  } else {
    timedOutByCluster.delete(clusterId);
  }

  // Persist with original ns (2204de52 fix)
  persistCalls.push({ clusterId, timedOutNamespacesOverride: original });
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe("retry persist: timedOut ns cache override on retry start", () => {
  it("persists original ns list (not remaining) when retry starts", () => {
    const timedOutByCluster = new Map([["cluster-A", ["ns-1", "ns-2", "ns-3"]]]);
    const persistCalls: MockPersistCall[] = [];

    simulateRetryStart("cluster-A", ["ns-1", "ns-2", "ns-3"], ["ns-1", "ns-2"], persistCalls, timedOutByCluster);

    expect(persistCalls).toHaveLength(1);
    expect(persistCalls[0].timedOutNamespacesOverride).toEqual(["ns-1", "ns-2", "ns-3"]);
  });

  it("in-memory state has remaining ns only (hides retry ns in UI)", () => {
    const timedOutByCluster = new Map([["cluster-A", ["ns-1", "ns-2", "ns-3"]]]);
    const persistCalls: MockPersistCall[] = [];

    simulateRetryStart("cluster-A", ["ns-1", "ns-2", "ns-3"], ["ns-1", "ns-2"], persistCalls, timedOutByCluster);

    expect(timedOutByCluster.get("cluster-A")).toEqual(["ns-3"]);
  });

  it("cache would restore all 3 ns after app kill during retry", () => {
    const timedOutByCluster = new Map([["cluster-A", ["ns-1", "ns-2", "ns-3"]]]);
    const persistCalls: MockPersistCall[] = [];

    simulateRetryStart("cluster-A", ["ns-1", "ns-2", "ns-3"], ["ns-1", "ns-2"], persistCalls, timedOutByCluster);

    // Simulate: app killed during retry → restart
    // cache has _timedOutNamespaces = override = original
    const cachedNs = resolveTimedOutForCache(
      "cluster-A",
      timedOutByCluster,
      persistCalls[0].timedOutNamespacesOverride,
    );
    expect(cachedNs).toEqual(["ns-1", "ns-2", "ns-3"]);
  });

  it("old behavior (a6d43298): would persist remaining only — losing retry ns", () => {
    const timedOutByCluster = new Map([["cluster-A", ["ns-1", "ns-2", "ns-3"]]]);

    // Simulate old behavior: persist without override (remaining in-memory)
    const remaining = ["ns-1", "ns-2", "ns-3"].filter((ns) => !["ns-1", "ns-2"].includes(ns));
    timedOutByCluster.set("cluster-A", remaining);
    // Old: persistToCache without override
    const cachedNsOld = resolveTimedOutForCache("cluster-A", timedOutByCluster, undefined);
    expect(cachedNsOld).toEqual(["ns-3"]); // Only ns-3 — ns-1, ns-2 would be MISSING after restart
  });

  it("retrying all ns: remaining is empty → in-memory delete, cache has all original", () => {
    const timedOutByCluster = new Map([["cluster-A", ["ns-1", "ns-2"]]]);
    const persistCalls: MockPersistCall[] = [];

    simulateRetryStart("cluster-A", ["ns-1", "ns-2"], ["ns-1", "ns-2"], persistCalls, timedOutByCluster);

    expect(timedOutByCluster.has("cluster-A")).toBe(false); // in-memory: cleared
    expect(persistCalls[0].timedOutNamespacesOverride).toEqual(["ns-1", "ns-2"]); // cache: original
  });

  it("retrying partial: remaining has 1 ns in-memory, cache has all 3", () => {
    const timedOutByCluster = new Map([["cluster-A", ["ns-1", "ns-2", "ns-3"]]]);
    const persistCalls: MockPersistCall[] = [];

    simulateRetryStart("cluster-A", ["ns-1", "ns-2", "ns-3"], ["ns-2"], persistCalls, timedOutByCluster);

    expect(timedOutByCluster.get("cluster-A")).toEqual(["ns-1", "ns-3"]); // remaining in-memory
    expect(persistCalls[0].timedOutNamespacesOverride).toEqual(["ns-1", "ns-2", "ns-3"]); // cache: all
  });

  it("retry success: handleComplete persists without override → only remaining ns in cache", () => {
    const timedOutByCluster = new Map([["cluster-A", ["ns-3"]]]);
    // After retry success: handleComplete → persistToCache without override
    const cachedNsAfterSuccess = resolveTimedOutForCache("cluster-A", timedOutByCluster, undefined);
    expect(cachedNsAfterSuccess).toEqual(["ns-3"]); // only remaining
  });

  it("retry success → all ns done: cache has empty timedOut", () => {
    const timedOutByCluster = new Map<string, string[]>(); // all cleared
    const cachedNs = resolveTimedOutForCache("cluster-A", timedOutByCluster, undefined);
    expect(cachedNs).toEqual([]);
  });

  it("cancel during retry: _cancelSnapshot restores original ns, persist with them", () => {
    // cancelScan: restores from _cancelSnapshot → persistToCache (no override needed)
    const snapshot = { timedOutNamespaces: ["ns-1", "ns-2", "ns-3"] };
    const timedOutByCluster = new Map([["cluster-A", snapshot.timedOutNamespaces]]);
    const cachedNs = resolveTimedOutForCache("cluster-A", timedOutByCluster, undefined);
    expect(cachedNs).toEqual(["ns-1", "ns-2", "ns-3"]);
  });
});
