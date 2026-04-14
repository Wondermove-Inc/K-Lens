/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: 테이블 행 우클릭 컨텍스트 메뉴 컴포넌트
 *
 * @remarks
 * - KubeObjectActionHandlerResolver를 사용하여 kind별 액션 자동 resolve
 * - Quick Action만 표시 (DetailPanelQuickActions와 동일한 항목)
 * - 위험한 액션(Delete, Force Delete, Cordon, Drain 등)은 의도적으로 제외
 * - KubeDataTable의 renderContextMenu prop과 함께 사용
 *
 * 🔄 변경이력:
 * - 2026-02-10: 초기 생성
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import {
  ArrowUpToLine,
  Edit,
  ExternalLink,
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
import kubeObjectActionHandlerResolverInjectable from "../kube-object-details/kube-object-action-handlers/kube-object-action-handler-resolver.injectable";
import { ContextMenuItem, ContextMenuSeparator } from "../shadcn-ui/context-menu";

import type { KubeObject } from "@skuberplus/kube-object";

import type { LucideIcon } from "lucide-react";

import type { KubeObjectActionHandlers } from "../kube-object-details/kube-object-action-handlers/kube-object-action-handler-injection-token";
import type { KubeObjectActionHandlerResolver } from "../kube-object-details/kube-object-action-handlers/kube-object-action-handler-resolver.injectable";

/**
 * 🎯 목적: 컨텍스트 메뉴 아이템 설정
 */
interface ContextMenuAction {
  key: string;
  label: string;
  icon: LucideIcon;
  handler: keyof KubeObjectActionHandlers;
}

/**
 * 🎯 목적: Quick Action 목록 (위험 액션 제외)
 *
 * @remarks
 * 제외 항목 (디테일 패널에서만 접근):
 * - onDelete, onForceDelete, onForceFinalize → 위험 액션
 * - onCordon, onUncordon, onDrain → Node 위험 액션
 */
const QUICK_ACTIONS: ContextMenuAction[] = [
  { key: "edit", label: "Edit", icon: Edit, handler: "onEdit" },
  { key: "restart", label: "Restart", icon: RotateCw, handler: "onRestart" },
  { key: "scale", label: "Scale", icon: Maximize, handler: "onScale" },
  { key: "shell", label: "Shell", icon: Terminal, handler: "onShell" },
  { key: "logs", label: "Logs", icon: FileText, handler: "onLogs" },
  { key: "logsNewWindow", label: "Logs (New Window)", icon: ExternalLink, handler: "onLogsNewWindow" },
  { key: "attach", label: "Attach", icon: Link, handler: "onAttach" },
  { key: "trigger", label: "Trigger", icon: Play, handler: "onTrigger" },
  { key: "suspend", label: "Suspend", icon: OctagonPause, handler: "onSuspend" },
  { key: "upgrade", label: "Upgrade", icon: ArrowUpToLine, handler: "onUpgrade" },
  { key: "rollback", label: "Rollback", icon: History, handler: "onRollback" },
];

export interface ResourceContextMenuProps {
  object: KubeObject;
}

interface Dependencies {
  actionHandlerResolver: KubeObjectActionHandlerResolver;
}

/**
 * 🎯 목적: 리소스 컨텍스트 메뉴 (Quick Action만 표시)
 */
const NonInjectedResourceContextMenu = ({ object, actionHandlerResolver }: ResourceContextMenuProps & Dependencies) => {
  // 🎯 non-KubeObject 타입 방어 (HelmChart, HelmRelease, PortForwardItem 등)
  // resolver 내부에서 object.metadata 접근 시 크래시 방지
  if (!object || !("metadata" in object)) {
    return null;
  }

  const handlers = actionHandlerResolver.resolve(object);

  // 🎯 사용 가능한 액션만 필터링
  const availableActions = QUICK_ACTIONS.filter((action) => handlers[action.handler] != null);

  if (availableActions.length === 0) {
    return null;
  }

  return (
    <>
      {availableActions.map((action, index) => {
        const Icon = action.icon;
        const handler = handlers[action.handler];

        return (
          <React.Fragment key={action.key}>
            {/* Edit 이후 구분선 (Edit와 나머지 액션 사이) */}
            {index === 1 && availableActions[0]?.key === "edit" && <ContextMenuSeparator />}
            <ContextMenuItem
              onSelect={() => {
                // 🎯 ContextMenu 포커스 트랩이 해제된 후 핸들러 실행
                // 동기 실행 시 Dialog 등 다른 포커스 트랩과 충돌하여 UI 클릭 불가 현상 발생
                requestAnimationFrame(() => handler?.());
              }}
            >
              <Icon className="h-4 w-4" />
              {action.label}
            </ContextMenuItem>
          </React.Fragment>
        );
      })}
    </>
  );
};

/**
 * 🎯 목적: DI 패턴 적용된 ResourceContextMenu
 */
export const ResourceContextMenu = withInjectables<Dependencies, ResourceContextMenuProps>(
  NonInjectedResourceContextMenu,
  {
    getProps: (di, props) => ({
      ...props,
      actionHandlerResolver: di.inject(kubeObjectActionHandlerResolverInjectable),
    }),
  },
);
