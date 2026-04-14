/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: DetailPanel 헤더 우측 액션 메뉴 (shadcn UI DropdownMenu 기반)
 *
 * @remarks
 * - 위험한 액션만 드롭다운에 표시 (Delete, Force Delete, Force Finalize 등)
 * - Node의 Cordon, Uncordon, Drain도 위험 액션으로 분류
 * - 자주 사용하는 액션은 DetailPanelQuickActions로 이동
 * - Radix UI 접근성 자동 지원
 *
 * 📝 주의사항:
 * - KubeObject를 props로 받아 kind 확인
 * - 액션 핸들러는 외부에서 주입 (props)
 * - variant="destructive"로 Delete 강조
 *
 * 🔄 변경이력:
 * - 2025-11-06: 초기 생성 (shadcn DropdownMenu 기반 액션 메뉴)
 * - 2025-11-06: Restart, Scale 액션 추가 (Deployment, DaemonSet, StatefulSet, ReplicaSet)
 * - 2026-01-27: 위험 액션만 남기고 Quick Actions로 분리 (UX 개선)
 */

import { CircleArrowOutUpRight, CircleX, Eraser, MoreVertical, Pin, PinOff, Trash } from "lucide-react";
import React from "react";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

/**
 * 🎯 목적: KubeObject 기본 인터페이스 (최소 필요 속성만)
 */
export interface MinimalKubeObject {
  kind: string;
  apiVersion?: string;
}

/**
 * 🎯 목적: DetailPanelActionsMenu 컴포넌트 Props 인터페이스
 *
 * @remarks
 * - 위험한 액션만 포함 (Delete, Force Delete, Force Finalize, Node 관련)
 * - 자주 사용하는 액션은 DetailPanelQuickActions에서 처리
 */
export interface DetailPanelActionsMenuProps {
  /**
   * Kubernetes 리소스 객체 (kind 확인용)
   */
  object: MinimalKubeObject;

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
}

/**
 * 🎯 목적: DetailPanel 헤더 우측 액션 메뉴 컴포넌트 (위험 액션만)
 *
 * @param props - DetailPanelActionsMenuProps
 * @returns shadcn DropdownMenu 기반 액션 메뉴 (위험 액션만 표시)
 *
 * 📝 사용 예시:
 * ```typescript
 * <DetailPanelActionsMenu
 *   object={pod}
 *   onDelete={() => console.log("Delete")}
 *   onForceDelete={() => console.log("Force Delete")}
 * />
 * ```
 */
export function DetailPanelActionsMenu({
  object,
  onDelete,
  onForceDelete,
  onForceFinalize,
  onCordon,
  onUncordon,
  onDrain,
}: DetailPanelActionsMenuProps) {
  // 🎯 Pod 여부 확인 (Force Delete는 Pod만)
  const isPod = object.kind === "Pod";
  // 🎯 Node 여부 확인 (Cordon, Uncordon, Drain은 Node만)
  const isNode = object.kind === "Node";

  // 🎯 표시할 액션이 있는지 확인
  const hasNodeActions = isNode && (onCordon || onUncordon || onDrain);
  const hasDestructiveActions = onForceFinalize || onDelete || (isPod && onForceDelete);

  // 🎯 표시할 액션이 없으면 렌더링하지 않음
  if (!hasNodeActions && !hasDestructiveActions) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="More actions">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* ============================================ */}
        {/* 🎯 Node 위험 액션 (Cordon, Uncordon, Drain) */}
        {/* ============================================ */}
        {isNode && onCordon && (
          <DropdownMenuItem onClick={onCordon}>
            <Pin className="mr-2 h-4 w-4" />
            Cordon
          </DropdownMenuItem>
        )}

        {isNode && onUncordon && (
          <DropdownMenuItem onClick={onUncordon}>
            <PinOff className="mr-2 h-4 w-4" />
            Uncordon
          </DropdownMenuItem>
        )}

        {isNode && onDrain && (
          <DropdownMenuItem onClick={onDrain}>
            <CircleArrowOutUpRight className="mr-2 h-4 w-4" />
            Drain
          </DropdownMenuItem>
        )}

        {/* ============================================ */}
        {/* 🎯 Separator + Destructive 액션 (빨간색 강조) */}
        {/* ============================================ */}
        {hasNodeActions && hasDestructiveActions && <DropdownMenuSeparator />}

        {onForceFinalize && (
          <DropdownMenuItem variant="destructive" className="!text-red-500" onClick={onForceFinalize}>
            <Eraser className="mr-2 h-4 w-4" />
            Force Finalize
          </DropdownMenuItem>
        )}

        {onDelete && (
          <DropdownMenuItem variant="destructive" className="!text-red-500" onClick={onDelete}>
            <Trash className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        )}

        {/* 🎯 Force Delete 액션 (Pod만 표시) */}
        {isPod && onForceDelete && (
          <DropdownMenuItem variant="destructive" className="!text-red-500" onClick={onForceDelete}>
            <CircleX className="mr-2 h-4 w-4" />
            Force Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
