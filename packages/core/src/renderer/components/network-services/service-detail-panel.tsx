/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Service 상세 정보를 우측 슬라이드 패널로 표시
 *
 * 📝 주의사항:
 *   - 공통 DetailPanel 컴포넌트 사용 (packages/storybook-shadcn/src/components/ui/detail-panel.tsx)
 *   - shadcn UI 컴포넌트 (Table, Badge) 사용
 *   - Service 타입별 정보 표시 (LoadBalancer, ClusterIP 등)
 *   - DetailPanelActionsMenu로 Edit, Delete 액션 제공
 *
 * 🔄 변경이력:
 *   - 2025-10-30: 초기 생성 (Pod 반응형 패턴 적용)
 *   - 2025-11-04: 공통 DetailPanel 컴포넌트로 리팩토링 (70줄 감소)
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 *   - 2025-12-01: 닫힘 애니메이션 중 데이터 유지 패턴 적용
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Service } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Table, TableBody, TableCell, TableRow } from "@skuberplus/storybook-shadcn";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { Separator } from "@skuberplus/storybook-shadcn/src/components/ui/separator";
import { ExternalLink } from "lucide-react";
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

export interface ServiceDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 Service 객체
   */
  service: Service | undefined;

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
 * 🎯 목적: External IP에 대한 프로토콜 추정 (포트 기반)
 *
 * @param service - Service 객체
 * @returns "https" | "http" | undefined
 */
function getExternalProtocol(service: Service): string | undefined {
  if (service.getPorts().find((s) => s.port === 443)) {
    return "https";
  }
  if (service.getPorts().find((s) => s.port === 80)) {
    return "http";
  }
  return;
}

/**
 * Service 상세 정보 우측 슬라이드 패널 컴포넌트
 *
 * @param isOpen - 패널 열림/닫힘 상태
 * @param service - 표시할 Service 객체
 * @param onClose - 패널 닫기 콜백
 */
const NonInjectedServiceDetailPanel = observer((props: ServiceDetailPanelProps & Dependencies) => {
  const { isOpen, service, onClose, logger, createEditResourceTab, deleteService, openConfirmDialog, hostedCluster } =
    props;

  // 🎯 닫힘 애니메이션 동안 마지막 선택 항목을 유지하기 위한 상태
  const [renderService, setRenderService] = React.useState<Service | undefined>(service);
  const clearTimerRef = React.useRef<ReturnType<typeof setTimeout>>();
  const prevIsOpenRef = React.useRef(isOpen);

  // 🔄 새로 선택된 리소스가 있으면 즉시 렌더 대상으로 반영
  React.useEffect(() => {
    if (service) {
      setRenderService(service);
    }
  }, [service]);

  // 🔄 패널 열림/닫힘 상태에 따른 렌더 대상 관리
  React.useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    if (!isOpen && wasOpen) {
      clearTimerRef.current = setTimeout(() => {
        setRenderService(undefined);
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

  // ⚠️ Service 객체가 없거나 유효하지 않으면 렌더링하지 않음
  if (!renderService) {
    return null;
  }

  if (!(renderService instanceof Service)) {
    logger.error("[ServiceDetailPanel]: passed object that is not an instanceof Service", renderService);
    return null;
  }

  // 🎯 Service 속성 데이터 추출
  const namespace = renderService.getNs();
  const { spec } = renderService;
  const externalIps = renderService.getExternalIps();
  const selector = renderService.getSelector();
  const externalProtocol = getExternalProtocol(renderService);
  const ports = renderService.getPorts();
  const clusterIps = renderService.getClusterIps();

  // spec.externalName이 있으면 externalIps에 추가
  if (externalIps.length === 0 && spec?.externalName) {
    externalIps.push(spec.externalName);
  }

  // ============================================
  // 🎯 액션 핸들러 함수들 (DetailPanelActionsMenu용)
  // ============================================

  /**
   * Edit 액션: YAML 편집 탭 열기
   */
  const handleEdit = () => {
    createEditResourceTab(renderService);
  };

  /**
   * Delete 액션: Service 삭제 (Confirm Dialog → API 호출)
   */
  const handleDelete = () => {
    openConfirmDialog({
      ok: async () => {
        try {
          await deleteService.delete(renderService, "delete");
          onClose();
        } catch (error) {
          logger.error("[ServiceDetailPanel] Delete failed:", error);
          // 🆕 FIX-038: clusterName metadata 추가
          const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
          notificationPanelStore.addError(
            "network",
            "Error",
            error instanceof Error ? error.message : "Unknown error occurred while deleting service",
            { clusterName },
          );
        }
      },
      labelOk: "Delete",
      message: (
        <p>
          Are you sure you want to delete service <b>{renderService.getName()}</b>?
        </p>
      ),
    });
  };

  return (
    <DetailPanel
      isOpen={isOpen}
      onClose={onClose}
      title={renderService.getName()}
      subtitle={`Namespace: ${namespace}`}
      object={renderService}
      onEdit={handleEdit}
      onDelete={handleDelete}
    >
      {/* ============================================ */}
      {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
      {/* ============================================ */}
      <KubeObjectMetaSection object={renderService} />

      <Separator className="my-6" />

      {/* ============================================ */}
      {/* 📋 Selector 섹션 */}
      {/* ============================================ */}
      {selector && selector.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Selector</h3>
          <div className="flex flex-wrap gap-2">
            {selector.map((label) => (
              <Badge key={label} variant="outline">
                {label}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* 📋 기본 정보 테이블 */}
      {/* ============================================ */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Basic Information</h3>
        <Table>
          <TableBody>
            {/* Type */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px] w-1/3">
                <span className="text-foreground text-sm">Type</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <Badge variant="outline">{spec.type}</Badge>
              </TableCell>
            </TableRow>

            {/* Session Affinity */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px] w-1/3">
                <span className="text-foreground text-sm">Session Affinity</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-sm">{spec.sessionAffinity}</span>
              </TableCell>
            </TableRow>

            {/* Internal Traffic Policy */}
            {spec.internalTrafficPolicy && (
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px] w-1/3">
                  <span className="text-foreground text-sm">Internal Traffic Policy</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-sm">{spec.internalTrafficPolicy}</span>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ============================================ */}
      {/* 📋 Connection 정보 섹션 */}
      {/* ============================================ */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Connection</h3>
        <Table>
          <TableBody>
            {/* Cluster IP */}
            {spec.clusterIP && (
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px] w-1/3">
                  <span className="text-foreground text-sm">Cluster IP</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <code className="text-sm">{spec.clusterIP}</code>
                </TableCell>
              </TableRow>
            )}

            {/* Cluster IPs */}
            {clusterIps.length > 1 && (
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px] w-1/3">
                  <span className="text-foreground text-sm">Cluster IPs</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <div className="flex flex-wrap gap-2">
                    {clusterIps.map((ip) => (
                      <Badge key={ip} variant="outline">
                        {ip}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* IP Family Policy */}
            {renderService.getIpFamilyPolicy() && (
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px] w-1/3">
                  <span className="text-foreground text-sm">IP Family Policy</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-sm">{renderService.getIpFamilyPolicy()}</span>
                </TableCell>
              </TableRow>
            )}

            {/* IP Families */}
            {renderService.getIpFamilies().length > 0 && (
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px] w-1/3">
                  <span className="text-foreground text-sm">IP Families</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-sm">{renderService.getIpFamilies().join(", ")}</span>
                </TableCell>
              </TableRow>
            )}

            {/* External IPs */}
            {externalIps.length > 0 && (
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px] w-1/3">
                  <span className="text-foreground text-sm">External IPs</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <div className="space-y-1">
                    {externalIps.map((ip) => (
                      <div key={ip} className="flex items-center gap-2">
                        {externalProtocol ? (
                          <a
                            href={`${externalProtocol}://${ip}`}
                            rel="noreferrer"
                            target="_blank"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            {ip}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <code className="text-sm">{ip}</code>
                        )}
                      </div>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ============================================ */}
      {/* 📋 Ports 섹션 */}
      {/* ============================================ */}
      {ports.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Ports</h3>
          <div className="space-y-2">
            {ports.map((port, index) => (
              <div key={index} className="border rounded-md p-3 space-y-1">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {port.name && (
                    <div>
                      <span className="font-medium">Name:</span> {port.name}
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Port:</span> {port.port}
                  </div>
                  <div>
                    <span className="font-medium">Protocol:</span> {port.protocol || "TCP"}
                  </div>
                  {port.targetPort !== undefined && (
                    <div>
                      <span className="font-medium">Target Port:</span> {port.targetPort}
                    </div>
                  )}
                  {port.nodePort !== undefined && (
                    <div>
                      <span className="font-medium">Node Port:</span> {port.nodePort}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* 📋 LoadBalancer 정보 섹션 (LoadBalancer 타입일 때만) */}
      {/* ============================================ */}
      {spec.type === "LoadBalancer" && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Load Balancer</h3>
          <Table>
            <TableBody>
              {/* Load Balancer IP */}
              {spec.loadBalancerIP && (
                <TableRow>
                  <TableCell className="border-border border-b px-2 py-[14px] w-1/3">
                    <span className="text-foreground text-sm">Load Balancer IP</span>
                  </TableCell>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <code className="text-sm">{spec.loadBalancerIP}</code>
                  </TableCell>
                </TableRow>
              )}

              {/* Load Balancer Class */}
              {spec.loadBalancerClass && (
                <TableRow>
                  <TableCell className="border-border border-b px-2 py-[14px] w-1/3">
                    <span className="text-foreground text-sm">Load Balancer Class</span>
                  </TableCell>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-sm">{spec.loadBalancerClass}</span>
                  </TableCell>
                </TableRow>
              )}

              {/* External Traffic Policy */}
              {spec.externalTrafficPolicy && (
                <TableRow>
                  <TableCell className="border-border border-b px-2 py-[14px] w-1/3">
                    <span className="text-foreground text-sm">External Traffic Policy</span>
                  </TableCell>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-sm">{spec.externalTrafficPolicy}</span>
                  </TableCell>
                </TableRow>
              )}

              {/* Health Check Node Port */}
              {spec.healthCheckNodePort && (
                <TableRow>
                  <TableCell className="border-border border-b px-2 py-[14px] w-1/3">
                    <span className="text-foreground text-sm">Health Check Node Port</span>
                  </TableCell>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <span className="text-sm">{spec.healthCheckNodePort}</span>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ============================================ */}
      {/* 📋 Events 섹션 */}
      {/* ============================================ */}
      <KubeEventDetailsSection object={renderService} />
    </DetailPanel>
  );
});

/**
 * 🎯 목적: Injectable로 감싼 ServiceDetailPanel 컴포넌트
 */
export const ServiceDetailPanel = withInjectables<Dependencies, ServiceDetailPanelProps>(
  NonInjectedServiceDetailPanel,
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
