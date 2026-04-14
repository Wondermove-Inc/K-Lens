/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Event 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - shadcn DetailPanel 컴포넌트 사용
 *   - shadcn Table로 메타데이터 표시
 *   - 기존 EventDetails 로직 재사용
 *   - DetailPanelActionsMenu로 Edit, Delete 액션 제공
 * 🔄 변경이력:
 *   - 2025-11-03: 초기 생성 (shadcn DetailPanel 기반)
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 */

import "./event-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { KubeEvent } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Table, TableBody, TableCell, TableRow } from "@skuberplus/storybook-shadcn";
import { DetailPanelSection } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { Separator } from "@skuberplus/storybook-shadcn/src/components/ui/separator";
import { cssNames } from "@skuberplus/utilities";
import kebabCase from "lodash/kebabCase";
import { observer } from "mobx-react";
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import apiManagerInjectable from "../../../common/k8s-api/api-manager/manager.injectable";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { DetailPanel } from "../common/detail-panel";
import openConfirmDialogInjectable from "../confirm-dialog/open.injectable";
import createEditResourceTabInjectable from "../dock/edit-resource/edit-resource-tab.injectable";
import getDetailsUrlInjectable from "../kube-detail-params/get-details-url.injectable";
import { KubeEventDetailsSection } from "../kube-object-details/kube-event-details-section";
import { KubeObjectMetaSection } from "../kube-object-details/kube-object-meta-section";
import kubeObjectDeleteServiceInjectable from "../kube-object-menu/kube-object-delete-service.injectable";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";
import { DurationAbsoluteTimestamp } from "./duration-absolute";

import type { KubeObject } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { Cluster } from "../../../common/cluster/cluster";
import type { ApiManager } from "../../../common/k8s-api/api-manager";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../dock/dock/store";
import type { GetDetailsUrl } from "../kube-detail-params/get-details-url.injectable";
import type { KubeObjectDeleteService } from "../kube-object-menu/kube-object-delete-service.injectable";

/**
 * 🎯 목적: EventDetailPanel Props 인터페이스
 */
export interface EventDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 Event 객체
   */
  event: KubeEvent | undefined;

  /**
   * 패널 닫기 콜백
   */
  onClose: () => void;
}

interface Dependencies {
  getDetailsUrl: GetDetailsUrl;
  apiManager: ApiManager;
  logger: Logger;
  createEditResourceTab: (object: KubeObject, tabParams?: DockTabCreateSpecific) => string;
  deleteService: KubeObjectDeleteService;
  openConfirmDialog: OpenConfirmDialog;
  hostedCluster: Cluster | undefined;
}

/**
 * 🎯 목적: Event 상세 정보 우측 슬라이드 패널 컴포넌트
 *
 * @param isOpen - 패널 열림/닫힘 상태
 * @param event - 표시할 Event 객체
 * @param onClose - 패널 닫기 콜백
 */
const NonInjectedEventDetailPanel = observer(
  ({
    apiManager,
    getDetailsUrl,
    logger,
    isOpen,
    event,
    onClose,
    createEditResourceTab,
    deleteService,
    openConfirmDialog,
    hostedCluster,
  }: Dependencies & EventDetailPanelProps) => {
    // ============================================
    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목 유지
    // ============================================
    const [renderEvent, setRenderEvent] = useState<KubeEvent | undefined>(event);
    const clearTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const prevIsOpenRef = useRef(true);

    useEffect(() => {
      // 새로 선택된 리소스 반영
      if (event) {
        setRenderEvent(event);
      }

      // 패널 닫힘 애니메이션 처리
      const wasOpen = prevIsOpenRef.current;

      if (!isOpen && wasOpen) {
        clearTimerRef.current = setTimeout(() => {
          setRenderEvent(undefined);
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
    }, [isOpen, event]);

    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목 사용
    const item = renderEvent;

    if (!item) {
      return null;
    }

    if (!(item instanceof KubeEvent)) {
      logger.error("[EventDetailPanel]: passed object that is not an instanceof KubeEvent", item);
      return null;
    }

    // ============================================
    // 🎯 액션 핸들러 함수들 (DetailPanelActionsMenu용)
    // ============================================

    /**
     * Edit 액션: YAML 편집 탭 열기
     */
    const handleEdit = () => {
      createEditResourceTab(item);
    };

    /**
     * Delete 액션: Event 삭제
     */
    const handleDelete = () => {
      openConfirmDialog({
        ok: async () => {
          try {
            await deleteService.delete(item, "delete");
            onClose();
          } catch (error) {
            // 🆕 FIX-038: clusterName 메타데이터 추가
            const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
            notificationPanelStore.addError(
              "operations",
              "Error",
              error instanceof Error ? error.message : "Unknown error occurred while deleting event",
              { clusterName },
            );
          }
        },
        labelOk: "Delete",
        message: (
          <p>
            Are you sure you want to delete event <b>{item.getName()}</b>?
          </p>
        ),
      });
    };

    const { message, reason, count, type, involvedObject } = item;
    const { kind, name, namespace, fieldPath } = involvedObject;

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={`Event: ${item.getName()}`}
        subtitle={namespace ? `Namespace: ${namespace}` : "Cluster event"}
        object={item}
        onEdit={handleEdit}
        onDelete={handleDelete}
      >
        {/* ============================================ */}
        {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
        {/* ============================================ */}
        <KubeObjectMetaSection object={item} />

        <Separator className="my-6" />
        {/* ============================================ */}
        {/* 🎯 메타데이터 테이블 (shadcn Table) */}
        {/* ============================================ */}
        <div className="space-y-4">
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium w-1/3">Message</TableCell>
                <TableCell>{message}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium w-1/3">Reason</TableCell>
                <TableCell>{reason}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium w-1/3">Source</TableCell>
                <TableCell>{item.getSource()}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium w-1/3">First seen</TableCell>
                <TableCell>
                  <DurationAbsoluteTimestamp timestamp={item.firstTimestamp} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium w-1/3">Last seen</TableCell>
                <TableCell>
                  <DurationAbsoluteTimestamp timestamp={item.lastTimestamp} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium w-1/3">Count</TableCell>
                <TableCell>{count}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium w-1/3">Type</TableCell>
                <TableCell>
                  <span className={cssNames("type", kebabCase(type))}>{type}</span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          {/* ============================================ */}
          {/* 🎯 Involved Object 섹션 */}
          {/* ============================================ */}
          <DetailPanelSection title="Involved object">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium w-1/3">Name</TableCell>
                  <TableCell>
                    <Link to={getDetailsUrl(apiManager.lookupApiLink(involvedObject, event))}>{name}</Link>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium w-1/3">Namespace</TableCell>
                  <TableCell>{namespace}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium w-1/3">Kind</TableCell>
                  <TableCell>{kind}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium w-1/3">Field Path</TableCell>
                  <TableCell>{fieldPath}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </DetailPanelSection>
        </div>

        <Separator className="my-6" />

        {/* ============================================ */}
        {/* 📋 Events 섹션 */}
        {/* ============================================ */}
        <KubeEventDetailsSection object={item} />
      </DetailPanel>
    );
  },
);

export const EventDetailPanel = withInjectables<Dependencies, EventDetailPanelProps>(NonInjectedEventDetailPanel, {
  getProps: (di, props) => ({
    ...props,
    apiManager: di.inject(apiManagerInjectable),
    getDetailsUrl: di.inject(getDetailsUrlInjectable),
    logger: di.inject(loggerInjectionToken),
    createEditResourceTab: di.inject(createEditResourceTabInjectable),
    deleteService: di.inject(kubeObjectDeleteServiceInjectable),
    openConfirmDialog: di.inject(openConfirmDialogInjectable),
    hostedCluster: di.inject(hostedClusterInjectable),
  }),
});
