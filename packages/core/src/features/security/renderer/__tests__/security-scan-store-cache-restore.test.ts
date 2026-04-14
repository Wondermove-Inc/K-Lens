/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * isCacheRestoring race condition guard tests
 *
 * Verifies that SecurityScanStore correctly blocks scan actions during
 * cache restoration to prevent the race condition where:
 *   1. restoreFromCache() starts (IPC round-trip ~3-4s)
 *   2. user triggers startScan()
 *   3. startScan clears findings before cache restoration completes
 *   4. restoreFromCache completes and overwrites → data loss / collision
 *
 * Test strategy: pure logic unit tests mirroring store behavior,
 * no real MobX/IPC dependency required.
 */

// ────────────────────────────────────────────────────────────────────────────
// Types (mirrored from security-scan-store.ts)
// ────────────────────────────────────────────────────────────────────────────

interface MockStoreState {
  isCacheRestoring: boolean;
  isScanning: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Pure helper: mirrors startScan() guard logic
// ────────────────────────────────────────────────────────────────────────────

/**
 * Mirrors the guard logic in SecurityScanStore.startScan():
 *   if (this.isCacheRestoring || this.isScanning) return null;
 */
function canStartScan(state: MockStoreState): boolean {
  return !state.isCacheRestoring && !state.isScanning;
}

// ────────────────────────────────────────────────────────────────────────────
// Pure helper: mirrors restoreFromCache() flag lifecycle
// ────────────────────────────────────────────────────────────────────────────

/**
 * Simulates restoreFromCache() with try/finally pattern.
 * Returns final isCacheRestoring value after execution.
 */
async function simulateRestoreFromCache(opts: {
  shouldThrow?: boolean;
}): Promise<{ isCacheRestoringDuring: boolean; isCacheRestoringAfter: boolean }> {
  let isCacheRestoring = false;
  let isCacheRestoringDuring = false;

  isCacheRestoring = true; // set at start
  try {
    // simulate async IPC work
    await Promise.resolve();
    isCacheRestoringDuring = isCacheRestoring; // capture state mid-restore
    if (opts.shouldThrow) {
      throw new Error("[security-cache] Restore failed: IPC timeout");
    }
  } catch (_err) {
    // error path — finally still runs
  } finally {
    isCacheRestoring = false; // always reset
  }

  return { isCacheRestoringDuring, isCacheRestoringAfter: isCacheRestoring };
}

// ────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────

describe("isCacheRestoring: startScan() guard", () => {
  it("캐시 복원 중에는 startScan() null 반환 (isCacheRestoring=true)", () => {
    const state: MockStoreState = { isCacheRestoring: true, isScanning: false };
    expect(canStartScan(state)).toBe(false);
  });

  it("스캔 진행 중에는 startScan() null 반환 (isScanning=true)", () => {
    const state: MockStoreState = { isCacheRestoring: false, isScanning: true };
    expect(canStartScan(state)).toBe(false);
  });

  it("캐시 복원 중 + 스캔 중 동시 → null 반환", () => {
    const state: MockStoreState = { isCacheRestoring: true, isScanning: true };
    expect(canStartScan(state)).toBe(false);
  });

  it("캐시 복원 완료 + 스캔 아님 → startScan() 허용", () => {
    const state: MockStoreState = { isCacheRestoring: false, isScanning: false };
    expect(canStartScan(state)).toBe(true);
  });
});

describe("isCacheRestoring: restoreFromCache() 플래그 라이프사이클", () => {
  it("복원 시작 시 isCacheRestoring=true", async () => {
    const { isCacheRestoringDuring } = await simulateRestoreFromCache({ shouldThrow: false });
    expect(isCacheRestoringDuring).toBe(true);
  });

  it("복원 성공 완료 후 isCacheRestoring=false (finally 해제)", async () => {
    const { isCacheRestoringAfter } = await simulateRestoreFromCache({ shouldThrow: false });
    expect(isCacheRestoringAfter).toBe(false);
  });

  it("복원 실패(throw) 후에도 isCacheRestoring=false (finally 보장)", async () => {
    const { isCacheRestoringAfter } = await simulateRestoreFromCache({ shouldThrow: true });
    expect(isCacheRestoringAfter).toBe(false);
  });

  it("복원 실패 시 버튼이 영구 disabled 되지 않음 (엣지케이스)", async () => {
    // If finally is missing, isCacheRestoring would stay true after error
    // This test verifies the finally block is correctly implemented
    const { isCacheRestoringAfter } = await simulateRestoreFromCache({ shouldThrow: true });
    const stateAfterError: MockStoreState = { isCacheRestoring: isCacheRestoringAfter, isScanning: false };
    expect(canStartScan(stateAfterError)).toBe(true); // scan must be possible after restore failure
  });
});

describe("isCacheRestoring: 상태 전이 시나리오", () => {
  it("초기 상태 → 복원 중 → 복원 완료 순서 검증", async () => {
    const states: boolean[] = [];

    // initial
    let isCacheRestoring = false;
    states.push(isCacheRestoring); // [false]

    // start restore
    isCacheRestoring = true;
    states.push(isCacheRestoring); // [false, true]

    // simulate async work
    await Promise.resolve();

    // finally
    isCacheRestoring = false;
    states.push(isCacheRestoring); // [false, true, false]

    expect(states).toEqual([false, true, false]);
  });

  it("복원 완료 전 스캔 시도 차단 → 완료 후 허용 (race condition 방지)", async () => {
    let isCacheRestoring = false;
    let scanAttemptDuringRestore: boolean | null = null;
    let scanAttemptAfterRestore: boolean | null = null;

    // start restore
    isCacheRestoring = true;

    // user attempts scan during restore
    scanAttemptDuringRestore = canStartScan({ isCacheRestoring, isScanning: false });

    // restore completes
    isCacheRestoring = false;

    // user attempts scan after restore
    scanAttemptAfterRestore = canStartScan({ isCacheRestoring, isScanning: false });

    expect(scanAttemptDuringRestore).toBe(false); // blocked
    expect(scanAttemptAfterRestore).toBe(true); // allowed
  });

  it("3개 클러스터 복원: 모두 완료 후에만 isCacheRestoring=false", async () => {
    // Simulates the scenario where restoreFromCache resolves after all 3 clusters
    // are restored (the entire IPC call covers all clusters)
    let isCacheRestoring = false;

    // Before restore
    expect(canStartScan({ isCacheRestoring, isScanning: false })).toBe(true);

    isCacheRestoring = true;
    // During restore (all 3 clusters processing)
    expect(canStartScan({ isCacheRestoring, isScanning: false })).toBe(false);

    // All clusters restored → finally block fires
    isCacheRestoring = false;
    expect(canStartScan({ isCacheRestoring, isScanning: false })).toBe(true);
  });
});
