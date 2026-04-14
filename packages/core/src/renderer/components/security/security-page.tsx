/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 *  Purpose: Security dashboard main page
 * SecurityPage component assembly
 * Layout refactor, scan bar removal,
 *   score click navigation, scan state UI
 *
 * Layout:
 * ┌──────────────────────────┬──────────────────────────┐
 * │ [ScoreCard               │ [RbacPanel]              │
 * │  + ComplianceOverview]   ├──────────────────────────┤
 * │                          │ [CveChart]               │
 * ├──────────────────────────┴──────────────────────────┤
 * │ [FindingsTable + filter/sort]                       │
 * └─────────────────────────────────────────────────────┘
 *
 * Scan states:
 * - idle/cancelled: EmptyState centered
 * - scanning: Scanning overlay (no cards)
 * - complete: Full layout above
 *
 * @packageDocumentation
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Button } from "@skuberplus/storybook-shadcn/src/components/ui/button";
import { observer } from "mobx-react-lite";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnySecurityFinding, FindingType, ScannerSource, Severity } from "../../../common/security/security-finding";
import { calculateSecurityScore, calculateWeightedOverallScore } from "../../../common/security/security-score";
import {
  type DaiveFixFindingSummary,
  toFixFindingSummaries,
} from "../../../features/security/common/daive-fix-channel";
import securityScanStoreInjectable from "../../../features/security/renderer/security-scan-store.injectable";
import activeKubernetesClusterInjectable from "../../cluster-frame-context/active-kubernetes-cluster.injectable";
import aiChatPanelStoreInjectable from "../ai-chat/ai-chat-panel-store.injectable";
import { AiFixModal } from "./ai-fix-modal";
import { ConfirmScanDialog } from "./confirm-scan-dialog";
import { buildReviewResultsContext } from "./daive-finding-context";
import { SecurityCveChart } from "./security-cve-chart";
import { SecurityEmptyState } from "./security-empty-state";
import { SecurityFindingsTable } from "./security-findings-table";
import { SecurityRbacPanel } from "./security-rbac-panel";
import { SecurityScoreCard } from "./security-score-card";

import type { DaiveGroup } from "./daive-group-types";
import "./security-agent-stream-listener.injectable";
import dockStoreInjectable from "../dock/dock/store.injectable";

import type { IComputedValue } from "mobx";

import type { KubernetesCluster } from "../../../common/catalog-entities";
import type { SecurityScanStore } from "../../../features/security/renderer/security-scan-store";
import type { AIChatPanelStore } from "../ai-chat/ai-chat-panel-store";
import type { DockStore } from "../dock/dock/store";

// ============================================
//  Dependencies
// ============================================

interface Dependencies {
  store: SecurityScanStore;
  activeCluster: IComputedValue<KubernetesCluster | null>;
  aiChatPanelStore: AIChatPanelStore;
  dockStore: DockStore;
}

// ============================================
//  SecurityPage (non-injected)
// ============================================

const NonInjectedSecurityPage: React.FC<Dependencies> = observer(
  ({ store, activeCluster, aiChatPanelStore, dockStore }) => {
    const cluster = activeCluster.get();
    const clusterId = cluster?.getId() ?? null;
    const contextName = cluster?.spec?.kubeconfigContext ?? null;
    const kubeconfigPath = cluster?.spec?.kubeconfigPath ?? null;

    const status = store.scanState.status;
    const rawFindings = store.getFindingsForCluster(clusterId ?? "");

    const findings = rawFindings;

    const hasScanResults = (status === "complete" || status === "error") && findings.length > 0;

    // 스캔 결과 오래됨 감지 (7일 기준)
    const STALE_SCAN_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
    const [staleScanDismissed, setStaleScanDismissed] = React.useState(false);
    const isScanStale = React.useMemo(() => {
      const scannedAt = store.scanState.scannedAt;
      if (!scannedAt || !hasScanResults) return false;
      return Date.now() - new Date(scannedAt).getTime() > STALE_SCAN_THRESHOLD_MS;
    }, [store.scanState.scannedAt, hasScanResults]);

    const platformScore = useMemo(
      () =>
        hasScanResults ? calculateSecurityScore(findings.filter((f) => f.source === ScannerSource.Kubescape)) : null,
      [hasScanResults, findings],
    );

    const workloadScore = useMemo(
      () => (hasScanResults ? calculateSecurityScore(findings.filter((f) => f.source === ScannerSource.Trivy)) : null),
      [hasScanResults, findings],
    );

    const workloadTimedOut = store.scanState.timedOutScanners.includes("trivy");
    // timedOutNamespaces is now isolated per cluster
    const timedOutNamespaces = clusterId ? store.getTimedOutNamespacesForCluster(clusterId) : [];
    const score = useMemo(
      () => (hasScanResults ? calculateWeightedOverallScore(platformScore, workloadScore, workloadTimedOut) : null),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [hasScanResults, platformScore, workloadScore, workloadTimedOut],
    );

    // Filter sync state
    const [tableResourceSearch, setTableResourceSearch] = useState<string>("");
    const [tableTypeFilter, setTableTypeFilter] = useState<FindingType | "all">("all");
    const [tableSeverityFilter, setTableSeverityFilter] = useState<Severity | undefined>(undefined);

    // Refs for scroll navigation
    const findingsTableRef = useRef<HTMLDivElement>(null);
    const rbacPanelRef = useRef<HTMLDivElement>(null);
    const cveChartRef = useRef<HTMLDivElement>(null);

    // AI Fix state
    const [aiFindingsToFix, setAiFindingsToFix] = useState<DaiveFixFindingSummary[]>([]);
    const [isAiFixModalOpen, setIsAiFixModalOpen] = useState(false);
    const [isAiFixConfirmOpen, setIsAiFixConfirmOpen] = useState(false);
    const pendingFixFindingsRef = React.useRef<AnySecurityFinding[]>([]);
    // AI Assistant 모달 포털 타겟 — SecurityPage의 relative wrapper div
    // callback ref로 첫 렌더 후 null 없이 확정
    const [modalPortalTarget, setModalPortalTarget] = React.useState<HTMLDivElement | null>(null);

    const handleAiFix = (findings: AnySecurityFinding[]) => {
      pendingFixFindingsRef.current = findings;
      setIsAiFixConfirmOpen(true);
    };

    // ── Ask DAIVE 그룹 채팅 ──────────────────────────────────────────
    const prevGroupIdForChatRef = React.useRef<string | null>(null);

    /**
     * "Ask DAIVE about this group" 클릭 핸들러.
     * 그룹 전환 시 이전 그룹의 채팅 기록을 저장하고 새 그룹의 기록을 복구 또는 새 채팅 시작.
     */
    const handleGroupAskDaive = React.useCallback(
      async (groupId: string, contextPrompt: string) => {
        // Root Frame IPC: DAIVE 패널 열기 + 그룹별 세션 관리 + 메시지 전송
        const { ipcRenderer } = await import("electron");
        const { panelSyncChannels } = await import("../../../common/ipc/panel-sync");
        ipcRenderer.send(panelSyncChannels.toggleAiChat, { message: contextPrompt, groupId });

        // 터미널도 오픈
        if (!dockStore.isOpen) dockStore.open();

        prevGroupIdForChatRef.current = groupId;
      },
      [dockStore],
    );

    /**
     * "Review Results" 버튼 핸들러.
     * 1. AI Assistant 모달 닫기
     * 2. DAIVE 채팅 세션 초기화
     * 3. 취약점 현황 보고서 프롬프트 자동 전송
     * 4. DAIVE 패널 오픈
     */
    const handleReviewResults = React.useCallback(
      async (groups: DaiveGroup[]) => {
        // 모달은 닫지 않음 — Results 뷰로 전환됨 (
        // DAIVE 패널에 리포트 자동 생성 요청
        const systemContext = buildReviewResultsContext(groups, aiFindingsToFix.length);
        const userMessage = `Generate the security remediation report for this session.\n\n${systemContext}`;

        const { ipcRenderer: ipc } = await import("electron");
        const { panelSyncChannels: psc } = await import("../../../common/ipc/panel-sync");
        ipc.send(psc.toggleAiChat, { message: userMessage });

        prevGroupIdForChatRef.current = null;
      },
      [aiFindingsToFix],
    );

    /**
     * AI Assistant 모달 열기.
     * findings를 DaiveFixFindingSummary[]로 변환 후 모달에 전달.
     */
    const handleAiFixConfirm = () => {
      setIsAiFixConfirmOpen(false);
      const findings = pendingFixFindingsRef.current;
      const targetFindings = findings.length > 0 ? findings : rawFindings;
      setAiFindingsToFix(toFixFindingSummaries(targetFindings));
      setIsAiFixModalOpen(true);
    };

    // Highlight state
    const [rbacHighlight, setRbacHighlight] = useState(false);
    const [cveHighlight, setCveHighlight] = useState(false);

    // Generic smooth scroll helper
    const scrollToRef = useCallback((ref: React.RefObject<HTMLDivElement>) => {
      const el = ref.current;
      if (!el) return;
      const scrollParent = (() => {
        let p = el.parentElement;
        while (p) {
          const { overflow, overflowY } = window.getComputedStyle(p);
          if (/auto|scroll/.test(overflow + overflowY)) return p;
          p = p.parentElement;
        }
        return document.documentElement;
      })();
      const offset = el.getBoundingClientRect().top - scrollParent.getBoundingClientRect().top + scrollParent.scrollTop;
      scrollParent.scrollTo({ top: offset - 16, behavior: "smooth" });
    }, []);

    const handleScrollToTable = useCallback(() => {
      scrollToRef(findingsTableRef);
    }, [scrollToRef]);

    // Platform score click → scroll to RBAC + highlight
    const handlePlatformScoreClick = useCallback(() => {
      scrollToRef(rbacPanelRef);
      setRbacHighlight(true);
      setTimeout(() => setRbacHighlight(false), 1000);
    }, [scrollToRef]);

    // Workload score click → scroll to CVE chart + highlight
    const handleWorkloadScoreClick = useCallback(() => {
      scrollToRef(cveChartRef);
      setCveHighlight(true);
      setTimeout(() => setCveHighlight(false), 1000);
    }, [scrollToRef]);

    const handleResourceClick = useCallback(
      (resourceName: string, type?: FindingType) => {
        setTableResourceSearch((prev) => (prev === resourceName ? "" : resourceName));
        if (type) setTableTypeFilter(type);
        if (resourceName) handleScrollToTable();
      },
      [handleScrollToTable],
    );

    const handleComplianceTypeClick = useCallback(
      (type: FindingType | null) => {
        const resolved = type ?? "all";
        setTableTypeFilter((prev) => (prev === resolved ? "all" : resolved));
        handleScrollToTable();
      },
      [handleScrollToTable],
    );

    const handleSeverityClick = useCallback(
      (severity: Severity) => {
        setTableSeverityFilter((prev) => (prev === severity ? undefined : severity));
        handleScrollToTable();
      },
      [handleScrollToTable],
    );

    // Re-scan only timed-out namespaces
    // ScoreCard handles the confirm dialog internally (dialogCase="timeout");
    // this callback is invoked after user confirms in the dialog.
    const handleRetryNamespaces = useCallback(() => {
      const timedOutNs = clusterId ? store.getTimedOutNamespacesForCluster(clusterId) : [];
      if (!timedOutNs || timedOutNs.length === 0 || !clusterId || !contextName || !kubeconfigPath) return;
      store.startScan({
        clusterId,
        contextName,
        kubeconfigPath,
        scanner: "trivy",
        retryNamespaces: [...timedOutNs],
      });
    }, [store, clusterId, contextName, kubeconfigPath]);

    // Full rescan
    const handleRescan = useCallback(() => {
      if (!clusterId || !contextName || !kubeconfigPath) return;
      store.startScan({ clusterId, contextName, kubeconfigPath, scanner: "all", scanMode: "sequential" });
    }, [store, clusterId, contextName, kubeconfigPath]);

    // Inform store which cluster this iframe hosts so scanState is restored from the correct cache
    useEffect(() => {
      if (clusterId) {
        store.hostedClusterId = clusterId;
      }
    }, [store, clusterId]);

    // No cluster selected
    if (!clusterId || !contextName || !kubeconfigPath) {
      return (
        <div className="flex flex-col h-full p-6">
          <SecurityEmptyState variant="no-cluster" />
        </div>
      );
    }

    const isScanning = status === "scanning";
    const isCacheLoading = store.isCacheLoading;
    const isIdle =
      !isCacheLoading &&
      (status === "idle" ||
        (status === "complete" && findings.length === 0) ||
        (status === "error" && findings.length === 0));
    const isError = status === "error";

    return (
      <div ref={setModalPortalTarget} className="relative h-full overflow-hidden">
        {/* 모달 열릴 때 대시보드 딤 오버레이 — 클릭 차단 (비활성화)
        z-[1] → DAIVE 패널(z-50)·모달(z-60) 아래, 대시보드 위 */}
        {isAiFixModalOpen && <div className="absolute inset-0 z-[1] bg-black/35" aria-hidden="true" />}
        {/* Scrollable dashboard — 모달 열릴 때 blur + 클릭 비활성화 */}
        <div
          className={`absolute inset-0 flex flex-col p-4 gap-4 overflow-auto transition-[filter] duration-200 ${isAiFixModalOpen ? "blur-[2px] brightness-90 pointer-events-none" : ""}`}
        >
          {/* === Scan state branches === */}

          {/* State 0: cache loading — show spinner, block Start Scan */}
          {isCacheLoading && !isScanning && (
            <div className="flex flex-col flex-1 items-center justify-center">
              <SecurityEmptyState variant="idle" actionDisabled={true} onStartScan={() => {}} />
            </div>
          )}

          {/* State 1: idle / no findings — centered empty state */}
          {isIdle && !isScanning && (
            <div className="flex flex-col flex-1 items-center justify-center">
              <SecurityEmptyState
                variant={isError ? "error" : "idle"}
                errorMessage={store.scanState.message ?? undefined}
                onStartScan={() =>
                  store.startScan({
                    clusterId,
                    contextName: contextName!,
                    kubeconfigPath,
                    scanner: "all",
                    scanMode: "sequential",
                  })
                }
              />
            </div>
          )}

          {/* State 2: error (with prior findings) */}
          {isError && findings.length > 0 && (
            <SecurityEmptyState
              variant="error"
              errorMessage={store.scanState.message ?? undefined}
              onStartScan={() =>
                store.startScan({
                  clusterId,
                  contextName: contextName!,
                  kubeconfigPath,
                  scanner: "all",
                  scanMode: "sequential",
                })
              }
            />
          )}

          {/* State 3: scanning — overlay with progress, no cards */}
          {isScanning && (
            <div className="flex flex-col flex-1 items-center justify-center gap-4 py-12">
              <div className="flex flex-col items-center gap-3 w-full max-w-sm">
                <span className="text-sm font-medium text-muted-foreground animate-pulse text-center">
                  {store.scanState.message || "Scanning..."}
                  {" · "}
                  {store.scanState.progress}%
                </span>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.min(100, Math.max(0, store.scanState.progress))}%` }}
                    role="progressbar"
                    aria-valuenow={store.scanState.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                {store.scanState.findingsSoFar > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {store.scanState.findingsSoFar} vulnerabilities found so far
                  </span>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  className="mt-2 flex items-center gap-1.5"
                  onClick={() => store.cancelScan()}
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                  Cancel Scan
                </Button>
              </div>
            </div>
          )}

          {/* State 4: complete with findings — full layout */}
          {hasScanResults && (
            <>
              {/* 오래된 스캔 결과 알러트 */}
              {isScanStale && !staleScanDismissed && (
                <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                  <svg
                    className="h-5 w-5 text-amber-400 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-300">Scan results may be outdated</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Last scanned:{" "}
                      {store.scanState.scannedAt
                        ? new Date(store.scanState.scannedAt).toLocaleDateString("en-CA")
                        : "unknown"}
                      . It has been more than 7 days since the last scan. A rescan is recommended.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setStaleScanDismissed(true)}
                    >
                      Dismiss
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-amber-500 text-black hover:bg-amber-400"
                      onClick={() => {
                        setStaleScanDismissed(true);
                        if (clusterId && contextName && kubeconfigPath) {
                          store.startScan({
                            clusterId,
                            contextName,
                            kubeconfigPath,
                            scanner: "all",
                            scanMode: "sequential",
                          });
                        }
                      }}
                    >
                      Rescan Now
                    </Button>
                  </div>
                </div>
              )}
              {/* Main grid: ScoreCard (left) + RBAC/CVE (right) */}
              <div className="grid grid-cols-2 gap-4 items-stretch">
                {/* Left: Security Score + Compliance Overview (inline) */}
                <div className="flex flex-col h-full">
                  <SecurityScoreCard
                    status={status}
                    score={score}
                    platformScore={platformScore}
                    workloadScore={workloadScore}
                    progress={store.scanState.progress}
                    onSeverityClick={handleSeverityClick}
                    timedOutScanners={store.scanState.timedOutScanners}
                    timedOutNamespaces={timedOutNamespaces}
                    onRetryNamespaces={timedOutNamespaces.length > 0 ? handleRetryNamespaces : undefined}
                    onRescan={handleRescan}
                    scannedAt={store.scanState.scannedAt}
                    onPlatformScoreClick={handlePlatformScoreClick}
                    onWorkloadScoreClick={handleWorkloadScoreClick}
                    findings={findings}
                    onComplianceTypeClick={handleComplianceTypeClick}
                    onAiFix={handleAiFix}
                  />
                </div>

                {/* Right: RBAC (top) + CVE (bottom) */}
                <div className="flex flex-col gap-4 h-full">
                  {/* RBAC Risks (ref + highlight) */}
                  <div
                    ref={rbacPanelRef}
                    className={`flex-[1] flex flex-col rounded-lg transition-all duration-700 ease-in-out ${rbacHighlight ? "ring-2 ring-primary ring-offset-1 shadow-lg shadow-primary/20" : "ring-0 ring-transparent shadow-none"}`}
                  >
                    <SecurityRbacPanel status={status} findings={findings} onResourceClick={handleResourceClick} />
                  </div>

                  {/* Trivy Image Scan (ref + highlight) */}
                  <div
                    ref={cveChartRef}
                    className={`flex-[2] flex flex-col rounded-lg transition-all duration-700 ease-in-out ${cveHighlight ? "ring-2 ring-primary ring-offset-1 shadow-lg shadow-primary/20" : "ring-0 ring-transparent shadow-none"}`}
                  >
                    <SecurityCveChart status={status} findings={findings} onResourceClick={handleResourceClick} />
                  </div>
                </div>
              </div>

              {/* Bottom: vulnerability table */}
              <div ref={findingsTableRef} className="flex flex-col" style={{ flex: 1, minHeight: 400 }}>
                <SecurityFindingsTable
                  status={status}
                  findings={findings}
                  externalResourceSearch={tableResourceSearch}
                  externalTypeFilter={tableTypeFilter}
                  externalSeverityFilter={tableSeverityFilter}
                  onScrollRequest={handleScrollToTable}
                  onAiFix={handleAiFix}
                />
              </div>

              {/* AI Assistant 시작 확인 다이얼로그 */}
              <ConfirmScanDialog
                open={isAiFixConfirmOpen}
                title="Open AI Assistant?"
                description={`DAIVE AI Assistant will analyze ${pendingFixFindingsRef.current.length || rawFindings.length} findings and guide you through remediation. All cluster changes require your explicit approval before execution.`}
                confirmLabel="Open AI Assistant"
                onConfirm={handleAiFixConfirm}
                onCancel={() => setIsAiFixConfirmOpen(false)}
              />
            </>
          )}
        </div>
        {/* /scrollable dashboard */}

        {/* AI Assistant modal — absolute inset-0, SecurityPage 영역만 커버 */}
        <AiFixModal
          open={isAiFixModalOpen}
          portalTarget={modalPortalTarget ?? undefined}
          findings={aiFindingsToFix}
          onClose={async () => {
            setIsAiFixModalOpen(false);
            void aiChatPanelStore.setHitlLevelAsync("always_approve");
            void aiChatPanelStore.resetSessionForNewFix();
            // 터미널 최소화
            if (dockStore.isOpen) dockStore.close();
            // AI 채팅 패널 최소화 (Root Frame IPC)
            const { ipcRenderer: ipcClose } = await import("electron");
            const { panelSyncChannels: pscClose } = await import("../../../common/ipc/panel-sync");
            ipcClose.send(pscClose.toggleAiChat, { closePanel: true });
          }}
          onExplainWithAI={async (prompt, groupId) => {
            await handleGroupAskDaive(groupId ?? prompt.slice(0, 64), prompt);
            return aiChatPanelStore.conversationId;
          }}
          onReviewResults={handleReviewResults}
          onRescan={() => {
            if (clusterId && contextName && kubeconfigPath) {
              store.startScan({ clusterId, contextName, kubeconfigPath, scanner: "all", scanMode: "sequential" });
            }
          }}
          onSessionClear={async () => {
            // Root Frame AI 채팅 세션 클리어 IPC
            const { ipcRenderer: ipc } = await import("electron");
            const { panelSyncChannels: psc } = await import("../../../common/ipc/panel-sync");
            ipc.send(psc.toggleAiChat, { clearSessions: true });
          }}
        />
      </div>
    );
  },
);

NonInjectedSecurityPage.displayName = "SecurityPage";

// ============================================
//  withInjectables wrapper
// ============================================

export const SecurityPage = withInjectables<Dependencies>(NonInjectedSecurityPage, {
  getProps: (di) => {
    const activeCluster = di.inject(activeKubernetesClusterInjectable);
    // Inject the store keyed by this cluster's ID — each cluster gets its own isolated store instance
    const clusterId = activeCluster?.get()?.getId() ?? "__no-cluster__";
    return {
      store: di.inject(securityScanStoreInjectable, clusterId),
      activeCluster,
      // DAIVE AI Chat Panel Store — /fix-security 메시지 주입용
      aiChatPanelStore: di.inject(aiChatPanelStoreInjectable),
      // Agent stream event bus
      dockStore: di.inject(dockStoreInjectable),
    };
  },
});
