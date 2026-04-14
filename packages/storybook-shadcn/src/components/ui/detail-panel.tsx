/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: 우측 슬라이드 Detail Panel 공통 컴포넌트
 *
 * @remarks
 * - CommonTable 템플릿의 Detail Panel 패턴 추출 (line 428-665)
 * - 슬라이드 애니메이션 (animate-in/animate-out)
 * - 헤더/콘텐츠/푸터 레이아웃 제공
 * - children으로 콘텐츠 커스터마이징 가능
 *
 * 📝 주의사항:
 * - KubeDataTable처럼 레이아웃만 제공하는 범용 컴포넌트
 * - 콘텐츠는 children으로 자유롭게 구성 (차트, 표, 에디터 등)
 * - isOpen과 onClose는 부모 컴포넌트에서 관리
 *
 * 🔄 변경이력:
 * - 2025-10-31: 초기 생성 (CommonTable Detail Panel 패턴 기반)
 * - 2026-01-27: QuickActions 추가 + ActionsMenu 위험 액션만 표시 (UX 개선)
 */

import { ChevronsRight } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Button } from "./button";
import { DetailPanelActionsMenu, type MinimalKubeObject } from "./detail-panel-actions-menu";
import { DetailPanelQuickActions } from "./detail-panel-quick-actions";

/**
 * 🎯 목적: DetailPanel 컴포넌트 Props 인터페이스
 */
export interface DetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 패널 닫기 콜백
   */
  onClose: () => void;

  /**
   * 패널 제목 (메인 타이틀)
   */
  title: string;

  /**
   * 패널 부제목 (선택사항, 예: "Namespace: default")
   */
  subtitle?: string;

  /**
   * Kubernetes 리소스 객체 (선택사항, 액션 메뉴 표시용)
   * - 제공 시 헤더 우측에 ⋮ 액션 메뉴 자동 표시
   * - kind에 따라 Edit, Delete, Shell, Logs, Attach 메뉴 표시
   */
  object?: MinimalKubeObject;

  /**
   * 헤더 우측 커스텀 액션 버튼들 (선택사항, 예: 메뉴 버튼)
   * - object prop과 함께 사용 가능 (액션 메뉴 + 커스텀 버튼)
   */
  headerActions?: React.ReactNode;

  /**
   * Edit 액션 핸들러 (YAML 편집)
   */
  onEdit?: () => void;

  /**
   * Delete 액션 핸들러 (리소스 삭제)
   */
  onDelete?: () => void;

  /**
   * Force Delete 액션 핸들러 (Pod 강제 삭제, Pod만)
   */
  onForceDelete?: () => void;

  /**
   * Force Finalize 액션 핸들러 (Finalizer 제거, 모든 리소스)
   */
  onForceFinalize?: () => void;

  /**
   * Restart 액션 핸들러 (Deployment, DaemonSet, StatefulSet만)
   */
  onRestart?: () => void;

  /**
   * Scale 액션 핸들러 (Deployment, StatefulSet, ReplicaSet만)
   */
  onScale?: () => void;

  /**
   * Shell 액션 핸들러 (Pod 셸 열기, Pod만)
   */
  onShell?: () => void;

  /**
   * Logs 액션 핸들러 (Pod 로그 보기, Pod만)
   */
  onLogs?: () => void;

  /**
   * Logs (New Window) 액션 핸들러 (dock 탭 없이 독립 창으로 로그 열기, Pod만)
   */
  onLogsNewWindow?: () => void;

  /**
   * Attach 액션 핸들러 (Pod에 연결, Pod만)
   */
  onAttach?: () => void;

  /**
   * Set as Default 액션 핸들러 (Cluster를 기본값으로 설정, Cluster만)
   */
  onSetDefault?: () => void;

  /**
   * Kubeconfig File 액션 핸들러 (Kubeconfig 파일 보기/다운로드, Cluster만)
   */
  onKubeconfig?: () => void;

  /**
   * Trigger 액션 핸들러 (Job/CronJob 수동 트리거, Job/CronJob만)
   */
  onTrigger?: () => void;

  /**
   * Upgrade 액션 핸들러 (Helm Release 업그레이드, Helm Release만)
   */
  onUpgrade?: () => void;

  /**
   * Suspend 액션 핸들러 (CronJob 일시 중지, CronJob만)
   */
  onSuspend?: () => void;

  /**
   * Cordon 액션 핸들러 (Node 스케줄링 중지, Node만)
   */
  onCordon?: () => void;

  /**
   * Uncordon 액션 핸들러 (Node 스케줄링 재개, Node만)
   */
  onUncordon?: () => void;

  /**
   * Drain 액션 핸들러 (Node Pod 제거, Node만)
   */
  onDrain?: () => void;

  /**
   * Rollback 액션 핸들러 (Helm Release 롤백, Helm Release만)
   */
  onRollback?: () => void;

  /**
   * 패널 콘텐츠 (테이블, 차트, 폼 등 자유롭게 구성)
   */
  children: React.ReactNode;

  /**
   * 푸터 영역 커스텀 버튼들 (선택사항, 기본 푸터 제공)
   */
  footer?: React.ReactNode;

  /**
   * 메트릭 컴포넌트 (선택사항, DI로 주입됨)
   * - children 위에 표시되는 메트릭 차트 영역
   * - Pod, Deployment 등 리소스별 메트릭 컴포넌트
   */
  metricsComponent?: React.ReactNode;

  /**
   * 패널 너비 CSS 클래스 (기본값: "w-full md:w-[700px]")
   */
  width?: string;

  /**
   * 추가 CSS 클래스
   */
  className?: string;
}

/**
 * 🎯 목적: 우측 슬라이드 Detail Panel 컴포넌트
 *
 * @param props - DetailPanelProps
 * @returns 슬라이드 패널 UI
 *
 * 📝 사용 예시:
 * ```typescript
 * <DetailPanel
 *   isOpen={isOpen}
 *   onClose={onClose}
 *   title="Pod Details"
 *   subtitle="Namespace: default"
 * >
 *   <Table>...</Table>
 * </DetailPanel>
 * ```
 */
export function DetailPanel({
  isOpen,
  onClose,
  title,
  subtitle,
  object,
  headerActions,
  onEdit,
  onDelete,
  onForceDelete,
  onForceFinalize,
  onRestart,
  onScale,
  onShell,
  onLogs,
  onLogsNewWindow,
  onAttach,
  onSetDefault,
  onKubeconfig,
  onTrigger,
  onUpgrade,
  onSuspend,
  onCordon,
  onUncordon,
  onDrain,
  onRollback,
  children,
  footer,
  metricsComponent,
  width = "w-full md:w-[700px]",
  className = "",
}: DetailPanelProps) {
  // 🎯 애니메이션 상태 관리 (슬라이드 아웃 시 필요)
  const [isAnimating, setIsAnimating] = useState(false);

  // 🔄 패널 닫기 핸들러 (애니메이션 적용)
  const handleClose = () => {
    setIsAnimating(true);

    // 300ms 애니메이션 완료 후 실제로 닫기
    setTimeout(() => {
      setIsAnimating(false);
      onClose();
    }, 300);
  };

  // 🔄 ESC 키 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  // 🔄 패널 열림/닫힘 상태 변경 시 애니메이션 리셋
  useEffect(() => {
    if (!isOpen) {
      setIsAnimating(false);
    }
  }, [isOpen]);

  // ⚠️ 패널이 닫혀있고 애니메이션도 안 하고 있으면 렌더링하지 않음
  if (!isOpen && !isAnimating) {
    return null;
  }

  return (
    <>
      {/* 🎨 Overlay - 배경 클릭 시 패널 닫기 */}
      <div className="fixed inset-0 bg-black/20 z-30" onClick={handleClose} />

      {/* 🎨 우측 슬라이드 패널 - CommonTable 스타일 */}
      <div
        className={`bg-card fixed inset-y-0 right-0 z-50 flex h-full flex-col border-l shadow-lg transition ease-in-out ${width} ${
          isAnimating
            ? "animate-out slide-out-to-right duration-300"
            : "animate-in slide-in-from-right duration-[400ms]"
        } ${className}`}
      >
        {/* ============================================ */}
        {/* 🎯 고정 헤더 영역 */}
        {/* ============================================ */}
        <div className="flex-shrink-0 p-5 pb-0">
          <div className="space-y-3">
            {/* 닫기 버튼 및 커스텀 액션 */}
            <div className="flex items-center justify-between">
              <Button variant="secondary" size="icon-sm" onClick={handleClose}>
                <ChevronsRight className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                {/* 🎯 Quick Actions (자주 쓰는 액션을 아이콘 버튼으로 노출) */}
                {object && (
                  <DetailPanelQuickActions
                    object={object}
                    onEdit={onEdit}
                    onRestart={onRestart}
                    onScale={onScale}
                    onShell={onShell}
                    onLogs={onLogs}
                    onLogsNewWindow={onLogsNewWindow}
                    onAttach={onAttach}
                    onSetDefault={onSetDefault}
                    onKubeconfig={onKubeconfig}
                    onTrigger={onTrigger}
                    onUpgrade={onUpgrade}
                    onSuspend={onSuspend}
                    onRollback={onRollback}
                  />
                )}
                {/* 🎯 액션 메뉴 (위험한 액션만 드롭다운에 유지) */}
                {object && (
                  <DetailPanelActionsMenu
                    object={object}
                    onDelete={onDelete}
                    onForceDelete={onForceDelete}
                    onForceFinalize={onForceFinalize}
                    onCordon={onCordon}
                    onUncordon={onUncordon}
                    onDrain={onDrain}
                  />
                )}
                {headerActions}
              </div>
            </div>

            {/* 제목 및 부제목 */}
            <div className="flex flex-col gap-1">
              {subtitle && <span className="text-muted-foreground text-sm leading-5">{subtitle}</span>}
              <h2 className="text-lg font-semibold">{title}</h2>
            </div>
          </div>
        </div>

        {/* ============================================ */}
        {/* 📋 스크롤 가능한 콘텐츠 영역 */}
        {/* ============================================ */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {/* 🎯 메트릭 차트 (있을 경우 children 위에 표시) */}
          {metricsComponent && <div className="mb-4">{metricsComponent}</div>}

          {children}
        </div>

        {/* ============================================ */}
        {/* 🔘 고정 푸터 영역 (선택사항) */}
        {/* ============================================ */}
        {footer && (
          <div className="bg-card flex-shrink-0 p-4">
            <div className="flex justify-end gap-2">{footer}</div>
          </div>
        )}
      </div>
    </>
  );
}
