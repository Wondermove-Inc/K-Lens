/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 *  Purpose: DAIVE AI Assistant 풀스크린 모달
 * 위험도 기반 그룹 사이드바 + Finding 상세 + Ask DAIVE 버튼으로 구성.
 * 관리자가 그룹을 선택하고 DAIVE와 대화하며 취약점을 해결하는 워크플로우.
 *
 * @packageDocumentation
 */

import { Button } from "@skuberplus/storybook-shadcn/src/components/ui/button";
import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DaiveGroupSidebar } from "./DaiveGroupSidebar";
import { buildGroupAssistantContext, classifyIssueOwnership } from "./daive-finding-context";
import { buildDaiveGroups } from "./daive-group-types";

import type { DaiveFixFindingSummary } from "../../../features/security/common/daive-fix-channel";
import type { DaiveGroup, GroupCategory, GroupStatus } from "./daive-group-types";

// ============================================
//  Inline SVG icons (lucide-react 미사용 — Jest 호환)
// ============================================

const XIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ============================================
//  Props
// ============================================

export interface AiFixModalProps {
  open: boolean;
  findings: DaiveFixFindingSummary[];
  onClose: () => void;
  /** Explain with AI — agent-host 경로로 전송, threadId 반환 */
  onExplainWithAI?: (prompt: string, groupId?: string) => Promise<string>;
  /**
   * 포털 타겟 DOM 요소.
   * 제공되면 해당 element 내부에 absolute inset-0으로 렌더링 (SecurityPage 영역만 커버).
   * 미제공 시 document.body에 fixed 포지션으로 fallback.
   */
  portalTarget?: HTMLElement;
  /** "Review Results" 버튼 클릭 콜백 */
  onReviewResults?: (groups: DaiveGroup[]) => void;
  /** Results 단계에서 재스캔 요청 */
  onRescan?: () => void;
  /** 세션 종료 시 AI 채팅 세션 클리어 IPC 전송 */
  onSessionClear?: () => void;
}

// ============================================
//  AiFixModal 컴포넌트
// ============================================

/** 자동 수정 가능한 checkId 집합 (사이드바 뱃지용) */
const AUTO_FIX_CHECK_IDS = new Set(["KSV-0030", "KSV-0104"]);

export const AiFixModal: React.FC<AiFixModalProps> = ({
  open,
  findings,
  onClose,
  onExplainWithAI,
  portalTarget,
  onReviewResults,
  onRescan,
  onSessionClear,
}) => {
  // 모달 모드: "groups" = 그룹 탐색, "results" = 결과 요약
  const [modalMode, setModalMode] = useState<"groups" | "results">("groups");
  const [resultsCategoryOpen, setResultsCategoryOpen] = useState<Record<GroupCategory, boolean>>({
    critical: false,
    warning: false,
    info: false,
  });

  // close confirm dialog
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  // Results 단계 close/rescan 확인 다이얼로그
  const [resultsConfirm, setResultsConfirm] = useState<"close" | "rescan" | null>(null);

  const handleCloseRequest = useCallback(() => {
    setShowCloseConfirm(true);
  }, []);

  const handleCloseConfirm = useCallback(() => {
    setShowCloseConfirm(false);
    onClose();
  }, [onClose]);

  const handleCloseCancelled = useCallback(() => {
    setShowCloseConfirm(false);
  }, []);

  // 그룹 상태 머신
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupStatuses, setGroupStatuses] = useState<Map<string, GroupStatus>>(new Map());

  // ── DaiveGroup 목록 빌드 (findings에서 직접 그룹핑) ────────────────
  const daiveGroups = React.useMemo((): DaiveGroup[] => {
    if (!findings.length) return [];
    // autoFix 판별용 Set (KSV-0030, KSV-0104)
    const autoFixSet = new Set<string>(
      findings.filter((f) => AUTO_FIX_CHECK_IDS.has(f.checkId ?? "")).map((f) => f.checkId ?? ""),
    );
    const groups = buildDaiveGroups(findings, autoFixSet);
    return groups.map((g) => ({
      ...g,
      status: groupStatuses.get(g.groupId) ?? "pending",
    }));
  }, [findings, groupStatuses]);

  const prevChatGroupIdRef = React.useRef<string | null>(null);

  const handleGroupSelect = React.useCallback(async (groupId: string) => {
    setSelectedGroupId(groupId);
    setGroupStatuses((prev) => {
      const next = new Map(prev);
      if (next.get(groupId) === "pending") {
        next.set(groupId, "conversing");
      }
      return next;
    });

    // 다른 그룹 선택 시 DAIVE 패널 닫기 — 채팅과 취약점 그룹의 싱크 불일치 방지
    // "Ask DAIVE about this group" 버튼 클릭 시에만 패널이 다시 열림
    if (prevChatGroupIdRef.current && prevChatGroupIdRef.current !== groupId) {
      const { ipcRenderer: ipc } = await import("electron");
      const { panelSyncChannels: psc } = await import("../../../common/ipc/panel-sync");
      ipc.send(psc.toggleAiChat, { closePanel: true });
    }
  }, []);

  // 모달 오픈 시 전체 리셋 — 모든 상태 초기화
  useEffect(() => {
    if (open) {
      setModalMode("groups");
      setSelectedGroupId(null);
      setGroupStatuses(new Map()); // Reviewed/Applied 카운트 초기화
      prevChatGroupIdRef.current = null;
    }
  }, [open, findings.length]);

  // Root Frame에서 그룹 상태 변경 IPC 수신 (applied/conversing)
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    import("electron").then(({ ipcRenderer }) => {
      import("../../../common/ipc/panel-sync").then(({ panelSyncChannels }) => {
        const handler = (_event: unknown, payload: { groupId: string; status: string }) => {
          if (payload?.groupId && payload?.status) {
            setGroupStatuses((prev) => {
              const next = new Map(prev);
              next.set(payload.groupId, payload.status as any);
              return next;
            });
          }
        };
        ipcRenderer.on(panelSyncChannels.groupStatusChanged, handler as any);
        cleanup = () => ipcRenderer.removeListener(panelSyncChannels.groupStatusChanged, handler as any);
      });
    });
    return () => cleanup?.();
  }, []);

  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCloseRequest();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, handleCloseRequest]);

  if (!open) return null;

  // step 상태 (하위 호환 — 현재 UI에서 직접 사용 안 함)

  // 그룹 상태 통계
  const fixedCount = daiveGroups.filter((g) => g.status === "applied").length;
  const pendingCount = daiveGroups.filter((g) => g.status === "pending").length;
  const selectedGroup = selectedGroupId ? (daiveGroups.find((g) => g.groupId === selectedGroupId) ?? null) : null;

  const modal = (
    <>
      {/* AI Assistant 모달 — SecurityPage 영역 안에 센터링된 floating 패널 */}
      {/* inset-0 컨테이너로 centering, 실제 패널은 고정 크기 */}
      {/* centering 컨테이너: pointer-events-none으로 배경 클릭 통과 → DAIVE·터미널 영향 없음 */}
      <div
        className="absolute inset-0 z-[60] flex items-center justify-center p-6 pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-label="AI Assistant"
      >
        {/* 실제 패널: 90%/85% 기반 — 터미널+AI패널 열려도 잘리지 않음 */}
        <div
          className="pointer-events-auto relative flex flex-col bg-background rounded-xl border border-border shadow-2xl overflow-hidden"
          style={{ width: "min(95%, 860px)", height: "min(92%, 740px)" }}
        >
          {/* ── Header Row 1: 제목 + X ── */}
          <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 text-violet-500 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span className="text-base font-semibold">AI Assistant</span>
              <span className="text-sm text-muted-foreground ml-1">{findings.length} Findings</span>
            </div>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCloseRequest} aria-label="Close">
              <XIcon className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* ── Content Area ── */}
          {modalMode === "results" ? (
            /* ── Results 뷰 ── */
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Row 1: Back to Analysis */}
              <div className="flex items-center px-4 py-1.5 border-b shrink-0">
                <button
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
                  onClick={() => setModalMode("groups")}
                >
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M19 12H5" />
                    <path d="M12 19l-7-7 7-7" />
                  </svg>
                  Back to Analysis
                </button>
              </div>
              {/* Row 2: Stats 박스 */}
              <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
                <span className="text-sm text-muted-foreground font-medium mr-1">Results</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md border text-sm font-semibold bg-muted text-blue-400 border-border">
                  {fixedCount} Applied
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md border text-sm font-semibold bg-muted text-green-400 border-border">
                  {daiveGroups.filter((g) => g.status === "conversing").length} Reviewed
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md border text-sm font-semibold bg-muted text-amber-400 border-border">
                  {pendingCount} Pending
                </span>
              </div>
              {/* 그룹 결과 리스트 — 심각도별 토글 섹션 */}
              <div className="flex-1 overflow-auto">
                {(["critical", "warning", "info"] as GroupCategory[]).map((cat) => {
                  const groups = daiveGroups.filter((g) => g.category === cat);
                  if (groups.length === 0) return null;
                  const catMeta = {
                    critical: { label: "Critical", color: "text-red-400", dotColor: "bg-red-500" },
                    warning: { label: "Warning", color: "text-amber-400", dotColor: "bg-amber-500" },
                    info: { label: "Info", color: "text-emerald-400", dotColor: "bg-emerald-500" },
                  }[cat];
                  const isOpen = resultsCategoryOpen[cat];
                  return (
                    <div key={cat}>
                      <button
                        className="w-full flex items-center gap-2 px-4 py-2 border-b border-border/30 hover:bg-accent/30 cursor-pointer"
                        onClick={() => setResultsCategoryOpen((prev) => ({ ...prev, [cat]: !prev[cat] }))}
                      >
                        <svg
                          className={`w-3 h-3 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                        <span className={`w-2 h-2 rounded-full ${catMeta.dotColor}`} />
                        <span className={`text-sm font-semibold ${catMeta.color}`}>{catMeta.label}</span>
                        <span className="text-sm text-muted-foreground">({groups.length} groups)</span>
                      </button>
                      {isOpen &&
                        groups.map((g) => {
                          const statusLabel =
                            g.status === "applied" ? "Applied" : g.status === "conversing" ? "Reviewed" : "Pending";
                          const dotCls =
                            g.status === "applied"
                              ? "bg-blue-400"
                              : g.status === "conversing"
                                ? "bg-green-400"
                                : "bg-amber-400";
                          const textCls =
                            g.status === "applied"
                              ? "text-blue-400"
                              : g.status === "conversing"
                                ? "text-green-400"
                                : "text-amber-400";
                          return (
                            <div
                              key={g.groupId}
                              className="flex items-center gap-3 px-4 pl-8 py-2.5 border-b border-border/10 hover:bg-accent/40"
                            >
                              <span className={`w-2 h-2 rounded-full shrink-0 ${dotCls}`} />
                              <div className="flex-1 min-w-0 flex items-center gap-2">
                                <span className="text-sm font-mono truncate">{g.label}</span>
                                <span className="text-xs px-1.5 py-0.5 rounded shrink-0 bg-muted text-muted-foreground">
                                  Findings: {g.findings.length}
                                </span>
                              </div>
                              <span className={`text-sm font-medium shrink-0 ${textCls}`}>{statusLabel}</span>
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
              </div>
              {/* Footer: Close(대시보드) + Rescan */}
              <div className="flex items-center justify-between px-4 py-2.5 border-t shrink-0 bg-muted/10">
                <span className="text-sm text-muted-foreground">
                  {daiveGroups.length} groups · DAIVE is generating report
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-sm"
                    onClick={() => setResultsConfirm("close")}
                  >
                    Close
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-sm bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => setResultsConfirm("rescan")}
                    disabled={!onRescan}
                  >
                    Rescan
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* ── Groups 뷰 (기본) ── */
            <div className="flex-1 min-h-0 flex overflow-hidden">
              {/* 좌: GroupSidebar (항상 표시) */}
              <div className="w-[220px] shrink-0 border-r border-border/40 overflow-hidden">
                <DaiveGroupSidebar
                  groups={daiveGroups}
                  selectedGroupId={selectedGroupId}
                  onGroupSelect={handleGroupSelect}
                  totalCount={daiveGroups.length}
                  appliedCount={fixedCount}
                />
              </div>
              {/* 우: 선택된 그룹 Finding 목록 */}
              <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">
                {/* Finding 상세 패널 — 선택된 그룹의 취약점 목록 + Ask DAIVE 버튼 */}
                {selectedGroup && (
                  <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    {/* 그룹 헤더 — 배지 + 그룹명 + finding 수 */}
                    <div className="px-4 py-2.5 border-b shrink-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className={[
                            "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold uppercase",
                            selectedGroup.category === "critical"
                              ? "bg-muted text-red-400"
                              : selectedGroup.category === "warning"
                                ? "bg-muted text-amber-400"
                                : "bg-muted text-blue-400",
                          ].join(" ")}
                        >
                          {selectedGroup.category}
                        </span>
                        <span
                          className={[
                            "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium",
                            selectedGroup.actionType === "image-upgrade"
                              ? "bg-muted text-violet-400"
                              : selectedGroup.actionType === "config-fix"
                                ? "bg-muted text-green-400"
                                : "bg-muted text-zinc-400",
                          ].join(" ")}
                        >
                          {selectedGroup.actionType === "image-upgrade"
                            ? "Image Upgrade"
                            : selectedGroup.actionType === "config-fix"
                              ? "Config Fix"
                              : "Manual Review"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium font-mono truncate" title={selectedGroup.label}>
                          {selectedGroup.label}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {(() => {
                            const ownership = selectedGroup.findings[0]
                              ? classifyIssueOwnership(selectedGroup.findings[0])
                              : "unknown";
                            if (ownership === "unknown") return null;
                            return (
                              <span
                                className={[
                                  "text-[11px] px-1.5 py-0.5 rounded border font-semibold uppercase",
                                  ownership === "ops"
                                    ? "border-purple-500/40 bg-purple-500/10 text-purple-300"
                                    : "border-orange-500/40 bg-orange-500/10 text-orange-300",
                                ].join(" ")}
                              >
                                {ownership}
                              </span>
                            );
                          })()}
                          <span className="text-xs text-muted-foreground">
                            {selectedGroup.findings.length} Findings
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Finding 목록 */}
                    <div className="flex-1 overflow-auto divide-y divide-border/30">
                      {selectedGroup.findings.map((f, i) => {
                        const sev = f.severity?.toUpperCase() ?? "UNKNOWN";
                        const sevColor =
                          sev === "CRITICAL"
                            ? "bg-muted text-red-400"
                            : sev === "HIGH"
                              ? "bg-muted text-orange-400"
                              : sev === "MEDIUM"
                                ? "bg-muted text-amber-400"
                                : sev === "LOW"
                                  ? "bg-muted text-green-400"
                                  : "bg-muted text-zinc-400";
                        // Risk level 배지 (디자인)
                        const riskColor =
                          sev === "CRITICAL" || sev === "HIGH"
                            ? "bg-rose-500/15 text-rose-400 border border-rose-500/25"
                            : "bg-cyan-500/15 text-cyan-400 border border-cyan-500/25";
                        const riskLabel = sev === "CRITICAL" || sev === "HIGH" ? "High Risk" : "Low Risk";
                        return (
                          <div key={i} className="px-4 py-2 hover:bg-accent/40 transition-colors">
                            {/* Row 1: severity + CVE/check ID + risk badge */}
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ${sevColor}`}
                              >
                                {sev}
                              </span>
                              <span className="text-sm font-mono text-muted-foreground">
                                {f.cveId ?? f.checkId ?? ""}
                              </span>
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${riskColor}`}
                              >
                                {riskLabel}
                              </span>
                              {f.cvssScore != null && (
                                <span className="text-xs text-muted-foreground ml-auto">
                                  CVSS {f.cvssScore.toFixed(1)}
                                </span>
                              )}
                            </div>
                            {/* Row 2: title */}
                            <div className="text-sm truncate leading-snug" title={f.title}>
                              {f.title}
                            </div>
                            {/* Row 3: resource */}
                            <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                              {f.resource.kind}/{f.resource.name}
                              {f.resource.namespace ? ` · ${f.resource.namespace}` : ""}
                            </div>
                            {/* Row 4: version info */}
                            {(f.installedVersion || f.fixedVersion) && (
                              <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                                {f.installedVersion && <>Installed: {f.installedVersion}</>}
                                {f.fixedVersion && <span className="text-green-400"> → Fix: {f.fixedVersion}</span>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* Ask DAIVE 버튼 — 콘텐츠 하단 */}
                    <div className="px-4 py-2.5 border-t shrink-0">
                      <Button
                        className="w-full bg-violet-500 hover:bg-violet-500/85 text-white text-sm h-9 gap-1.5"
                        onClick={() => {
                          if (onExplainWithAI) {
                            // 상태를 conversing(Reviewed)으로 확실히 전환
                            setGroupStatuses((prev) => {
                              const next = new Map(prev);
                              if (!next.has(selectedGroup.groupId) || next.get(selectedGroup.groupId) === "pending") {
                                next.set(selectedGroup.groupId, "conversing");
                              }
                              return next;
                            });
                            const ctx = buildGroupAssistantContext(selectedGroup);
                            void onExplainWithAI(ctx, selectedGroup.groupId);
                            // DAIVE 패널과 연결된 그룹 ID 추적
                            prevChatGroupIdRef.current = selectedGroup.groupId;
                          }
                        }}
                        disabled={!onExplainWithAI}
                      >
                        <svg
                          className="w-3.5 h-3.5 shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        Ask DAIVE about this group
                      </Button>
                    </div>
                  </div>
                )}

                {/* 그룹 미선택 Empty State */}
                {!selectedGroupId &&
                  (() => {
                    return (
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-center text-muted-foreground">
                          <svg
                            className="w-8 h-8 mx-auto mb-2 opacity-30"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
                          <div className="text-sm font-medium mb-1">Select a vulnerability group</div>
                          <div className="text-sm text-muted-foreground">
                            Choose a group from the list to view findings and ask DAIVE
                          </div>
                        </div>
                      </div>
                    );
                  })()}
              </div>
            </div>
          )}
          {/* /Groups 뷰 or Results 뷰 */}
          {/* ── Footer: Review Results (groups 모드에서만) ── */}
          {modalMode === "groups" && (
            <div className="flex items-center justify-between px-4 py-2 border-t shrink-0 bg-muted/10">
              <span className="text-xs text-muted-foreground">{pendingCount} pending</span>
              <Button
                size="sm"
                className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90 gap-1"
                onClick={() => {
                  setModalMode("results");
                  onReviewResults?.(daiveGroups);
                }}
                disabled={!onReviewResults}
              >
                Review Results
              </Button>
            </div>
          )}
        </div>
        {/* /floating panel */}
      </div>
      {/* /centering container */}
    </>
  );

  const closeConfirmDialog = showCloseConfirm ? (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Reset in Progress"
    >
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={handleCloseCancelled} />
      <div className="relative z-10 w-full max-w-sm mx-4 bg-background rounded-xl shadow-2xl border overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="text-sm font-semibold">Reset in Progress</h2>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            All AI remediation progress will be lost. Are you sure you want to close?
          </p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 bg-muted/10 border-t">
          <Button variant="outline" size="sm" onClick={handleCloseCancelled}>
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            onClick={handleCloseConfirm}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  const resultsConfirmDialog = resultsConfirm ? (
    <div
      className="absolute inset-0 z-[70] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={resultsConfirm === "close" ? "Close AI Assistant" : "Start New Scan"}
    >
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" onClick={() => setResultsConfirm(null)} />
      <div className="relative z-10 w-full max-w-sm mx-4 bg-background rounded-xl shadow-2xl border overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="text-sm font-semibold">
            {resultsConfirm === "close" ? "Close AI Assistant" : "Start New Scan"}
          </h2>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {resultsConfirm === "close"
              ? "All AI chat sessions will be cleared and you will return to the dashboard."
              : "All AI chat sessions will be cleared and a new security scan will start."}
          </p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 bg-muted/10 border-t">
          <Button variant="outline" size="sm" onClick={() => setResultsConfirm(null)}>
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            className={
              resultsConfirm === "rescan"
                ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            }
            onClick={() => {
              onSessionClear?.();
              if (resultsConfirm === "rescan") onRescan?.();
              setResultsConfirm(null);
              onClose();
            }}
          >
            {resultsConfirm === "close" ? "Close" : "Rescan"}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  // portalTarget = SecurityPage의 relative wrapper div
  // → modal은 SecurityPage 영역(사이드바·DAIVE패널 제외)에만 absolute inset-0으로 렌더링
  // closeConfirmDialog는 모든 것 위에 올려야 하므로 항상 document.body로 portal
  const target = portalTarget ?? document.body;
  return (
    <>
      {createPortal(modal, target)}
      {showCloseConfirm && createPortal(closeConfirmDialog, document.body)}
      {resultsConfirm && createPortal(resultsConfirmDialog, portalTarget ?? document.body)}
    </>
  );
};
