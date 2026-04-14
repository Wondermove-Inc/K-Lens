/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: DetailPanel 헤더 우측 Quick Action 버튼들 (아이콘 + 툴팁)
 *
 * @remarks
 * - 자주 사용하는 액션을 아이콘 버튼으로 노출
 * - 마우스오버 시 툴팁으로 액션 이름 표시
 * - 위험한 액션(Delete, Force Delete 등)은 제외 (DroplownMenu에서 처리)
 * - kind 기반 조건부 메뉴 표시
 *
 * 📝 주의사항:
 * - KubeObject를 props로 받아 kind 확인
 * - 액션 핸들러는 외부에서 주입 (props)
 * - ShadCN Tooltip 컴포넌트 사용
 *
 * 🔄 변경이력:
 * - 2026-01-27: 초기 생성 (액션 버튼 UX 개선)
 */

import { Button } from "@skuberplus/storybook-shadcn";
import {
  ArrowUpToLine,
  Box,
  Edit,
  ExternalLink,
  File,
  FileText,
  History,
  Link,
  Maximize,
  OctagonPause,
  Play,
  RotateCw,
  Terminal,
} from "lucide-react";
import React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../shadcn-ui/tooltip";

import type { LucideIcon } from "lucide-react";

import type { MinimalKubeObject } from "./detail-panel-actions-menu";

/**
 * 🎯 목적: Quick Action 설정 인터페이스
 */
interface QuickActionConfig {
  key: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}

/**
 * 🎯 목적: DetailPanelQuickActions 컴포넌트 Props 인터페이스
 */
export interface DetailPanelQuickActionsProps {
  /**
   * Kubernetes 리소스 객체 (kind 확인용)
   */
  object: MinimalKubeObject;

  /**
   * Edit 액션 핸들러 (YAML 편집)
   */
  onEdit?: () => void;

  /**
   * Restart 액션 핸들러 (Deployment, DaemonSet, StatefulSet만)
   */
  onRestart?: () => void;

  /**
   * Scale 액션 핸들러 (Deployment, StatefulSet, ReplicaSet만)
   */
  onScale?: () => void;

  /**
   * Shell 액션 핸들러 (Pod/Node 셸 열기)
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
   * Rollback 액션 핸들러 (Helm Release 롤백, Helm Release만)
   */
  onRollback?: () => void;
}

/**
 * 🎯 목적: DetailPanel 헤더 우측 Quick Action 버튼 컴포넌트
 *
 * @param props - DetailPanelQuickActionsProps
 * @returns Quick Action 아이콘 버튼들 (툴팁 포함)
 *
 * 📝 사용 예시:
 * ```typescript
 * <DetailPanelQuickActions
 *   object={pod}
 *   onEdit={() => console.log("Edit")}
 *   onShell={() => console.log("Shell")}
 *   onLogs={() => console.log("Logs")}
 *   onAttach={() => console.log("Attach")}
 * />
 * ```
 */
export function DetailPanelQuickActions({
  object,
  onEdit,
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
  onRollback,
}: DetailPanelQuickActionsProps) {
  // 🎯 리소스 타입 확인
  const isPod = object.kind === "Pod";
  const isNode = object.kind === "Node";

  // 🎯 Quick Action 목록 생성 (조건부)
  const actions: QuickActionConfig[] = [];

  // 공통 액션
  if (onEdit) {
    actions.push({ key: "edit", label: "Edit", icon: Edit, onClick: onEdit });
  }

  if (onRestart) {
    actions.push({ key: "restart", label: "Restart", icon: RotateCw, onClick: onRestart });
  }

  if (onScale) {
    actions.push({ key: "scale", label: "Scale", icon: Maximize, onClick: onScale });
  }

  // Pod 전용 액션
  if (isPod && onAttach) {
    actions.push({ key: "attach", label: "Attach to Pod", icon: Link, onClick: onAttach });
  }

  if (isPod && onShell) {
    actions.push({ key: "shell", label: "Pod Shell", icon: Terminal, onClick: onShell });
  }

  if (isPod && onLogs) {
    actions.push({ key: "logs", label: "Pod Log", icon: FileText, onClick: onLogs });
  }

  if (isPod && onLogsNewWindow) {
    actions.push({ key: "logsNewWindow", label: "Logs (New Window)", icon: ExternalLink, onClick: onLogsNewWindow });
  }

  // Node 전용 액션 (Shell만 Quick, Cordon/Uncordon/Drain은 Dropdown)
  if (isNode && onShell) {
    actions.push({ key: "shell", label: "Node Shell", icon: Terminal, onClick: onShell });
  }

  // Cluster 전용 액션
  if (onSetDefault) {
    actions.push({ key: "setDefault", label: "Set as Default", icon: Box, onClick: onSetDefault });
  }

  if (onKubeconfig) {
    actions.push({ key: "kubeconfig", label: "Kubeconfig File", icon: File, onClick: onKubeconfig });
  }

  // Job/CronJob 전용 액션
  if (onTrigger) {
    actions.push({ key: "trigger", label: "Trigger", icon: Play, onClick: onTrigger });
  }

  if (onSuspend) {
    actions.push({ key: "suspend", label: "Suspend", icon: OctagonPause, onClick: onSuspend });
  }

  // Helm Release 전용 액션
  if (onUpgrade) {
    actions.push({ key: "upgrade", label: "Upgrade", icon: ArrowUpToLine, onClick: onUpgrade });
  }

  if (onRollback) {
    actions.push({ key: "rollback", label: "Rollback", icon: History, onClick: onRollback });
  }

  // 🎯 액션이 없으면 렌더링하지 않음
  if (actions.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {actions.map((action) => (
          <Tooltip key={action.key}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={action.onClick}
                aria-label={action.label}
              >
                <action.icon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{action.label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
