/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Network Policy 상세 정보를 우측 슬라이드 패널로 표시
 *
 * 📱 반응형 디자인:
 * - 모바일 (<640px): 전체 너비
 * - 태블릿 (≥640px): 600px 고정
 * - 데스크톱 (≥768px): 700px 고정
 *
 * 📝 주의사항:
 *   - shadcn UI 컴포넌트 (Table, Badge) 사용
 *   - 슬라이드 인/아웃 애니메이션 적용
 *   - Ingress/Egress Rules 표시
 *   - DetailPanelActionsMenu로 Edit, Delete 액션 제공
 *
 * 🔄 변경이력:
 *   - 2025-10-30: 초기 생성 (Pod 반응형 패턴 적용)
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 *   - 2025-12-01: 닫힘 애니메이션 중 데이터 유지 패턴 적용
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { NetworkPolicy } from "@skuberplus/kube-object";
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

import type {
  KubeObject,
  LabelSelector,
  NetworkPolicyPeer,
  NetworkPolicyPort,
  PolicyIpBlock,
} from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { Cluster } from "../../../common/cluster/cluster";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../dock/dock/store";
import type { KubeObjectDeleteService } from "../kube-object-menu/kube-object-delete-service.injectable";

export interface NetworkPolicyDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 Network Policy 객체
   */
  networkPolicy: NetworkPolicy | undefined;

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
 * Network Policy 상세 정보 우측 슬라이드 패널 컴포넌트
 *
 * @param isOpen - 패널 열림/닫힘 상태
 * @param networkPolicy - 표시할 Network Policy 객체
 * @param onClose - 패널 닫기 콜백
 */
const NonInjectedNetworkPolicyDetailPanel = observer(
  ({
    isOpen,
    networkPolicy,
    onClose,
    logger,
    createEditResourceTab,
    deleteService,
    openConfirmDialog,
    hostedCluster,
  }: NetworkPolicyDetailPanelProps & Dependencies) => {
    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목을 유지하기 위한 상태
    const [renderNetworkPolicy, setRenderNetworkPolicy] = React.useState<NetworkPolicy | undefined>(networkPolicy);
    const clearTimerRef = React.useRef<ReturnType<typeof setTimeout>>();
    const prevIsOpenRef = React.useRef(isOpen);

    // 🔄 새로 선택된 리소스가 있으면 즉시 렌더 대상으로 반영
    React.useEffect(() => {
      if (networkPolicy) {
        setRenderNetworkPolicy(networkPolicy);
      }
    }, [networkPolicy]);

    // 🔄 패널 열림/닫힘 상태에 따른 렌더 대상 관리
    React.useEffect(() => {
      const wasOpen = prevIsOpenRef.current;
      if (!isOpen && wasOpen) {
        clearTimerRef.current = setTimeout(() => {
          setRenderNetworkPolicy(undefined);
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

    // ⚠️ Network Policy 객체가 없거나 유효하지 않으면 렌더링하지 않음
    if (!renderNetworkPolicy) {
      return null;
    }

    if (!(renderNetworkPolicy instanceof NetworkPolicy)) {
      logger.error(
        "[NetworkPolicyDetailPanel]: passed object that is not an instanceof NetworkPolicy",
        renderNetworkPolicy,
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
      createEditResourceTab(renderNetworkPolicy);
    };

    /**
     * Delete 액션: NetworkPolicy 삭제
     */
    const handleDelete = () => {
      openConfirmDialog({
        ok: async () => {
          try {
            await deleteService.delete(renderNetworkPolicy, "delete");
            onClose();
          } catch (error) {
            // 🆕 FIX-038: clusterName metadata 추가
            const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
            notificationPanelStore.addError(
              "network",
              "Error",
              error instanceof Error ? error.message : "Unknown error occurred while deleting network policy",
              { clusterName },
            );
          }
        },
        labelOk: "Delete",
        message: (
          <p>
            Are you sure you want to delete network policy <b>{renderNetworkPolicy.getName()}</b>?
          </p>
        ),
      });
    };

    // 🎯 Network Policy 속성 데이터 추출
    const { spec } = renderNetworkPolicy;
    const namespace = renderNetworkPolicy.getNs();
    const types = renderNetworkPolicy.getTypes();
    const { podSelector, ingress = [], egress = [] } = spec ?? {};

    /**
     * 🎯 목적: Label Selector 렌더링
     */
    const renderLabelSelector = (selector: LabelSelector | undefined) => {
      if (!selector) {
        return <span className="text-muted-foreground">All pods in namespace</span>;
      }

      const { matchLabels, matchExpressions } = selector;

      return (
        <div className="space-y-2">
          {/* Match Labels */}
          {matchLabels && Object.keys(matchLabels).length > 0 && (
            <div>
              <span className="text-sm font-medium">Match Labels:</span>
              <ul className="mt-1 space-y-1 list-disc list-inside">
                {Object.entries(matchLabels).map(([key, value]) => (
                  <li key={key} className="text-sm">
                    {key}: {value ?? ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Match Expressions */}
          {matchExpressions && matchExpressions.length > 0 && (
            <div>
              <span className="text-sm font-medium">Match Expressions:</span>
              <ul className="mt-1 space-y-1 list-disc list-inside">
                {matchExpressions.map((expr, index) => (
                  <li key={index} className="text-sm">
                    {expr.key} ({expr.operator})
                    {(expr.operator === "In" || expr.operator === "NotIn") && expr.values && (
                      <span>: {expr.values.join(", ")}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    };

    /**
     * 🎯 목적: IP Block 렌더링
     */
    const renderIpBlock = (ipBlock: PolicyIpBlock | undefined) => {
      if (!ipBlock || !ipBlock.cidr) {
        return null;
      }

      const { cidr, except = [] } = ipBlock;

      return (
        <div className="text-sm">
          <span className="font-medium">CIDR:</span> {cidr}
          {except.length > 0 && (
            <div>
              <span className="font-medium">Except:</span> {except.join(", ")}
            </div>
          )}
        </div>
      );
    };

    /**
     * 🎯 목적: Network Policy Peer 렌더링
     */
    const renderPeer = (peer: NetworkPolicyPeer | undefined) => {
      if (!peer) {
        return null;
      }

      return (
        <div className="space-y-2">
          {peer.podSelector && (
            <div>
              <span className="text-sm font-medium">Pod Selector:</span>
              <div className="mt-1">{renderLabelSelector(peer.podSelector)}</div>
            </div>
          )}
          {peer.namespaceSelector && (
            <div>
              <span className="text-sm font-medium">Namespace Selector:</span>
              <div className="mt-1">{renderLabelSelector(peer.namespaceSelector)}</div>
            </div>
          )}
          {peer.ipBlock && (
            <div>
              <span className="text-sm font-medium">IP Block:</span>
              <div className="mt-1">{renderIpBlock(peer.ipBlock)}</div>
            </div>
          )}
        </div>
      );
    };

    /**
     * 🎯 목적: Network Policy Port 렌더링
     */
    const renderPort = (port: NetworkPolicyPort) => {
      return (
        <div className="text-sm">
          <span className="font-medium">Protocol:</span> {port.protocol ?? "TCP"}
          {port.port && (
            <>
              {" | "}
              <span className="font-medium">Port:</span> {String(port.port)}
            </>
          )}
        </div>
      );
    };

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={renderNetworkPolicy.getName()}
        subtitle={`Namespace: ${namespace}`}
        width="w-full md:w-[700px]"
        object={renderNetworkPolicy}
        onEdit={handleEdit}
        onDelete={handleDelete}
      >
        {/* ============================================ */}
        {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
        {/* ============================================ */}
        <KubeObjectMetaSection object={renderNetworkPolicy} />

        <Separator className="my-6" />
        {/* ============================================ */}
        {/* 📋 기본 정보 테이블 */}
        {/* ============================================ */}
        <div>
          <h3 className="mb-3 text-sm font-semibold">Basic Information</h3>
          <Table>
            <TableBody>
              {/* Policy Types */}
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px] w-1/3">
                  <span className="text-foreground text-sm">Policy Types</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <div className="flex gap-2">
                    {types.map((type) => (
                      <Badge key={type} variant="outline">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
              </TableRow>

              {/* Pod Selector */}
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px] w-1/3">
                  <span className="text-foreground text-sm">Pod Selector</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  {renderLabelSelector(podSelector)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* ============================================ */}
        {/* 📋 Ingress Rules */}
        {/* ============================================ */}
        {types.includes("Ingress") && (
          <div>
            <h3 className="mb-3 text-sm font-semibold">Ingress Rules</h3>
            {ingress.length === 0 ? (
              <div className="text-sm text-muted-foreground">No ingress rules defined</div>
            ) : (
              <div className="space-y-4">
                {ingress.map((rule, index) => (
                  <div key={index} className="border rounded-md p-3 space-y-2">
                    <div className="font-medium text-sm">Rule {index + 1}</div>

                    {/* Ports */}
                    {rule.ports && rule.ports.length > 0 && (
                      <div>
                        <span className="text-sm font-medium">Ports:</span>
                        <div className="mt-1 space-y-1">
                          {rule.ports.map((port, portIndex) => (
                            <div key={portIndex}>{renderPort(port)}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* From (Peers) */}
                    {rule.from && rule.from.length > 0 && (
                      <div>
                        <span className="text-sm font-medium">From:</span>
                        <div className="mt-1 space-y-2">
                          {rule.from.map((peer, peerIndex) => (
                            <div key={peerIndex} className="pl-2 border-l-2">
                              {renderPeer(peer)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================ */}
        {/* 📋 Egress Rules */}
        {/* ============================================ */}
        {types.includes("Egress") && (
          <div>
            <h3 className="mb-3 text-sm font-semibold">Egress Rules</h3>
            {egress.length === 0 ? (
              <div className="text-sm text-muted-foreground">No egress rules defined</div>
            ) : (
              <div className="space-y-4">
                {egress.map((rule, index) => (
                  <div key={index} className="border rounded-md p-3 space-y-2">
                    <div className="font-medium text-sm">Rule {index + 1}</div>

                    {/* Ports */}
                    {rule.ports && rule.ports.length > 0 && (
                      <div>
                        <span className="text-sm font-medium">Ports:</span>
                        <div className="mt-1 space-y-1">
                          {rule.ports.map((port, portIndex) => (
                            <div key={portIndex}>{renderPort(port)}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* To (Peers) */}
                    {rule.to && rule.to.length > 0 && (
                      <div>
                        <span className="text-sm font-medium">To:</span>
                        <div className="mt-1 space-y-2">
                          {rule.to.map((peer, peerIndex) => (
                            <div key={peerIndex} className="pl-2 border-l-2">
                              {renderPeer(peer)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================ */}
        {/* 📋 Events 섹션 */}
        {/* ============================================ */}
        <KubeEventDetailsSection object={renderNetworkPolicy} />
      </DetailPanel>
    );
  },
);

/**
 * 🎯 목적: Injectable로 감싼 NetworkPolicyDetailPanel 컴포넌트
 */
export const NetworkPolicyDetailPanel = withInjectables<Dependencies, NetworkPolicyDetailPanelProps>(
  NonInjectedNetworkPolicyDetailPanel,
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
