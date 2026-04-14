/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: ClusterRoleBinding 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - shadcn DetailPanel 컴포넌트 사용
 *   - shadcn Table, Badge 컴포넌트로 상세 정보 표시
 *   - Reference 정보 및 Bindings 목록 표시
 *   - DetailPanelActionsMenu로 Edit, Delete 액션 제공
 * 🔄 변경이력:
 *   - 2025-11-05: 초기 생성 (RoleBinding DetailPanel 패턴 참고)
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 *   - 2025-12-01: Function Component로 변환 + renderXXX state 패턴 적용
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { ClusterRoleBinding } from "@skuberplus/kube-object";
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
import { LinkToClusterRole, LinkToNamespace, LinkToServiceAccount } from "../../kube-object-link";
import kubeObjectDeleteServiceInjectable from "../../kube-object-menu/kube-object-delete-service.injectable";
import { notificationPanelStore } from "../../status-bar/items/notification-panel.store";

import type { KubeObject } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { HostedCluster } from "../../../cluster-frame-context/hosted-cluster.injectable";
import type { OpenConfirmDialog } from "../../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../../dock/dock/store";
import type { KubeObjectDeleteService } from "../../kube-object-menu/kube-object-delete-service.injectable";

/**
 * 🎯 목적: ClusterRoleBindingDetailPanel Props 인터페이스
 */
export interface ClusterRoleBindingDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 ClusterRoleBinding 객체
   */
  clusterRoleBinding: ClusterRoleBinding | undefined;

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
 * 🎯 목적: ClusterRoleBinding 상세 정보 우측 슬라이드 패널 컴포넌트
 *
 * @param isOpen - 패널 열림/닫힘 상태
 * @param clusterRoleBinding - 표시할 ClusterRoleBinding 객체
 * @param onClose - 패널 닫기 콜백
 */
const NonInjectedClusterRoleBindingDetailPanel = observer(
  (props: ClusterRoleBindingDetailPanelProps & Dependencies) => {
    const {
      isOpen,
      clusterRoleBinding,
      onClose,
      logger,
      createEditResourceTab,
      deleteService,
      openConfirmDialog,
      hostedCluster,
    } = props;

    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목을 유지하기 위한 상태
    const [renderClusterRoleBinding, setRenderClusterRoleBinding] = React.useState<ClusterRoleBinding | undefined>(
      clusterRoleBinding,
    );
    const clearTimerRef = React.useRef<ReturnType<typeof setTimeout>>();
    const prevIsOpenRef = React.useRef(isOpen);

    // 🔄 새로 선택된 리소스가 있으면 즉시 렌더 대상으로 반영
    React.useEffect(() => {
      if (clusterRoleBinding) {
        setRenderClusterRoleBinding(clusterRoleBinding);
      }
    }, [clusterRoleBinding]);

    // 🔄 패널 열림/닫힘 상태에 따른 렌더 대상 관리
    React.useEffect(() => {
      const wasOpen = prevIsOpenRef.current;

      // 닫힐 때는 애니메이션 시간 이후에 렌더 대상을 정리
      if (!isOpen && wasOpen) {
        clearTimerRef.current = setTimeout(() => {
          setRenderClusterRoleBinding(undefined);
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
      if (renderClusterRoleBinding) {
        createEditResourceTab(renderClusterRoleBinding);
      }
    };

    /**
     * 🎯 액션 핸들러: Delete 액션 - ClusterRoleBinding 삭제
     */
    const handleDelete = () => {
      if (!renderClusterRoleBinding) return;

      openConfirmDialog({
        ok: async () => {
          try {
            await deleteService.delete(renderClusterRoleBinding, "delete");
            onClose();
          } catch (error) {
            // 🆕 FIX-038: clusterName metadata 추가
            const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
            notificationPanelStore.addError(
              "operations",
              "Error",
              error instanceof Error ? error.message : "Unknown error occurred while deleting cluster role binding",
              { clusterName },
            );
          }
        },
        labelOk: "Delete",
        message: (
          <p>
            Are you sure you want to delete cluster role binding <b>{renderClusterRoleBinding.getName()}</b>?
          </p>
        ),
      });
    };

    // ⚠️ 렌더 대상 ClusterRoleBinding이 없으면 렌더링하지 않음
    if (!renderClusterRoleBinding) {
      return null;
    }

    if (clusterRoleBinding && !(clusterRoleBinding instanceof ClusterRoleBinding)) {
      logger.error(
        "[ClusterRoleBindingDetailPanel]: passed object that is not a ClusterRoleBinding",
        clusterRoleBinding,
      );
      return null;
    }

    // 🎯 ClusterRoleBinding 속성 데이터 추출
    const { roleRef } = renderClusterRoleBinding;
    const subjects = renderClusterRoleBinding.getSubjects();

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={renderClusterRoleBinding.getName()}
        subtitle="Cluster-scoped"
        object={renderClusterRoleBinding}
        onEdit={handleEdit}
        onDelete={handleDelete}
      >
        {/* ============================================ */}
        {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
        {/* ============================================ */}
        <KubeObjectMetaSection object={renderClusterRoleBinding} />

        <Separator className="my-6" />

        {/* ============================================ */}
        {/* 📋 Reference 테이블 */}
        {/* ============================================ */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2">Reference</h3>
          <Table>
            <TableHead>
              <TableCell className="border-border border-b px-2 py-2">
                <span className="text-foreground text-sm font-medium">Kind</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-2">
                <span className="text-foreground text-sm font-medium">Name</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-2">
                <span className="text-foreground text-sm font-medium">API Group</span>
              </TableCell>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <Badge variant="secondary">{roleRef.kind}</Badge>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <LinkToClusterRole name={roleRef.name} />
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">{roleRef.apiGroup}</span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <Separator className="my-6" />

        {/* ============================================ */}
        {/* 📋 Bindings 테이블 */}
        {/* ============================================ */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold mb-2">Bindings</h3>
          {subjects.length > 0 ? (
            <Table>
              <TableHead>
                <TableCell className="border-border border-b px-2 py-2">
                  <span className="text-foreground text-sm font-medium">Type</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-2">
                  <span className="text-foreground text-sm font-medium">Name</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-2">
                  <span className="text-foreground text-sm font-medium">Namespace</span>
                </TableCell>
              </TableHead>
              <TableBody>
                {subjects.map((subject, i) => {
                  const { kind, name, namespace: subjectNs } = subject;

                  return (
                    <TableRow key={i}>
                      <TableCell className="border-border border-b px-2 py-[14px]">
                        <Badge variant="outline">{kind}</Badge>
                      </TableCell>
                      <TableCell className="border-border border-b px-2 py-[14px]">
                        {kind === "ServiceAccount" ? (
                          <LinkToServiceAccount name={name} namespace={subjectNs} />
                        ) : (
                          <span className="text-foreground text-sm">{name}</span>
                        )}
                      </TableCell>
                      <TableCell className="border-border border-b px-2 py-[14px]">
                        {subjectNs ? (
                          <LinkToNamespace namespace={subjectNs} />
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
            <p className="text-muted-foreground text-sm">No bindings found</p>
          )}
        </div>

        {/* ============================================ */}
        {/* 📋 Events 섹션 */}
        {/* ============================================ */}
        <KubeEventDetailsSection object={renderClusterRoleBinding} />
      </DetailPanel>
    );
  },
);

export const ClusterRoleBindingDetailPanel = withInjectables<Dependencies, ClusterRoleBindingDetailPanelProps>(
  NonInjectedClusterRoleBindingDetailPanel,
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
