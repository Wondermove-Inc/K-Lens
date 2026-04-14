/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Cluster Role 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - shadcn DetailPanel 컴포넌트 사용
 *   - shadcn Table, Badge 컴포넌트로 상세 정보 표시
 *   - Rules (Resources, Verbs, API Groups, Resource Names) 표시
 *   - DetailPanelActionsMenu로 Edit, Delete 액션 제공
 * 🔄 변경이력:
 *   - 2025-11-10: 초기 생성 (RoleBinding DetailPanel 패턴 참고)
 *   - 2025-12-01: Function Component로 변환 + renderXXX state 패턴 적용
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { ClusterRole } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Table, TableBody, TableCell, TableHead, TableRow } from "@skuberplus/storybook-shadcn";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { Separator } from "@skuberplus/storybook-shadcn/src/components/ui/separator";
import { observer } from "mobx-react";
import React from "react";
import hostedClusterInjectable from "../../../cluster-frame-context/hosted-cluster.injectable";
import { DetailPanel } from "../../common/detail-panel";
import openConfirmDialogInjectable from "../../confirm-dialog/open.injectable";
import createEditResourceTabInjectable from "../../dock/edit-resource/edit-resource-tab.injectable";
import { KubeEventDetailsSection } from "../../kube-object-details/kube-event-details-section";
import { KubeObjectMetaSection } from "../../kube-object-details/kube-object-meta-section";
import kubeObjectDeleteServiceInjectable from "../../kube-object-menu/kube-object-delete-service.injectable";
import { notificationPanelStore } from "../../status-bar/items/notification-panel.store";

import type { KubeObject } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { HostedCluster } from "../../../cluster-frame-context/hosted-cluster.injectable";
import type { OpenConfirmDialog } from "../../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../../dock/dock/store";
import type { KubeObjectDeleteService } from "../../kube-object-menu/kube-object-delete-service.injectable";

/**
 * 🎯 목적: ClusterRoleDetailPanel Props 인터페이스
 */
export interface ClusterRoleDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 ClusterRole 객체
   */
  clusterRole: ClusterRole | undefined;

  /**
   * 패널 닫기 콜백
   */
  onClose: () => void;
}

interface Dependencies {
  logger: Logger;
  createEditResourceTab: (object: KubeObject, tabParams?: DockTabCreateSpecific) => string;
  deleteService: KubeObjectDeleteService;
  openConfirmDialog: OpenConfirmDialog;
  hostedCluster: HostedCluster | undefined;
}

/**
 * 🎯 목적: Cluster Role 상세 정보 우측 슬라이드 패널 컴포넌트
 *
 * @param isOpen - 패널 열림/닫힘 상태
 * @param clusterRole - 표시할 ClusterRole 객체
 * @param onClose - 패널 닫기 콜백
 */
const NonInjectedClusterRoleDetailPanel = observer((props: ClusterRoleDetailPanelProps & Dependencies) => {
  const {
    isOpen,
    clusterRole,
    onClose,
    logger,
    createEditResourceTab,
    deleteService,
    openConfirmDialog,
    hostedCluster,
  } = props;

  // 🎯 닫힘 애니메이션 동안 마지막 선택 항목을 유지하기 위한 상태
  const [renderClusterRole, setRenderClusterRole] = React.useState<ClusterRole | undefined>(clusterRole);
  const clearTimerRef = React.useRef<ReturnType<typeof setTimeout>>();
  const prevIsOpenRef = React.useRef(isOpen);

  // 🔄 새로 선택된 리소스가 있으면 즉시 렌더 대상으로 반영
  React.useEffect(() => {
    if (clusterRole) {
      setRenderClusterRole(clusterRole);
    }
  }, [clusterRole]);

  // 🔄 패널 열림/닫힘 상태에 따른 렌더 대상 관리
  React.useEffect(() => {
    const wasOpen = prevIsOpenRef.current;

    // 닫힐 때는 애니메이션 시간 이후에 렌더 대상을 정리
    if (!isOpen && wasOpen) {
      clearTimerRef.current = setTimeout(() => {
        setRenderClusterRole(undefined);
      }, 320);
    }

    // 다시 열리면 정리 타이머 취소
    if (isOpen && clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = undefined;
    }

    prevIsOpenRef.current = isOpen;

    return () => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
    };
  }, [isOpen]);

  /**
   * 🎯 액션 핸들러: Edit 액션 - YAML 편집 탭 열기
   */
  const handleEdit = () => {
    if (renderClusterRole) {
      createEditResourceTab(renderClusterRole);
    }
  };

  /**
   * 🎯 액션 핸들러: Delete 액션 - ClusterRole 삭제 확인 다이얼로그 표시
   */
  const handleDelete = () => {
    if (!renderClusterRole) return;

    openConfirmDialog({
      ok: async () => {
        try {
          await deleteService.delete(renderClusterRole, "delete");
          onClose();
        } catch (error) {
          // 🆕 FIX-038: clusterName metadata 추가
          const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
          notificationPanelStore.addError(
            "operations",
            "Error",
            error instanceof Error ? error.message : "Unknown error occurred while deleting cluster role",
            { clusterName },
          );
        }
      },
      labelOk: "Delete",
      message: (
        <p>
          Are you sure you want to delete cluster role <b>{renderClusterRole.getName()}</b>?
        </p>
      ),
    });
  };

  // ⚠️ 렌더 대상 ClusterRole이 없으면 렌더링하지 않음
  if (!renderClusterRole) {
    return null;
  }

  if (clusterRole && !(clusterRole instanceof ClusterRole)) {
    logger.error("[ClusterRoleDetailPanel]: passed object that is not a ClusterRole", clusterRole);
    return null;
  }

  // 🎯 ClusterRole 속성 데이터 추출
  const rules = renderClusterRole.getRules();

  return (
    <DetailPanel
      isOpen={isOpen}
      onClose={onClose}
      title={renderClusterRole.getName()}
      subtitle="Cluster-scoped Role"
      object={renderClusterRole}
      onEdit={handleEdit}
      onDelete={handleDelete}
    >
      {/* ============================================ */}
      {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
      {/* ============================================ */}
      <KubeObjectMetaSection object={renderClusterRole} />

      <Separator className="my-6" />

      {/* ============================================ */}
      {/* 📋 Rules 테이블 */}
      {/* ============================================ */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold mb-2">Rules</h3>
        {rules.length > 0 ? (
          <Table>
            <TableHead>
              <TableCell className="border-border border-b px-2 py-2">
                <span className="text-foreground text-sm font-medium">Resources</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-2">
                <span className="text-foreground text-sm font-medium">Verbs</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-2">
                <span className="text-foreground text-sm font-medium">API Groups</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-2">
                <span className="text-foreground text-sm font-medium">Resource Names</span>
              </TableCell>
            </TableHead>
            <TableBody>
              {rules.map((rule, index) => {
                const { resources, verbs, apiGroups, resourceNames } = rule;

                return (
                  <TableRow key={index}>
                    <TableCell className="border-border border-b px-2 py-[14px]">
                      {resources && resources.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {resources.map((r) => (
                            <Badge key={r} variant="outline">
                              {r}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="border-border border-b px-2 py-[14px]">
                      {verbs && verbs.length > 0 ? (
                        <span className="text-foreground text-sm">{verbs.join(", ")}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="border-border border-b px-2 py-[14px]">
                      {apiGroups && apiGroups.length > 0 ? (
                        <span className="text-foreground text-sm">
                          {apiGroups.map((g) => (g === "" ? `''` : g)).join(", ")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="border-border border-b px-2 py-[14px]">
                      {resourceNames && resourceNames.length > 0 ? (
                        <span className="text-foreground text-sm">{resourceNames.join(", ")}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-sm">No rules found</p>
        )}
      </div>

      {/* ============================================ */}
      {/* 📋 Events 섹션 */}
      {/* ============================================ */}
      <KubeEventDetailsSection object={renderClusterRole} />
    </DetailPanel>
  );
});

export const ClusterRoleDetailPanel = withInjectables<Dependencies, ClusterRoleDetailPanelProps>(
  NonInjectedClusterRoleDetailPanel,
  {
    getProps: (di, props) => ({
      ...props,
      logger: di.inject(loggerInjectionToken),
      createEditResourceTab: di.inject(createEditResourceTabInjectable),
      deleteService: di.inject(kubeObjectDeleteServiceInjectable),
      openConfirmDialog: di.inject(openConfirmDialogInjectable),
      hostedCluster: di.inject(hostedClusterInjectable),
    }),
  },
);
