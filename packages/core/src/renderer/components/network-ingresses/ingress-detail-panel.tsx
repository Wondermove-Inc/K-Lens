/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Ingress 상세 정보를 우측 슬라이드 패널로 표시
 *
 * 📱 반응형 디자인:
 * - 모바일 (<640px): 전체 너비
 * - 태블릿 (≥640px): 600px 고정
 * - 데스크톱 (≥768px): 700px 고정
 *
 * 📝 주의사항:
 *   - shadcn UI 컴포넌트 (Table, Badge) 사용
 *   - 슬라이드 인/아웃 애니메이션 적용
 *   - Rules(Paths), TLS, LoadBalancer Ingress Points 정보 표시
 *   - DetailPanelActionsMenu로 Edit, Delete 액션 제공
 *
 * 🔄 변경이력:
 *   - 2025-10-30: 초기 생성 (Pod 반응형 패턴 적용)
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 *   - 2025-12-01: 닫힘 애니메이션 중 데이터 유지 패턴 적용
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { computeRuleDeclarations, Ingress } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Table, TableBody, TableCell, TableHead, TableRow } from "@skuberplus/storybook-shadcn";
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
import { IngressMetricsDetailsComponent } from "./metrics-details-component";

import type { ILoadBalancerIngress, KubeObject } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { Cluster } from "../../../common/cluster/cluster";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../dock/dock/store";
import type { KubeObjectDeleteService } from "../kube-object-menu/kube-object-delete-service.injectable";

export interface IngressDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 Ingress 객체
   */
  ingress: Ingress | undefined;

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
 * Ingress 상세 정보 우측 슬라이드 패널 컴포넌트
 *
 * @param isOpen - 패널 열림/닫힘 상태
 * @param ingress - 표시할 Ingress 객체
 * @param onClose - 패널 닫기 콜백
 */
const NonInjectedIngressDetailPanel = observer(
  ({
    isOpen,
    ingress,
    onClose,
    logger,
    createEditResourceTab,
    deleteService,
    openConfirmDialog,
    hostedCluster,
  }: IngressDetailPanelProps & Dependencies) => {
    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목을 유지하기 위한 상태
    const [renderIngress, setRenderIngress] = React.useState<Ingress | undefined>(ingress);
    const clearTimerRef = React.useRef<ReturnType<typeof setTimeout>>();
    const prevIsOpenRef = React.useRef(isOpen);

    // 🔄 새로 선택된 리소스가 있으면 즉시 렌더 대상으로 반영
    React.useEffect(() => {
      if (ingress) {
        setRenderIngress(ingress);
      }
    }, [ingress]);

    // 🔄 패널 열림/닫힘 상태에 따른 렌더 대상 관리
    React.useEffect(() => {
      const wasOpen = prevIsOpenRef.current;
      if (!isOpen && wasOpen) {
        clearTimerRef.current = setTimeout(() => {
          setRenderIngress(undefined);
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

    // ⚠️ Ingress 객체가 없거나 유효하지 않으면 렌더링하지 않음
    if (!renderIngress) {
      return null;
    }

    if (!(renderIngress instanceof Ingress)) {
      logger.error("[IngressDetailPanel]: passed object that is not an instanceof Ingress", renderIngress);
      return null;
    }

    // ============================================
    // 🎯 액션 핸들러 함수들 (DetailPanelActionsMenu용)
    // ============================================

    /**
     * Edit 액션: YAML 편집 탭 열기
     */
    const handleEdit = () => {
      createEditResourceTab(renderIngress);
    };

    /**
     * Delete 액션: Ingress 삭제
     */
    const handleDelete = () => {
      openConfirmDialog({
        ok: async () => {
          try {
            await deleteService.delete(renderIngress, "delete");
            onClose();
          } catch (error) {
            // 🆕 FIX-038: clusterName metadata 추가
            const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
            notificationPanelStore.addError(
              "network",
              "Error",
              error instanceof Error ? error.message : "Unknown error occurred while deleting ingress",
              { clusterName },
            );
          }
        },
        labelOk: "Delete",
        message: (
          <p>
            Are you sure you want to delete ingress <b>{renderIngress.getName()}</b>?
          </p>
        ),
      });
    };

    // 🎯 Ingress 속성 데이터 추출
    const namespace = renderIngress.getNs();
    const { spec } = renderIngress;
    const port = renderIngress.getServiceNamePort();
    const ingressPoints = renderIngress.status?.loadBalancer?.ingress ?? [];

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={renderIngress.getName()}
        subtitle={`Namespace: ${namespace}`}
        width="w-full md:w-[700px]"
        metricsComponent={<IngressMetricsDetailsComponent object={renderIngress} />}
        object={renderIngress}
        onEdit={handleEdit}
        onDelete={handleDelete}
      >
        {/* ============================================ */}
        {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
        {/* ============================================ */}
        <KubeObjectMetaSection object={renderIngress} />

        <Separator className="my-6" />

        {/* ============================================ */}
        {/* 📋 기본 정보 섹션 */}
        {/* ============================================ */}
        <div>
          <h3 className="mb-3 text-sm font-semibold">Basic Information</h3>
          <Table>
            <TableBody>
              {/* Ports */}
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px] w-1/3">
                  <span className="text-foreground text-sm">Ports</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-sm">{renderIngress.getPorts()}</span>
                </TableCell>
              </TableRow>

              {/* Service */}
              {port && (
                <TableRow>
                  <TableCell className="border-border border-b px-2 py-[14px] w-1/3">
                    <span className="text-foreground text-sm">Service</span>
                  </TableCell>
                  <TableCell className="border-border border-b px-2 py-[14px]">
                    <code className="text-sm">{`${port.serviceName}:${port.servicePort}`}</code>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* ============================================ */}
        {/* 📋 TLS 섹션 */}
        {/* ============================================ */}
        {spec.tls && spec.tls.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold">TLS</h3>
            <div className="space-y-2">
              {spec.tls.map((tls, index) => (
                <div key={index} className="border rounded-md p-3">
                  <div className="text-sm">
                    <span className="font-medium">Secret Name:</span> {tls.secretName}
                  </div>
                  {"hosts" in tls && Array.isArray(tls.hosts) && tls.hosts.length > 0 && (
                    <div className="mt-2 text-sm">
                      <span className="font-medium">Hosts:</span>
                      <ul className="mt-1 space-y-1 list-disc list-inside">
                        {tls.hosts.map((host: string, hostIndex: number) => (
                          <li key={hostIndex}>{host}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* 📋 Rules 섹션 */}
        {/* ============================================ */}
        <div>
          <h3 className="mb-3 text-sm font-semibold">Rules</h3>
          <div className="space-y-4">
            {renderIngress.getRules().map((rule, index) => (
              <div key={index} className="border rounded-md p-3 space-y-2">
                {/* Host */}
                {rule.host && (
                  <div className="font-medium text-sm">
                    Host: <code className="text-xs">{rule.host}</code>
                  </div>
                )}

                {/* Paths Table */}
                {rule.http && (
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell className="border-border border-b px-2 py-2 text-xs font-semibold">Path</TableCell>
                        <TableCell className="border-border border-b px-2 py-2 text-xs font-semibold">Link</TableCell>
                        <TableCell className="border-border border-b px-2 py-2 text-xs font-semibold">
                          Backends
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {computeRuleDeclarations(renderIngress, rule).map(
                        ({ displayAsLink, service, url, pathname }, pathIndex) => (
                          <TableRow key={pathIndex}>
                            <TableCell className="border-border border-b px-2 py-2">
                              <code className="text-xs">{pathname}</code>
                            </TableCell>
                            <TableCell className="border-border border-b px-2 py-2">
                              {displayAsLink ? (
                                <a
                                  href={url}
                                  rel="noreferrer"
                                  target="_blank"
                                  className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
                                >
                                  {url}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span className="text-xs">{url}</span>
                              )}
                            </TableCell>
                            <TableCell className="border-border border-b px-2 py-2">
                              <span className="text-xs">{service}</span>
                            </TableCell>
                          </TableRow>
                        ),
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ============================================ */}
        {/* 📋 Load-Balancer Ingress Points 섹션 */}
        {/* ============================================ */}
        {ingressPoints.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold">Load-Balancer Ingress Points</h3>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell className="border-border border-b px-2 py-2 text-xs font-semibold">Hostname</TableCell>
                  <TableCell className="border-border border-b px-2 py-2 text-xs font-semibold">IP</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ingressPoints.map((point: ILoadBalancerIngress, index: number) => (
                  <TableRow key={index}>
                    <TableCell className="border-border border-b px-2 py-2">
                      <span className="text-sm">{point.hostname || "-"}</span>
                    </TableCell>
                    <TableCell className="border-border border-b px-2 py-2">
                      <code className="text-sm">{point.ip || "-"}</code>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* ============================================ */}
        {/* 📋 Events 섹션 */}
        {/* ============================================ */}
        <KubeEventDetailsSection object={renderIngress} />
      </DetailPanel>
    );
  },
);

/**
 * 🎯 목적: Injectable로 감싼 IngressDetailPanel 컴포넌트
 */
export const IngressDetailPanel = withInjectables<Dependencies, IngressDetailPanelProps>(
  NonInjectedIngressDetailPanel,
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
