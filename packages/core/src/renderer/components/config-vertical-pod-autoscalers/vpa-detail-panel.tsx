/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: VerticalPodAutoscaler 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - shadcn DetailPanel 컴포넌트 사용
 *   - shadcn Table로 메타데이터 표시 (Created, Name, Namespace, Controlled By)
 *   - VpaDetails 로직 재사용 (Status, UpdatePolicy, ResourcePolicy 표시)
 *   - shadcn Badge 컴포넌트 사용
 *   - DetailPanelActionsMenu로 Edit, Delete 액션 제공
 * 🔄 변경이력:
 *   - 2025-11-02: 초기 생성 (shadcn DetailPanel 기반)
 *   - 2025-11-03: shadcn Table로 메타데이터 UI 변경
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 */

import "./vpa-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import {
  ContainerScalingMode,
  ControlledValues,
  ResourceName,
  UpdateMode,
  VerticalPodAutoscaler,
} from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import {
  DetailPanelField,
  DetailPanelFieldGroup,
  DetailPanelSection,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { Separator } from "@skuberplus/storybook-shadcn/src/components/ui/separator";
import { cssNames } from "@skuberplus/utilities";
import startCase from "lodash/startCase";
import { makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import React, { Component } from "react";
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

import type {
  KubeObject,
  PodResourcePolicy,
  PodUpdatePolicy,
  VerticalPodAutoscalerStatus,
} from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { ApiManager } from "../../../common/k8s-api/api-manager";
import type { HostedCluster } from "../../cluster-frame-context/hosted-cluster.injectable";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../dock/dock/store";
import type { GetDetailsUrl } from "../kube-detail-params/get-details-url.injectable";
import type { KubeObjectDeleteService } from "../kube-object-menu/kube-object-delete-service.injectable";

/**
 * 🎯 목적: VpaDetailPanel Props 인터페이스
 */
export interface VpaDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 VerticalPodAutoscaler 객체
   */
  vpa: VerticalPodAutoscaler | undefined;

  /**
   * 패널 닫기 콜백
   */
  onClose: () => void;
}

interface Dependencies {
  apiManager: ApiManager;
  getDetailsUrl: GetDetailsUrl;
  logger: Logger;
  hostedCluster: HostedCluster | undefined;
  createEditResourceTab: (object: KubeObject, tabParams?: DockTabCreateSpecific) => string;
  deleteService: KubeObjectDeleteService;
  openConfirmDialog: OpenConfirmDialog;
}

/**
 * 🎯 목적: VerticalPodAutoscaler 상세 정보 우측 슬라이드 패널 컴포넌트
 */
class NonInjectedVpaDetailPanel extends Component<VpaDetailPanelProps & Dependencies> {
  /**
   * 🎯 닫힘 애니메이션 동안 마지막 선택 항목 유지
   */
  @observable private renderVpa: VerticalPodAutoscaler | undefined;
  private clearTimerRef: ReturnType<typeof setTimeout> | undefined;
  private prevIsOpenRef = true;

  constructor(props: VpaDetailPanelProps & Dependencies) {
    super(props);
    makeObservable(this);
    // 초기값 설정
    this.renderVpa = props.vpa;
  }

  /**
   * 🎯 패널 닫힘 애니메이션 처리 - 데이터 유지
   */
  componentDidUpdate(prevProps: VpaDetailPanelProps & Dependencies) {
    const { isOpen, vpa } = this.props;

    // 새로 선택된 리소스 반영
    if (vpa) {
      this.renderVpa = vpa;
    }

    // 패널 닫힘 애니메이션 처리
    const wasOpen = this.prevIsOpenRef;

    if (!isOpen && wasOpen) {
      this.clearTimerRef = setTimeout(() => {
        this.renderVpa = undefined;
      }, 320);
    }

    if (isOpen && this.clearTimerRef) {
      clearTimeout(this.clearTimerRef);
      this.clearTimerRef = undefined;
    }

    this.prevIsOpenRef = isOpen;
  }

  componentWillUnmount() {
    if (this.clearTimerRef) {
      clearTimeout(this.clearTimerRef);
    }
  }

  /**
   * 🎯 액션 핸들러: Edit 액션 - YAML 편집 탭 열기
   */
  handleEdit = () => {
    const { vpa, createEditResourceTab } = this.props;
    if (vpa) {
      createEditResourceTab(vpa);
    }
  };

  /**
   * 🎯 액션 핸들러: Delete 액션 - VPA 삭제 확인 다이얼로그 표시
   */
  handleDelete = () => {
    const { vpa, hostedCluster, deleteService, onClose, openConfirmDialog } = this.props;
    if (!vpa) return;

    openConfirmDialog({
      ok: async () => {
        try {
          await deleteService.delete(vpa, "delete");
          onClose();
        } catch (error) {
          const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
          notificationPanelStore.addError(
            "operations",
            "Error",
            error instanceof Error ? error.message : "Unknown error occurred while deleting vertical pod autoscaler",
            { clusterName },
          );
        }
      },
      labelOk: "Delete",
      message: (
        <p>
          Are you sure you want to delete vertical pod autoscaler <b>{vpa.getName()}</b>?
        </p>
      ),
    });
  };

  /**
   * 🎯 목적: VPA Status 렌더링 (Container Recommendations 포함)
   */
  renderStatus(status: VerticalPodAutoscalerStatus) {
    const { recommendation } = status;
    const { vpa } = this.props;

    if (!vpa) return null;

    return (
      <div>
        <DetailPanelSection title="Status">
          <DetailPanelField label="Status" className="status">
            {vpa.getReadyConditions().map(({ type, tooltip, isReady }) => (
              <Badge key={type} title={tooltip} className={cssNames({ [type]: isReady })}>
                {type}
              </Badge>
            ))}
          </DetailPanelField>

          {recommendation?.containerRecommendations &&
            recommendation.containerRecommendations.map(
              ({ containerName, target, lowerBound, upperBound, uncappedTarget }) => (
                <div key={containerName}>
                  <DetailPanelSection title={`Container Recommendation for ${containerName ?? "<unknown>"}`}>
                    <DetailPanelField label="target">
                      <DetailPanelFieldGroup>
                        {Object.entries(target).map(([name, value]) => (
                          <DetailPanelField key={name} label={startCase(name)}>
                            {value}
                          </DetailPanelField>
                        ))}
                      </DetailPanelFieldGroup>
                    </DetailPanelField>
                    {lowerBound && (
                      <DetailPanelField label="lowerBound">
                        <DetailPanelFieldGroup>
                          {Object.entries(lowerBound).map(([name, value]) => (
                            <DetailPanelField key={name} label={startCase(name)}>
                              {value}
                            </DetailPanelField>
                          ))}
                        </DetailPanelFieldGroup>
                      </DetailPanelField>
                    )}
                    {upperBound && (
                      <DetailPanelField label="upperBound">
                        <DetailPanelFieldGroup>
                          {Object.entries(upperBound).map(([name, value]) => (
                            <DetailPanelField key={name} label={startCase(name)}>
                              {value}
                            </DetailPanelField>
                          ))}
                        </DetailPanelFieldGroup>
                      </DetailPanelField>
                    )}
                    {uncappedTarget && (
                      <DetailPanelField label="uncappedTarget">
                        <DetailPanelFieldGroup>
                          {Object.entries(uncappedTarget).map(([name, value]) => (
                            <DetailPanelField key={name} label={startCase(name)}>
                              {value}
                            </DetailPanelField>
                          ))}
                        </DetailPanelFieldGroup>
                      </DetailPanelField>
                    )}
                  </DetailPanelSection>
                </div>
              ),
            )}
        </DetailPanelSection>
      </div>
    );
  }

  /**
   * 🎯 목적: Update Policy 렌더링
   */
  renderUpdatePolicy(updatePolicy: PodUpdatePolicy) {
    return (
      <DetailPanelSection title="Update Policy">
        <DetailPanelFieldGroup>
          <DetailPanelField label="updateMode">
            {updatePolicy?.updateMode ?? UpdateMode.UpdateModeAuto}
          </DetailPanelField>
          <DetailPanelField label="minReplicas">{updatePolicy?.minReplicas}</DetailPanelField>
        </DetailPanelFieldGroup>
      </DetailPanelSection>
    );
  }

  /**
   * 🎯 목적: Resource Policy 렌더링 (Container Policies)
   */
  renderResourcePolicy(resourcePolicy: PodResourcePolicy) {
    return (
      <div>
        {resourcePolicy.containerPolicies && (
          <div>
            {resourcePolicy.containerPolicies.map(
              ({ containerName, mode, minAllowed, maxAllowed, controlledResources, controlledValues }) => {
                return (
                  <div key={containerName}>
                    <DetailPanelSection title={`Container Policy for ${containerName ?? "<unknown>"}`}>
                      <DetailPanelFieldGroup>
                        <DetailPanelField label="mode">
                          {mode ?? ContainerScalingMode.ContainerScalingModeAuto}
                        </DetailPanelField>
                        {minAllowed && (
                          <DetailPanelField label="minAllowed">
                            <DetailPanelFieldGroup>
                              {Object.entries(minAllowed).map(([name, value]) => (
                                <DetailPanelField key={name} label={startCase(name)}>
                                  {value}
                                </DetailPanelField>
                              ))}
                            </DetailPanelFieldGroup>
                          </DetailPanelField>
                        )}
                        {maxAllowed && (
                          <DetailPanelField label="maxAllowed">
                            <DetailPanelFieldGroup>
                              {Object.entries(maxAllowed).map(([name, value]) => (
                                <DetailPanelField key={name} label={startCase(name)}>
                                  {value}
                                </DetailPanelField>
                              ))}
                            </DetailPanelFieldGroup>
                          </DetailPanelField>
                        )}
                        <DetailPanelField label="controlledResources">
                          {controlledResources?.length
                            ? controlledResources.join(", ")
                            : `${ResourceName.ResourceCPU}, ${ResourceName.ResourceMemory}`}
                        </DetailPanelField>
                        <DetailPanelField label="controlledValues">
                          {controlledValues ?? ControlledValues.ControlledValueRequestsAndLimits}
                        </DetailPanelField>
                      </DetailPanelFieldGroup>
                    </DetailPanelSection>
                  </div>
                );
              },
            )}
          </div>
        )}
      </div>
    );
  }

  render() {
    const { isOpen, onClose, apiManager, getDetailsUrl, logger } = this.props;

    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목 유지
    const vpa = this.renderVpa;

    if (!vpa) {
      return null;
    }

    if (!(vpa instanceof VerticalPodAutoscaler)) {
      logger.error("[VpaDetailPanel]: passed object that is not an instanceof VerticalPodAutoscaler", vpa);
      return null;
    }

    const { targetRef, recommenders, resourcePolicy, updatePolicy } = vpa.spec;
    const namespace = vpa.getNs();

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={vpa.getName()}
        subtitle={`Namespace: ${namespace}`}
        object={vpa}
        onEdit={this.handleEdit}
        onDelete={this.handleDelete}
      >
        {/* ============================================ */}
        {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
        {/* ============================================ */}
        <KubeObjectMetaSection object={vpa} />

        <Separator className="my-6" />

        <div className="VpaDetails">
          <DetailPanelFieldGroup>
            <DetailPanelField label="Reference">
              {targetRef && (
                <Link to={getDetailsUrl(apiManager.lookupApiLink(targetRef, vpa))}>
                  {targetRef.kind}/{targetRef.name}
                </Link>
              )}
            </DetailPanelField>

            <DetailPanelField label="Recommender">
              {
                /* according to the spec there can be 0 or 1 recommenders, only */
                recommenders?.length ? recommenders[0].name : "default"
              }
            </DetailPanelField>
          </DetailPanelFieldGroup>

          {vpa.status && this.renderStatus(vpa.status)}
          {updatePolicy && this.renderUpdatePolicy(updatePolicy)}
          {resourcePolicy && this.renderResourcePolicy(resourcePolicy)}

          <DetailPanelSection title="CRD details">
            <div />
          </DetailPanelSection>
        </div>

        {/* ============================================ */}
        {/* 📋 Events 섹션 */}
        {/* ============================================ */}
        <KubeEventDetailsSection object={vpa} />
      </DetailPanel>
    );
  }
}

/**
 * DI 패턴 적용된 VPA Detail Panel
 */
export const VpaDetailPanel = withInjectables<Dependencies, VpaDetailPanelProps>(observer(NonInjectedVpaDetailPanel), {
  getProps: (di, props) => ({
    ...props,
    apiManager: di.inject(apiManagerInjectable),
    getDetailsUrl: di.inject(getDetailsUrlInjectable),
    logger: di.inject(loggerInjectionToken),
    hostedCluster: di.inject(hostedClusterInjectable),
    createEditResourceTab: di.inject(createEditResourceTabInjectable),
    deleteService: di.inject(kubeObjectDeleteServiceInjectable),
    openConfirmDialog: di.inject(openConfirmDialogInjectable),
  }),
});
