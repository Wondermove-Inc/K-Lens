/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Endpoint Slice 상세 정보를 우측 슬라이드 패널로 표시
 *
 * 📱 반응형 디자인:
 * - 모바일 (<640px): 전체 너비
 * - 태블릿 (≥640px): 600px 고정
 * - 데스크톱 (≥768px): 700px 고정
 *
 * 📝 주의사항:
 *   - shadcn UI 컴포넌트 (Table, Badge) 사용
 *   - 슬라이드 인/아웃 애니메이션 적용
 *   - Endpoints, Ports 정보 표시
 *   - DetailPanelActionsMenu로 Edit, Delete 액션 제공
 *
 * 🔄 변경이력:
 *   - 2025-10-30: 초기 생성 (Pod 반응형 패턴 적용)
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 *   - 2025-12-01: 닫힘 애니메이션 중 데이터 유지 패턴 적용
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { EndpointSlice } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Table, TableBody, TableCell, TableRow } from "@skuberplus/storybook-shadcn";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
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

export interface EndpointSliceDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 Endpoint Slice 객체
   */
  endpointSlice: EndpointSlice | undefined;

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
 * Endpoint Slice 상세 정보 우측 슬라이드 패널 컴포넌트
 *
 * @param isOpen - 패널 열림/닫힘 상태
 * @param endpointSlice - 표시할 Endpoint Slice 객체
 * @param onClose - 패널 닫기 콜백
 */
const NonInjectedEndpointSliceDetailPanel = observer(
  ({
    isOpen,
    endpointSlice,
    onClose,
    logger,
    createEditResourceTab,
    deleteService,
    openConfirmDialog,
    hostedCluster,
  }: EndpointSliceDetailPanelProps & Dependencies) => {
    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목을 유지하기 위한 상태
    const [renderEndpointSlice, setRenderEndpointSlice] = React.useState<EndpointSlice | undefined>(endpointSlice);
    const clearTimerRef = React.useRef<ReturnType<typeof setTimeout>>();
    const prevIsOpenRef = React.useRef(isOpen);

    // 🔄 새로 선택된 리소스가 있으면 즉시 렌더 대상으로 반영
    React.useEffect(() => {
      if (endpointSlice) {
        setRenderEndpointSlice(endpointSlice);
      }
    }, [endpointSlice]);

    // 🔄 패널 열림/닫힘 상태에 따른 렌더 대상 관리
    React.useEffect(() => {
      const wasOpen = prevIsOpenRef.current;
      if (!isOpen && wasOpen) {
        clearTimerRef.current = setTimeout(() => {
          setRenderEndpointSlice(undefined);
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

    // ⚠️ Endpoint Slice 객체가 없거나 유효하지 않으면 렌더링하지 않음
    if (!renderEndpointSlice) {
      return null;
    }

    if (!(renderEndpointSlice instanceof EndpointSlice)) {
      logger.error(
        "[EndpointSliceDetailPanel]: passed object that is not an instanceof EndpointSlice",
        renderEndpointSlice,
      );
      return null;
    }

    // ============================================
    // 🎯 액션 핸들러 함수들 (DetailPanelActionsMenu용)
    // ============================================

    /**
     * Edit 액션: YAML 편집 탭 열기
     */
    const handleEdit = () => {
      createEditResourceTab(renderEndpointSlice);
    };

    /**
     * Delete 액션: EndpointSlice 삭제
     */
    const handleDelete = () => {
      openConfirmDialog({
        ok: async () => {
          try {
            await deleteService.delete(renderEndpointSlice, "delete");
            onClose();
          } catch (error) {
            // 🆕 FIX-038: clusterName metadata 추가
            const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
            notificationPanelStore.addError(
              "network",
              "Error",
              error instanceof Error ? error.message : "Unknown error occurred while deleting endpoint slice",
              { clusterName },
            );
          }
        },
        labelOk: "Delete",
        message: (
          <p>
            Are you sure you want to delete endpoint slice <b>{renderEndpointSlice.getName()}</b>?
          </p>
        ),
      });
    };

    // 🎯 Endpoint Slice 속성 데이터 추출
    const namespace = renderEndpointSlice.getNs();
    const { addressType, endpoints = [], ports = [] } = renderEndpointSlice;

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={renderEndpointSlice.getName()}
        subtitle={`Namespace: ${namespace}`}
        width="w-full md:w-[700px]"
        object={renderEndpointSlice}
        onEdit={handleEdit}
        onDelete={handleDelete}
      >
        {/* ============================================ */}
        {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
        {/* ============================================ */}
        <KubeObjectMetaSection object={renderEndpointSlice} />

        <Separator className="my-6" />
        {/* ============================================ */}
        {/* 📋 기본 정보 테이블 */}
        {/* ============================================ */}
        <div>
          <h3 className="mb-3 text-sm font-semibold">Basic Information</h3>
          <Table>
            <TableBody>
              {/* Address Type */}
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px] w-1/3">
                  <span className="text-foreground text-sm">Address Type</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <Badge variant="outline">{addressType ?? "N/A"}</Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* ============================================ */}
        {/* 📋 Ports 섹션 */}
        {/* ============================================ */}
        {ports && ports.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold">Ports</h3>
            <Table>
              <TableBody>
                {ports.map((port, index) => (
                  <TableRow key={index}>
                    <TableCell className="border-border border-b px-2 py-[14px] w-1/3">
                      <span className="text-foreground text-sm">Port {index + 1}</span>
                    </TableCell>
                    <TableCell className="border-border border-b px-2 py-[14px]">
                      <div className="space-y-1">
                        {port.name && (
                          <div className="text-sm">
                            <span className="font-medium">Name:</span> {port.name}
                          </div>
                        )}
                        {port.port && (
                          <div className="text-sm">
                            <span className="font-medium">Port:</span> {port.port}
                          </div>
                        )}
                        {port.protocol && (
                          <div className="text-sm">
                            <span className="font-medium">Protocol:</span> {port.protocol}
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

        {/* ============================================ */}
        {/* 📋 Endpoints 섹션 */}
        {/* ============================================ */}
        {endpoints && endpoints.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold">Endpoints</h3>
            <div className="space-y-3">
              {endpoints.map((endpoint, endpointIndex) => (
                <div key={endpointIndex} className="border rounded-md p-3 space-y-2">
                  <div className="font-medium text-sm">Endpoint {endpointIndex + 1}</div>

                  {/* Addresses */}
                  {endpoint.addresses && endpoint.addresses.length > 0 && (
                    <div>
                      <span className="text-sm font-medium">Addresses:</span>
                      <ul className="mt-1 space-y-1 list-disc list-inside">
                        {endpoint.addresses.map((address, addressIndex) => (
                          <li key={addressIndex} className="text-sm">
                            {address}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Hostname */}
                  {endpoint.hostname && (
                    <div className="text-sm">
                      <span className="font-medium">Hostname:</span> {endpoint.hostname}
                    </div>
                  )}

                  {/* Node Name */}
                  {endpoint.nodeName && (
                    <div className="text-sm">
                      <span className="font-medium">Node:</span> {endpoint.nodeName}
                    </div>
                  )}

                  {/* Zone */}
                  {endpoint.zone && (
                    <div className="text-sm">
                      <span className="font-medium">Zone:</span> {endpoint.zone}
                    </div>
                  )}

                  {/* Target Ref */}
                  {endpoint.targetRef && (
                    <div className="text-sm">
                      <span className="font-medium">Target:</span> {endpoint.targetRef.kind}/{endpoint.targetRef.name}
                    </div>
                  )}

                  {/* Conditions */}
                  {endpoint.conditions && (
                    <div>
                      <span className="text-sm font-medium">Conditions:</span>
                      <div className="mt-1 flex gap-2">
                        {endpoint.conditions.ready && <Badge variant="default">Ready</Badge>}
                        {endpoint.conditions.serving && <Badge variant="default">Serving</Badge>}
                        {endpoint.conditions.terminating && <Badge variant="secondary">Terminating</Badge>}
                      </div>
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
        <KubeEventDetailsSection object={renderEndpointSlice} />
      </DetailPanel>
    );
  },
);

/**
 * 🎯 목적: Injectable로 감싼 EndpointSliceDetailPanel 컴포넌트
 */
export const EndpointSliceDetailPanel = withInjectables<Dependencies, EndpointSliceDetailPanelProps>(
  NonInjectedEndpointSliceDetailPanel,
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
