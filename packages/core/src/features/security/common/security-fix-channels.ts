/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Purpose: Security Fix IPC channel constants and payload type definitions
 * [A-3]: Snapshot & Rollback IPC channels
 *
 * Channel design:
 * - RequestChannel (getRequestChannel): Renderer → Main request/response (invoke/handle)
 * - MessageChannel (getMessageChannel): Main → Renderer unidirectional push (sendMessageToChannel)
 *
 * Naming convention: `security:fix:<action>`
 *
 * @packageDocumentation
 */

import { getMessageChannel, getRequestChannel } from "@skuberplus/messaging";

// ============================================
// Shared types
// ============================================

/** Reference to a single Kubernetes resource that was patched */
export interface FixResourceRef {
  kind: string;
  name: string;
  namespace: string;
  /** Session that produced this fix */
  fixSessionId: string;
}

// ============================================
// Rollback channel — Renderer → Main
// ============================================

/**
 * Rollback scope:
 * - single: Rollback a single resource (resourceRef required)
 * - namespace: Rollback all resources in the given namespace within the session
 * - session: Rollback everything in the fix session
 */
export type RollbackScope = "single" | "namespace" | "session";

/** `securityFixRollbackChannel` request payload */
export interface RollbackRequest {
  fixSessionId: string;
  clusterId: string;
  scope: RollbackScope;
  /** Required when scope === "single" */
  resourceRef?: Omit<FixResourceRef, "fixSessionId">;
  /** Required when scope === "namespace" */
  namespace?: string;
}

/** `securityFixRollbackChannel` response payload */
export interface RollbackResponse {
  success: boolean;
  /** Number of resources successfully rolled back */
  rolledBack: number;
  /** Per-resource error messages */
  errors: string[];
}

export const securityFixRollbackChannel = getRequestChannel<RollbackRequest, RollbackResponse>("security:fix:rollback");

// ============================================
// Pod watch channel — Main → Renderer (push)
// ============================================

/** Pod health status after applying a fix */
export type PodWatchStatus = "healthy" | "crash-loop" | "oomkilled" | "rollback-triggered" | "watch-timeout";

/** `securityFixPodWatchChannel` push payload */
export interface PodWatchPayload {
  fixSessionId: string;
  resourceRef: FixResourceRef;
  status: PodWatchStatus;
  /** Human-readable message (e.g. container name that crashed) */
  message?: string;
}

export const securityFixPodWatchChannel = getMessageChannel<PodWatchPayload>("security:fix:pod-watch");

// ============================================
// Save Snapshot channel — Renderer → Main
// ============================================

/** Resource reference for snapshot (no fixSessionId needed from caller) */
export interface SnapshotResourceRef {
  kind: string;
  name: string;
  namespace: string;
}

/** `securityFixSaveSnapshotChannel` request payload */
export interface SaveSnapshotRequest {
  fixSessionId: string;
  clusterId: string;
  resources: SnapshotResourceRef[];
}

/** `securityFixSaveSnapshotChannel` response payload */
export interface SaveSnapshotResponse {
  saved: number;
  skipped: number;
}

export const securityFixSaveSnapshotChannel = getRequestChannel<SaveSnapshotRequest, SaveSnapshotResponse>(
  "security:fix:save-snapshot",
);

// ============================================
// Watch CrashLoop channel — Renderer → Main
// ============================================

/** `securityFixWatchCrashLoopChannel` request payload */
export interface WatchCrashLoopRequest {
  fixSessionId: string;
  clusterId: string;
  resources: SnapshotResourceRef[];
}

/** `securityFixWatchCrashLoopChannel` response payload */
export interface WatchCrashLoopResponse {
  watching: boolean;
}

export const securityFixWatchCrashLoopChannel = getRequestChannel<WatchCrashLoopRequest, WatchCrashLoopResponse>(
  "security:fix:watch-crash-loop",
);

// ============================================
// Pod Status Poll channel — Renderer → Main
// ============================================

/** Individual pod status from kubectl get pods */
export interface PodStatusItem {
  name: string;
  namespace: string;
  ready: string; // "2/2", "1/2", "0/1" etc.
  status: string; // "Running", "CrashLoopBackOff", "OOMKilled", "Pending", etc.
  restarts: number;
  age: string;
}

/** Aggregated pod health categories */
export interface PodStatusSummary {
  total: number;
  ready: number;
  notReady: number;
  crashLoop: number;
  pending: number;
  unknown: number;
}

/** `securityPodStatusPollChannel` request payload */
export interface PodStatusPollRequest {
  clusterId: string;
  namespaces: string[];
  /** Label selector (e.g. "app=nginx") — optional */
  labelSelector?: string;
}

/** `securityPodStatusPollChannel` response payload */
export interface PodStatusPollResponse {
  pods: PodStatusItem[];
  summary: PodStatusSummary;
  /** ISO timestamp of when the data was fetched */
  fetchedAt: string;
  /** Error message if kubectl failed */
  error?: string;
}

export const securityPodStatusPollChannel = getRequestChannel<PodStatusPollRequest, PodStatusPollResponse>(
  "security:fix:pod-status-poll",
);

// ============================================
// Rollback Log Collection channel — Renderer → Main
// ============================================

/** kubectl logs + events 수집 요청 */
export interface RollbackLogRequest {
  clusterId: string;
  /** 롤백된 리소스 namespace 목록 */
  namespaces: string[];
  /** kubectl logs --tail 줄 수 (기본 50) */
  logTailLines?: number;
}

/** 파드별 로그 스냅샷 */
export interface PodLogSnapshot {
  podName: string;
  namespace: string;
  /** 수집된 로그 (tail) */
  logs: string;
  /** kubectl get events 출력 */
  events: string;
  /** 로그 수집 에러 (있으면) */
  error?: string;
}

/** `securityRollbackLogChannel` 응답 */
export interface RollbackLogResponse {
  snapshots: PodLogSnapshot[];
  /** ISO timestamp */
  collectedAt: string;
  error?: string;
}

export const securityRollbackLogChannel = getRequestChannel<RollbackLogRequest, RollbackLogResponse>(
  "security:fix:rollback-log",
);
