/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * MobX store for managing security scan state (Renderer Process)
 * Renderer MobX store implementation
 *
 * Key responsibilities:
 * - Initiate/cancel scan requests via IPC invoke → Main
 * - Manage scan progress, results, and errors as MobX observables
 * - Listen to Main Process push channels (progress/complete/error)
 *
 * Patterns:
 * - IPC request: `requestFromChannelInjectionToken`
 * - Push listener: `messageChannelListenerInjectionToken` (3 separate injectables)
 * - State management: MobX `makeObservable`
 *
 * @packageDocumentation
 */

import { action, computed, makeAutoObservable } from "mobx";

import type { RequestFromChannel } from "@skuberplus/messaging";

import type { ImageCveGroup } from "../common/daive-fix-engine/cve-image-grouper";

/** Image Upgrade 분석 결과 */
export interface UpgradeAnalysisResult {
  status: "idle" | "analyzing" | "done" | "error";
  recommendation?: "upgrade" | "review" | "hold";
  resolvedCves?: number;
  newCves?: number;
  suggestedTag?: string;
  error?: string;
}

import {
  securityCancelScanChannel,
  securityLoadAllScanCachesChannel,
  securityRunScanChannel,
  securitySaveScanCacheChannel,
} from "../common/security-ipc-channels";

import type { AnySecurityFinding } from "../../../common/security/security-finding";
import type {
  LoadAllScanCachesRequest,
  LoadAllScanCachesResponse,
  RunScanRequest,
  SaveScanCacheRequest,
  ScanCompletePayload,
  ScanErrorPayload,
  ScanProgressPayload,
} from "../common/security-ipc-channels";

// ============================================
// Scan state types
// ============================================

export type ScanStatus = "idle" | "scanning" | "complete" | "error";

export interface ScanState {
  scanId: string | null;
  status: ScanStatus;
  /** The clusterId currently being scanned — used by UI to detect cross-cluster scan state */
  currentClusterId: string | null;
  /** Progress 0–100 */
  progress: number;
  /** Status message */
  message: string;
  /** Number of findings discovered so far */
  findingsSoFar: number;
  /** List of completed scanners */
  completedScanners: Array<"trivy" | "kubescape">;
  /** Last error */
  lastError: ScanErrorPayload | null;
  /** Scan completion timestamp */
  scannedAt: string | null;
  /** Requested scanner mode ("trivy" | "kubescape" | "all") */
  scannerMode: "trivy" | "kubescape" | "all";
  /** Scanners that timed out — results may be incomplete */
  timedOutScanners: Array<"trivy" | "kubescape">;
}

// ============================================
// Default scan state constant
// ============================================

const DEFAULT_SCAN_STATE: ScanState = {
  scanId: null,
  status: "idle",
  currentClusterId: null,
  progress: 0,
  message: "",
  findingsSoFar: 0,
  completedScanners: [],
  lastError: null,
  scannedAt: null,
  scannerMode: "all",
  timedOutScanners: [],
};

// ============================================
// SecurityScanStore
// ============================================

// ============================================
// DAIVE HITL Preference
// ============================================

/**
 * DAIVE HITL (Human-in-the-Loop) 선호 수준 — 사용자가 AI Fix 모달에서 직접 설정
 *
 * - "strict"  : 모든 YAML 패치에 대해 승인 요청 (디폴트, 가장 안전)
 * - "normal"  : High/Critical severity 그룹만 승인 요청, 나머지 자동 적용
 */
export type DaiveHitlPreference = "strict" | "normal";

export const DAIVE_HITL_PREFERENCE_OPTIONS: Array<{
  value: DaiveHitlPreference;
  label: string;
  description: string;
  icon: string;
}> = [
  { value: "strict", label: "Strict", description: "Approve all patches", icon: "S" },
  { value: "normal", label: "Normal", description: "Approve High/Critical only", icon: "N" },
];

const DAIVE_HITL_PREF_KEY = "skuberplus-daive-hitl-preference";
// ============================================
// Remediation History
// ============================================

/**
 * 조치 이력 이벤트 타입
 * - apply    : 패치 적용 (Tier1/Tier2 YAML 적용)
 * - rollback : 롤백 실행
 * - scan     : 보안 스캔 완료
 * - approve  : Tier2 그룹 승인
 * - reject   : Tier2 그룹 거절
 */
export type RemediationEventType = "apply" | "rollback" | "scan" | "approve" | "reject";

export interface RemediationEvent {
  /** 고유 이벤트 ID */
  id: string;
  /** 이벤트 타입 */
  type: RemediationEventType;
  /** 발생 시각 (Unix ms) */
  timestamp: number;
  /** 클러스터 ID */
  clusterId: string;
  /** 대상 namespace (없으면 전체) */
  namespace?: string;
  /** KSV checkId 또는 CVE ID */
  checkId?: string;
  /** 성공/실패 여부 */
  status: "success" | "failed" | "partial";
  /** 상세 메시지 */
  detail?: string;
  /** 영향받은 리소스 수 */
  count?: number;
}

export class SecurityScanStore {
  // ——————————————————————
  // observable state
  // ——————————————————————

  /** clusterId → ScanState (per-cluster scan state isolation) */
  private _scanStateByCluster = new Map<string, ScanState>();

  /** The clusterId this store instance is hosting (set by SecurityPage on mount) */
  private _hostedClusterId: string | null = null;

  /** clusterId → AnySecurityFinding[] */
  findings = new Map<string, AnySecurityFinding[]>();

  /**
   * clusterId → string[] of timed-out namespaces
   * Isolated per cluster to prevent cross-cluster contamination.
   * Persisted via scanState cache so data survives app restart.
   */
  timedOutNamespacesByCluster = new Map<string, string[]>();

  /**
   * Snapshot taken at scan start — used to restore state if the scan is cancelled.
   * Case 1 (full rescan): restores findings + timedOutNamespaces so dashboard stays intact.
   * Case 2 (retry): restores timedOutNamespaces so timeout alert cards reappear.
   */
  private _cancelSnapshot: {
    clusterId: string;
    findings: AnySecurityFinding[] | null; // null = full rescan (findings were cleared)
    timedOutNamespaces: string[];
    scannedAt: string | null; // preserved so score-card showHeaderActions stays active after cancel
  } | null = null;

  /** True while the initial cache restore is in progress — blocks Start Scan button */
  isCacheLoading = true;

  // ——————————————————————
  // DAIVE 5-상태 분류 결과
  // ——————————————————————

  // ——————————————————————
  // Image Upgrade 분석 결과
  // ——————————————————————

  /** CVE 이미지 그룹 목록 */
  imageGroups: ImageCveGroup[] = [];
  /** imageRef → 업그레이드 분석 결과 */
  upgradeResults: Map<string, UpgradeAnalysisResult> = new Map();
  /** Image Upgrade 분석 실행 중 */
  isImageAnalyzing = false;

  // ——————————————————————
  // Remediation History (클러스터별, sessionStorage 기반)
  // ——————————————————————

  /** clusterId → RemediationEvent[] (최신 순, 최대 200개) */
  remediationHistory: Map<string, RemediationEvent[]> = new Map();

  // ——————————————————————
  // DAIVE HITL Preference (사용자 설정, localStorage 영속)
  // ——————————————————————

  /** DAIVE AI Fix 승인 수준 */
  daiveHitlPreference: DaiveHitlPreference = (() => {
    try {
      const saved = window.localStorage.getItem(DAIVE_HITL_PREF_KEY);
      if (saved === "strict" || saved === "normal") return saved as DaiveHitlPreference;
    } catch {
      /* ignore */
    }
    return "strict";
  })();

  // ——————————————————————
  // getter / setter for scanState (per-cluster transparent access — UI reads only)
  // ——————————————————————

  /**
   * Returns the ScanState for the currently hosted cluster.
   * Falls back to DEFAULT_SCAN_STATE if no cluster is set or no state exists.
   * For UI consumption only — internal store logic uses _getScanStateForCluster(clusterId).
   */
  get scanState(): ScanState {
    const id = this._hostedClusterId;
    if (!id) return { ...DEFAULT_SCAN_STATE };
    return this._scanStateByCluster.get(id) ?? { ...DEFAULT_SCAN_STATE };
  }

  /**
   * Sets the ScanState for the currently hosted cluster.
   * If called during a scan (currentClusterId in state), uses that clusterId instead.
   */
  set scanState(state: ScanState) {
    const id = state.currentClusterId ?? this._hostedClusterId;
    if (id) {
      this._scanStateByCluster.set(id, state);
    }
  }

  /** hostedClusterId getter */
  get hostedClusterId(): string | null {
    return this._hostedClusterId;
  }

  /**
   * hostedClusterId setter — when cluster changes, scanState automatically
   * switches to that cluster's state via the getter.
   * If no cached state exists but findings do, synthesize a "complete" state.
   */
  set hostedClusterId(id: string | null) {
    this._hostedClusterId = id;
    // If this cluster has findings but no scanState yet (e.g. cache file missing),
    // synthesize a "complete" state so the dashboard renders
    if (id && !this._scanStateByCluster.has(id)) {
      const hasFindings = (this.findings.get(id)?.length ?? 0) > 0;
      if (hasFindings) {
        this._scanStateByCluster.set(id, {
          ...DEFAULT_SCAN_STATE,
          status: "complete",
          progress: 100,
          message: "Scan complete",
        });
      }
    }
  }

  // dependencies (DI injection)
  // ——————————————————————

  constructor(private readonly requestFromChannel: RequestFromChannel) {
    makeAutoObservable(
      this,
      {
        scanState: computed,
        hostedClusterId: computed,
        imageGroups: true,
        upgradeResults: true,
        isImageAnalyzing: true,
        daiveHitlPreference: true,
        remediationHistory: true,
      },
      { autoBind: true },
    );
    // Delay restore until after DI container + Main IPC handlers are fully initialized
    setTimeout(() => {
      void this.restoreFromCache();
    }, 500);
  }

  // ——————————————————————
  // IPC-based cache persistence (Main process file storage)
  // ——————————————————————

  /** Persists the completed scan result to Main process file cache via IPC. */
  private async persistToCache(clusterId: string): Promise<void> {
    try {
      const rawFindings = this.findings.get(clusterId) ?? [];
      console.log(`[security-cache] Persisting ${rawFindings.length} findings for cluster ${clusterId}`);
      // Serialize MobX observables to plain objects before IPC transfer.
      // Electron structured clone cannot handle observable arrays/objects.
      const plainFindings = JSON.parse(JSON.stringify(rawFindings)) as unknown[];
      const clusterScanState = this._scanStateByCluster.get(clusterId) ?? this.scanState;
      const plainScanState = JSON.parse(JSON.stringify(clusterScanState)) as Record<string, unknown>;
      // Embed clusterId and timedOutNamespaces so restore can recover them
      plainScanState["_clusterId"] = clusterId;
      plainScanState["_timedOutNamespaces"] = this.timedOutNamespacesByCluster.get(clusterId) ?? [];
      const req: SaveScanCacheRequest = {
        clusterId,
        scanState: plainScanState,
        findings: plainFindings,
      };
      const result = await this.requestFromChannel<SaveScanCacheRequest, { success: boolean }>(
        securitySaveScanCacheChannel,
        req,
      );
      console.log(`[security-cache] Save result:`, result);
    } catch (err) {
      console.error(`[security-cache] Failed to persist cache:`, err);
    }
  }

  /** Restores all cluster scan caches from disk on startup.
   * Loads every clusterId.json within TTL (7 days) so switching clusters
   * does not require a re-scan. scanState is stored per-cluster in _scanStateByCluster. */
  @action
  private async restoreFromCache(): Promise<void> {
    // Do not overwrite scanState if a scan is already in progress
    // (startScan may have been called before this 500ms-delayed restore fires)
    if (this.isScanning) {
      console.log("[security-cache] Skipping restore — scan already in progress");
      this.isCacheLoading = false;
      return;
    }
    this.isCacheLoading = true;
    try {
      console.log("[security-cache] Attempting to restore all cluster caches...");
      const res = await this.requestFromChannel<LoadAllScanCachesRequest, LoadAllScanCachesResponse>(
        securityLoadAllScanCachesChannel,
        {},
      );
      if (!res.caches.length) {
        console.log("[security-cache] No valid caches found.");
        this.isCacheLoading = false;
        return;
      }
      // Sort by mtime descending — most recently saved cluster first
      const sorted = [...res.caches].sort((a, b) => b.mtime - a.mtime);
      for (const cache of sorted) {
        this.findings.set(cache.clusterId, cache.findings as AnySecurityFinding[]);
        // Restore per-cluster timed-out namespaces
        const cachedTimedOut = (cache.scanState as Record<string, unknown>)["_timedOutNamespaces"];
        if (Array.isArray(cachedTimedOut) && cachedTimedOut.length > 0) {
          this.timedOutNamespacesByCluster.set(cache.clusterId, cachedTimedOut as string[]);
          console.log(
            `[security-cache] Restored ${cachedTimedOut.length} timed-out namespaces for cluster ${cache.clusterId}`,
          );
        }
        // Restore per-cluster scanState
        const {
          _clusterId: _,
          _timedOutNamespaces: __,
          ...cleanState
        } = cache.scanState as Record<string, unknown> & { _clusterId?: unknown; _timedOutNamespaces?: unknown };
        // Reset scanning state (app killed mid-scan)
        if (cleanState["status"] === "scanning") {
          const hasFindings = (cache.findings?.length ?? 0) > 0;
          cleanState["status"] = hasFindings ? "complete" : "idle";
          cleanState["progress"] = hasFindings ? 100 : 0;
          cleanState["message"] = hasFindings ? "" : "";
          cleanState["scanId"] = null;
          console.log(
            `[security-cache] Cached status was scanning — reset to ${cleanState["status"] as string} for cluster ${cache.clusterId} (${cache.findings?.length ?? 0} findings)`,
          );
        }
        this._scanStateByCluster.set(cache.clusterId, cleanState as unknown as ScanState);
        console.log(
          `[security-cache] Restored ${cache.findings.length} findings + scanState for cluster ${cache.clusterId}`,
        );
      }
      this.isCacheLoading = false;
    } catch (err) {
      console.error("[security-cache] Restore failed:", err);
      this.isCacheLoading = false;
    }
  }

  // ——————————————————————
  // computed
  // ——————————————————————

  /**
   * True if ANY cluster is currently scanning.
   * Uses Map iteration to avoid getter (_hostedClusterId) dependency — ensures
   * correct result even when viewing a different cluster during a background scan.
   */
  @computed get isScanning(): boolean {
    for (const state of this._scanStateByCluster.values()) {
      if (state.status === "scanning") return true;
    }
    return false;
  }

  /**
   * Returns the scanId of any actively scanning cluster.
   * Falls back to the hosted cluster's scanId for backwards compatibility.
   */
  @computed get currentScanId(): string | null {
    for (const state of this._scanStateByCluster.values()) {
      if (state.status === "scanning" && state.scanId) return state.scanId;
    }
    return this.scanState.scanId;
  }

  getFindingsForCluster(clusterId: string): AnySecurityFinding[] {
    return this.findings.get(clusterId) ?? [];
  }

  /** Returns timed-out namespaces for the given cluster (empty if none). */
  getTimedOutNamespacesForCluster(clusterId: string): string[] {
    return this.timedOutNamespacesByCluster.get(clusterId) ?? [];
  }

  /** Clears timed-out namespace list for a cluster (e.g. after successful retry). */
  @action
  clearTimedOutNamespacesForCluster(clusterId: string): void {
    this.timedOutNamespacesByCluster.delete(clusterId);
  }

  // ——————————————————————
  // actions (IPC requests)
  // ——————————————————————

  @action
  async startScan(request: RunScanRequest): Promise<string | null> {
    if (this.isScanning) return null;

    const isRetry = !!request.retryNamespaces && request.retryNamespaces.length > 0;

    // Use direct Map lookup — avoids getter (_hostedClusterId) dependency
    const prevState = this._getScanStateForCluster(request.clusterId);

    // Immediately switch to scanning state before IPC response
    // retryNamespaces mode: keep existing findings (new results will be merged)
    // Regular scan: clear findings (prevent accumulating old results)
    if (!isRetry) {
      // Snapshot before clearing — allows cancel to restore the previous dashboard (Case 1)
      this._cancelSnapshot = {
        clusterId: request.clusterId,
        findings: [...(this.findings.get(request.clusterId) ?? [])],
        timedOutNamespaces: [...(this.timedOutNamespacesByCluster.get(request.clusterId) ?? [])],
        scannedAt: prevState.scannedAt,
      };
      this.findings.delete(request.clusterId);
      // NOTE: do NOT clearCache here — persistToCache on completion will overwrite.
      // Deleting early means a mid-scan restart loses all previous findings.
      // Clear all timed-out namespaces for this cluster on full rescan
      this.timedOutNamespacesByCluster.delete(request.clusterId);
    } else if (request.retryNamespaces) {
      // Snapshot before removing retried ns — allows cancel to restore timeout alerts (Case 2)
      const current = this.timedOutNamespacesByCluster.get(request.clusterId) ?? [];
      this._cancelSnapshot = {
        clusterId: request.clusterId,
        findings: null, // retry does not clear findings
        timedOutNamespaces: [...current],
        scannedAt: prevState.scannedAt,
      };
      // Partial retry: remove retried namespaces from timed-out list
      const remaining = current.filter((ns) => !request.retryNamespaces!.includes(ns));
      if (remaining.length > 0) {
        this.timedOutNamespacesByCluster.set(request.clusterId, remaining);
      } else {
        this.timedOutNamespacesByCluster.delete(request.clusterId);
      }
    }

    this._setScanStateForCluster(request.clusterId, {
      ...prevState,
      status: "scanning",
      currentClusterId: request.clusterId,
      progress: 5, // Start at 5% immediately to avoid appearing stuck at 0
      message: isRetry
        ? `Retrying ${request.retryNamespaces!.length} namespace(s): ${request.retryNamespaces!.join(", ")}...`
        : "Preparing scan...",
      completedScanners: [],
      // retry: reflect current accumulated findings count; full scan: reset to 0
      findingsSoFar: isRetry ? (this.findings.get(request.clusterId)?.length ?? 0) : 0,
    });

    const response = await this.requestFromChannel<
      RunScanRequest,
      { success: boolean; scanId: string; error?: string }
    >(securityRunScanChannel, request);

    if (!response.success) {
      // Restore findings from snapshot if IPC request itself failed (e.g. concurrent scan rejected)
      // findings.delete() was already called above for full rescan; snapshot holds the previous data
      if (this._cancelSnapshot && this._cancelSnapshot.clusterId === request.clusterId) {
        const { findings, timedOutNamespaces } = this._cancelSnapshot;
        if (findings !== null) {
          this.findings.set(request.clusterId, findings);
        }
        if (timedOutNamespaces.length > 0) {
          this.timedOutNamespacesByCluster.set(request.clusterId, timedOutNamespaces);
        }
        this._cancelSnapshot = null;
      }
      this.setScanError(
        {
          scanId: "",
          clusterId: request.clusterId,
          errorType: "REQUEST_FAILED",
          message: response.error ?? "Scan request failed",
          scanner: request.scanner === "all" ? "trivy" : request.scanner,
        },
        request.clusterId,
      );
      return null;
    }

    this.setScanStarted(response.scanId, request.scanner ?? "all", request.clusterId);
    return response.scanId;
  }

  @action
  async cancelScan(): Promise<void> {
    // Find the cluster that is currently scanning — do NOT rely on getter (_hostedClusterId)
    let scanningClusterId: string | null = null;
    let scanningState: ScanState | null = null;
    for (const [cid, state] of this._scanStateByCluster.entries()) {
      if (state.status === "scanning" && state.scanId) {
        scanningClusterId = cid;
        scanningState = state;
        break;
      }
    }
    if (!scanningClusterId || !scanningState) return;

    const scanIdToCancel = scanningState.scanId!;

    // Immediately null out scanId so any in-flight handleComplete/handleError events are dropped
    // (their guard: payload.scanId !== state.scanId will now be true → ignored)
    this._setScanStateForCluster(scanningClusterId, { ...scanningState, scanId: null });

    await this.requestFromChannel<{ scanId: string }, { success: boolean }>(securityCancelScanChannel, {
      scanId: scanIdToCancel,
    });

    // Restore previous state so dashboard remains intact after cancel (Case 1 & 2)
    if (this._cancelSnapshot && this._cancelSnapshot.clusterId === scanningClusterId) {
      const { clusterId, findings, timedOutNamespaces } = this._cancelSnapshot;
      if (findings !== null) {
        // Case 1: full rescan was cancelled — restore findings from snapshot
        this.findings.set(clusterId, findings);
      }
      // Restore timedOut namespaces (Case 1 & 2)
      if (timedOutNamespaces.length > 0) {
        this.timedOutNamespacesByCluster.set(clusterId, timedOutNamespaces);
      } else {
        this.timedOutNamespacesByCluster.delete(clusterId);
      }
      // Restore scannedAt so score-card showHeaderActions re-activates after cancel
      const restoredScannedAt = this._cancelSnapshot.scannedAt ?? scanningState.scannedAt;
      const restoredFindings = findings !== null ? findings : (this.findings.get(clusterId) ?? []);
      this._cancelSnapshot = null;
      // Determine restored status: complete if findings exist, idle otherwise
      const restoredStatus = restoredFindings.length > 0 ? "complete" : "idle";
      this._setScanStateForCluster(clusterId, {
        ...this._getScanStateForCluster(clusterId),
        status: restoredStatus,
        message: restoredStatus === "complete" ? "Scan cancelled." : "",
        scannedAt: restoredScannedAt,
        scanId: null,
      });
      void this.persistToCache(clusterId);
      return;
    }

    // No snapshot: fallback — set idle (no findings to restore)
    this._setScanStateForCluster(scanningClusterId, {
      ...this._getScanStateForCluster(scanningClusterId),
      status: "idle",
      message: "",
      scanId: null,
    });
  }

  // ——————————————————————
  // actions (Push channel handlers)
  // ——————————————————————

  @action
  handleProgress(payload: ScanProgressPayload): void {
    const state = this._getScanStateForCluster(payload.clusterId);
    // Accept progress even before scanId is set (main→renderer race condition)
    if (state.scanId !== null && payload.scanId !== state.scanId) return;

    this._setScanStateForCluster(payload.clusterId, {
      ...state,
      progress: Math.max(payload.percent, state.progress), // monotonically increasing
      message: payload.message,
      findingsSoFar: payload.findingsSoFar ?? state.findingsSoFar,
    });
    // Trivy namespace split scan: accumulate timed-out namespaces per cluster
    if (payload.timedOutNamespaces && payload.timedOutNamespaces.length > 0 && payload.clusterId) {
      const current = this.timedOutNamespacesByCluster.get(payload.clusterId) ?? [];
      const merged = Array.from(new Set([...current, ...payload.timedOutNamespaces]));
      this.timedOutNamespacesByCluster.set(payload.clusterId, merged);
    }
  }

  @action
  handleComplete(payload: ScanCompletePayload): void {
    const state = this._getScanStateForCluster(payload.clusterId);
    if (payload.scanId !== state.scanId) return;

    // Merge findings — always, even for partial events (per-namespace Trivy results)
    // Dedup by id — keep first occurrence when multiple scanners report the same finding.
    // Final dedup pass on the full merged array guards against any accumulated duplicates.
    const existing = this.findings.get(payload.clusterId) ?? [];
    const existingIds = new Set(existing.map((f) => f.id));
    const newFindings = payload.findings.filter((f) => !existingIds.has(f.id));
    const merged = [...existing, ...newFindings];
    // Full dedup pass — ensures no duplicate ids survive regardless of race conditions
    const seen = new Set<string>();
    const deduped = merged.filter((f) => {
      if (seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    });
    this.findings.set(payload.clusterId, deduped);

    // Partial events (e.g. per-namespace Trivy results) only update findings — do NOT advance state machine
    if (payload.partial) return;

    // Dedup completedScanners — same scanner must not be counted twice
    const alreadyCompleted = state.completedScanners.includes(payload.scanner);
    const completedScanners = alreadyCompleted
      ? state.completedScanners
      : [...state.completedScanners, payload.scanner];
    const allDone =
      completedScanners.length >= 2 ||
      // scanner !== all → done on first complete event
      !this._isExpectingBothScannersFor(payload.clusterId);

    this._setScanStateForCluster(payload.clusterId, {
      ...state,
      status: allDone ? "complete" : "scanning",
      completedScanners,
      progress: allDone ? 100 : state.progress,
      scannedAt: allDone ? payload.scannedAt : state.scannedAt,
      message: allDone ? "Scan complete" : `${payload.scanner} scan complete, continuing...`,
      // On final complete, sync findingsSoFar to actual merged total so the counter is accurate
      ...(allDone && { findingsSoFar: deduped.length }),
    });
    if (allDone) {
      // Save to Main process file cache + record clusterId in localStorage as restore hint
      void this.persistToCache(payload.clusterId);
      try {
        window.localStorage.setItem("skuberplus-last-scan-cluster", payload.clusterId);
      } catch {
        /* ignore */
      }
    }
  }

  @action
  handleError(payload: ScanErrorPayload): void {
    const state = this._getScanStateForCluster(payload.clusterId);
    if (payload.scanId !== state.scanId) return;

    // scanner=all mode: add to completedScanners even on error so the other scanner can finish
    if (this._isExpectingBothScannersFor(payload.clusterId)) {
      // Guard against duplicate error events for the same scanner
      const alreadyAdded = state.completedScanners.includes(payload.scanner);
      if (alreadyAdded) return;
      const completedScanners = [...state.completedScanners, payload.scanner];
      const allDone = completedScanners.length >= 2;
      const isTimeout = payload.errorType === "TIMEOUT";
      const timedOutScanners = isTimeout ? [...state.timedOutScanners, payload.scanner] : state.timedOutScanners;
      this._setScanStateForCluster(payload.clusterId, {
        ...state,
        status: allDone ? "complete" : "scanning",
        completedScanners,
        timedOutScanners,
        progress: allDone ? 100 : state.progress,
        scannedAt: allDone ? new Date().toISOString() : state.scannedAt,
        message: allDone ? `Scan complete (${payload.scanner} error)` : `${payload.scanner} error, continuing...`,
      });
      if (allDone) {
        // Persist even when one scanner errored/timed-out — findings from the other scanner must survive app restart
        void this.persistToCache(payload.clusterId);
        try {
          window.localStorage.setItem("skuberplus-last-scan-cluster", payload.clusterId);
        } catch {
          /* ignore */
        }
      }
    } else {
      this._setScanStateForCluster(payload.clusterId, {
        ...state,
        status: "error",
        lastError: payload,
        message: payload.message,
      });
    }
  }

  // ——————————————————————
  // private helpers
  // ——————————————————————

  /**
   * Get scanState for a specific cluster directly from the Map.
   * Unlike the scanState getter (which uses _hostedClusterId), this always
   * returns the state for the given clusterId — critical for all internal store
   * logic where the target cluster may differ from the currently viewed cluster.
   */
  private _getScanStateForCluster(clusterId: string): ScanState {
    return this._scanStateByCluster.get(clusterId) ?? { ...DEFAULT_SCAN_STATE };
  }

  /**
   * Set scanState for a specific cluster directly in the Map.
   */
  private _setScanStateForCluster(clusterId: string, state: ScanState): void {
    this._scanStateByCluster.set(clusterId, state);
  }

  private _isExpectingBothScannersFor(clusterId: string): boolean {
    return this._getScanStateForCluster(clusterId).scannerMode === "all";
  }

  @action
  private setScanStarted(scanId: string, scannerMode: "trivy" | "kubescape" | "all", clusterId: string): void {
    const state = this._getScanStateForCluster(clusterId);
    this._setScanStateForCluster(clusterId, {
      ...state,
      scanId,
      status: "scanning",
      currentClusterId: clusterId,
      progress: 5, // Keep at 5% to avoid appearing stuck at 0
      message: "Starting scan...",
      findingsSoFar: 0,
      completedScanners: [],
      lastError: null,
      scannedAt: null,
      scannerMode,
      timedOutScanners: [],
    });
  }

  @action
  private setScanError(payload: ScanErrorPayload, clusterId?: string): void {
    const id = clusterId ?? payload.clusterId;
    const state = this._getScanStateForCluster(id);
    this._setScanStateForCluster(id, {
      ...state,
      status: "error",
      lastError: payload,
      message: payload.message,
    });
  }

  @action
  reset(): void {
    const id = this._hostedClusterId;
    if (id) {
      this._scanStateByCluster.set(id, { ...DEFAULT_SCAN_STATE });
    }
  }

  /**
   * Image Upgrade 분석 결과 업데이트.
   */
  @action
  setImageGroups(groups: ImageCveGroup[]): void {
    this.imageGroups = groups;
  }

  @action
  setUpgradeResult(imageRef: string, result: UpgradeAnalysisResult): void {
    this.upgradeResults.set(imageRef, result);
  }

  @action
  setIsImageAnalyzing(v: boolean): void {
    this.isImageAnalyzing = v;
  }

  /**
   * DAIVE HITL Preference 설정 + localStorage 영속
   */
  @action
  setDaiveHitlPreference(pref: DaiveHitlPreference): void {
    this.daiveHitlPreference = pref;
    try {
      window.localStorage.setItem(DAIVE_HITL_PREF_KEY, pref);
    } catch {
      /* ignore */
    }
  }

  // ——————————————————————
  // Remediation History 액션들
  // ——————————————————————

  /**
   * Remediation 이벤트 추가 (최대 200개, 초과 시 오래된 것 제거)
   */
  @action
  addRemediationEvent(event: Omit<RemediationEvent, "id">): RemediationEvent {
    const id = [event.type, event.timestamp, Math.random().toString(36).slice(2, 7)].join("-");
    const fullEvent: RemediationEvent = { ...event, id };
    const clusterId = event.clusterId;
    const existing = this.remediationHistory.get(clusterId) ?? [];
    const next = [fullEvent, ...existing].slice(0, 200);
    this.remediationHistory.set(clusterId, next);
    // sessionStorage 영속
    try {
      sessionStorage.setItem(`skuberplus-remediation-history-${clusterId}`, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    return fullEvent;
  }

  /**
   * 특정 클러스터 이력 조회 (최신 순)
   */
  getRemediationHistory(clusterId: string): RemediationEvent[] {
    // 메모리에 없으면 sessionStorage에서 복원
    if (!this.remediationHistory.has(clusterId)) {
      try {
        const raw = sessionStorage.getItem(`skuberplus-remediation-history-${clusterId}`);
        if (raw) {
          const parsed = JSON.parse(raw) as RemediationEvent[];
          if (Array.isArray(parsed)) {
            this.remediationHistory.set(clusterId, parsed);
          }
        }
      } catch {
        /* ignore */
      }
    }
    return this.remediationHistory.get(clusterId) ?? [];
  }

  /**
   * 특정 클러스터 이력 전체 삭제
   */
  @action
  clearRemediationHistory(clusterId: string): void {
    this.remediationHistory.delete(clusterId);
    try {
      sessionStorage.removeItem(`skuberplus-remediation-history-${clusterId}`);
    } catch {
      /* ignore */
    }
  }
}
