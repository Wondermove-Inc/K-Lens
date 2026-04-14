/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Endpoint 상세 정보를 우측 슬라이드 패널로 표시
 *
 * 📱 반응형 디자인:
 * - 모바일 (<640px): 전체 너비
 * - 태블릿 (≥640px): 600px 고정
 * - 데스크톱 (≥768px): 700px 고정
 *
 * 📝 주의사항:
 *   - shadcn UI 컴포넌트 (Table, Badge) 사용
 *   - 슬라이드 인/아웃 애니메이션 적용
 *   - Subsets 정보 표시
 *   - DetailPanelActionsMenu로 Edit, Delete 액션 제공
 *
 * 🔄 변경이력:
 *   - 2025-10-30: 초기 생성 (Pod 반응형 패턴 적용)
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 *   - 2025-12-01: 닫힘 애니메이션 중 데이터 유지 패턴 적용
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Endpoints } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Table, TableBody, TableCell, TableRow } from "@skuberplus/storybook-shadcn";
import { Separator } from "@skuberplus/storybook-shadcn/src/components/ui/separator";
import { observer } from "mobx-react";
import React from "react";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { DetailPanel } from "../common/detail-panel";
import openConfirmDialogInjectable from "../confirm-dialog/open.injectable";
import createEditResourceTabInjectable from "../dock/edit-resource/edit-resource-tab.injectable";
import { KubeEventDetailsSection } from "../kube-object-details/kube-event-details-section";
import { KubeObjectMetaSection } from "../kube-object-details/kube-object-meta-section";
import kubeObjectDeleteServiceInjectable from "../kube-object-menu/kube-object-delete-service.injectable";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";

import type { KubeObject } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { Cluster } from "../../../common/cluster/cluster";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../dock/dock/store";
import type { KubeObjectDeleteService } from "../kube-object-menu/kube-object-delete-service.injectable";

export interface EndpointDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 Endpoint 객체
   */
  endpoint: Endpoints | undefined;

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
  hostedCluster: Cluster | undefined;
}

/**
 * Endpoint 상세 정보 우측 슬라이드 패널 컴포넌트
 *
 * @param isOpen - 패널 열림/닫힘 상태
 * @param endpoint - 표시할 Endpoint 객체
 * @param onClose - 패널 닫기 콜백
 */
const NonInjectedEndpointDetailPanel = observer(
  ({
    isOpen,
    endpoint,
    onClose,
    logger,
    createEditResourceTab,
    deleteService,
    openConfirmDialog,
    hostedCluster,
  }: EndpointDetailPanelProps & Dependencies) => {
    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목을 유지하기 위한 상태
    const [renderEndpoint, setRenderEndpoint] = React.useState<Endpoints | undefined>(endpoint);
    const clearTimerRef = React.useRef<ReturnType<typeof setTimeout>>();
    const prevIsOpenRef = React.useRef(isOpen);

    // 🔄 새로 선택된 리소스가 있으면 즉시 렌더 대상으로 반영
    React.useEffect(() => {
      if (endpoint) {
        setRenderEndpoint(endpoint);
      }
    }, [endpoint]);

    // 🔄 패널 열림/닫힘 상태에 따른 렌더 대상 관리
    React.useEffect(() => {
      const wasOpen = prevIsOpenRef.current;
      if (!isOpen && wasOpen) {
        clearTimerRef.current = setTimeout(() => {
          setRenderEndpoint(undefined);
        }, 320);
      }
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

    // ⚠️ Endpoint 객체가 없거나 유효하지 않으면 렌더링하지 않음
    if (!renderEndpoint) {
      return null;
    }

    if (!(renderEndpoint instanceof Endpoints)) {
      logger.error("[EndpointDetailPanel]: passed object that is not an instanceof Endpoints", renderEndpoint);
      return null;
    }

    // ============================================
    // 🎯 액션 핸들러 함수들 (DetailPanelActionsMenu용)
    // ============================================

    /**
     * Edit 액션: YAML 편집 탭 열기
     */
    const handleEdit = () => {
      createEditResourceTab(renderEndpoint);
    };

    /**
     * Delete 액션: Endpoint 삭제
     */
    const handleDelete = () => {
      openConfirmDialog({
        ok: async () => {
          try {
            await deleteService.delete(renderEndpoint, "delete");
            onClose();
          } catch (error) {
            // 🆕 FIX-038: clusterName metadata 추가
            const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
            notificationPanelStore.addError(
              "network",
              "Error",
              error instanceof Error ? error.message : "Unknown error occurred while deleting endpoint",
              { clusterName },
            );
          }
        },
        labelOk: "Delete",
        message: (
          <p>
            Are you sure you want to delete endpoint <b>{renderEndpoint.getName()}</b>?
          </p>
        ),
      });
    };

    // 🎯 Endpoint 속성 데이터 추출
    const namespace = renderEndpoint.getNs();
    const subsets = renderEndpoint.getEndpointSubsets();

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={renderEndpoint.getName()}
        subtitle={`Namespace: ${namespace}`}
        width="w-full md:w-[700px]"
        object={renderEndpoint}
        onEdit={handleEdit}
        onDelete={handleDelete}
      >
        {/* ============================================ */}
        {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
        {/* ============================================ */}
        <KubeObjectMetaSection object={renderEndpoint} />

        <Separator className="my-6" />

        {/* ============================================ */}
        {/* 📋 Subsets 섹션 */}
        {/* ============================================ */}
        {subsets.length === 0 ? (
          <div className="text-sm text-muted-foreground">No subsets defined</div>
        ) : (
          <div>
            <h3 className="mb-3 text-sm font-semibold">Subsets</h3>
            <div className="space-y-4">
              {subsets.map((subset, subsetIndex) => (
                <div key={subsetIndex} className="border rounded-md p-3 space-y-3">
                  <div className="font-medium text-sm">Subset {subsetIndex + 1}</div>

                  {/* Addresses */}
                  {subset.addresses && subset.addresses.length > 0 && (
                    <div>
                      <span className="text-sm font-medium">Addresses:</span>
                      <Table className="mt-2">
                        <TableBody>
                          {subset.addresses.map((address, addressIndex) => (
                            <TableRow key={addressIndex}>
                              <TableCell className="border-border border-b px-2 py-2">
                                <div className="space-y-1 text-sm">
                                  <div>
                                    <span className="font-medium">IP:</span> {address.ip}
                                  </div>
                                  {address.hostname && (
                                    <div>
                                      <span className="font-medium">Hostname:</span> {address.hostname}
                                    </div>
                                  )}
                                  {address.nodeName && (
                                    <div>
                                      <span className="font-medium">Node:</span> {address.nodeName}
                                    </div>
                                  )}
                                  {address.targetRef && (
                                    <div>
                                      <span className="font-medium">Target:</span> {address.targetRef.kind}/
                                      {address.targetRef.name}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Ports */}
                  {subset.ports && subset.ports.length > 0 && (
                    <div>
                      <span className="text-sm font-medium">Ports:</span>
                      <Table className="mt-2">
                        <TableBody>
                          {subset.ports.map((port, portIndex) => (
                            <TableRow key={portIndex}>
                              <TableCell className="border-border border-b px-2 py-2">
                                <div className="space-y-1 text-sm">
                                  {port.name && (
                                    <div>
                                      <span className="font-medium">Name:</span> {port.name}
                                    </div>
                                  )}
                                  <div>
                                    <span className="font-medium">Port:</span> {port.port}
                                  </div>
                                  <div>
                                    <span className="font-medium">Protocol:</span> {port.protocol ?? "TCP"}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Not Ready Addresses */}
                  {subset.notReadyAddresses && subset.notReadyAddresses.length > 0 && (
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">
                        Not Ready Addresses ({subset.notReadyAddresses.length}):
                      </span>
                      <ul className="mt-1 space-y-1 list-disc list-inside">
                        {subset.notReadyAddresses.map((address, index) => (
                          <li key={index} className="text-sm text-muted-foreground">
                            {address.ip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator className="my-6" />

        {/* ============================================ */}
        {/* 📋 Events 섹션 */}
        {/* ============================================ */}
        <KubeEventDetailsSection object={renderEndpoint} />
      </DetailPanel>
    );
  },
);

/**
 * 🎯 목적: Injectable로 감싼 EndpointDetailPanel 컴포넌트
 */
export const EndpointDetailPanel = withInjectables<Dependencies, EndpointDetailPanelProps>(
  NonInjectedEndpointDetailPanel,
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
