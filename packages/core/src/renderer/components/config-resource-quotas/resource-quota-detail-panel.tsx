/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: ResourceQuota 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - shadcn DetailPanel 컴포넌트 사용
 *   - shadcn Table로 메타데이터 표시 (Created, Name, Namespace, Controlled By)
 *   - ResourceQuotaDetails 로직 재사용 (Quotas, Scope Selector 표시)
 *   - shadcn Table 컴포넌트 사용
 *   - DetailPanelActionsMenu로 Edit, Delete 액션 제공
 * 🔄 변경이력:
 *   - 2025-11-02: 초기 생성 (shadcn DetailPanel 기반)
 *   - 2025-11-03: shadcn Table로 메타데이터 UI 변경
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 */

import "./resource-quota-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { ResourceQuota } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@skuberplus/storybook-shadcn";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import {
  DetailPanelField,
  DetailPanelSection,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { Separator } from "@skuberplus/storybook-shadcn/src/components/ui/separator";
import {
  cpuUnitsToNumber,
  cssNames,
  hasDefinedTupleValue,
  metricUnitsToNumber,
  object,
  unitsToBytes,
} from "@skuberplus/utilities";
import kebabCase from "lodash/kebabCase";
import { makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import React, { Component } from "react";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { DetailPanel } from "../common/detail-panel";
import openConfirmDialogInjectable from "../confirm-dialog/open.injectable";
import createEditResourceTabInjectable from "../dock/edit-resource/edit-resource-tab.injectable";
import { KubeEventDetailsSection } from "../kube-object-details/kube-event-details-section";
import { KubeObjectMetaSection } from "../kube-object-details/kube-object-meta-section";
import kubeObjectDeleteServiceInjectable from "../kube-object-menu/kube-object-delete-service.injectable";
import { LineProgress } from "../line-progress";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";

import type { KubeObject } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { HostedCluster } from "../../cluster-frame-context/hosted-cluster.injectable";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../dock/dock/store";
import type { KubeObjectDeleteService } from "../kube-object-menu/kube-object-delete-service.injectable";

/**
 * 🎯 목적: ResourceQuotaDetailPanel Props 인터페이스
 */
export interface ResourceQuotaDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 ResourceQuota 객체
   */
  quota: ResourceQuota | undefined;

  /**
   * 패널 닫기 콜백
   */
  onClose: () => void;
}

interface Dependencies {
  logger: Logger;
  // 🆕 FIX-038: hostedCluster DI 추가
  hostedCluster: HostedCluster | undefined;
  createEditResourceTab: (object: KubeObject, tabParams?: DockTabCreateSpecific) => string;
  deleteService: KubeObjectDeleteService;
  openConfirmDialog: OpenConfirmDialog;
}

/**
 * 🎯 목적: 리소스 단위 변환 (bytes, CPU units, metric units)
 */
function transformUnit(name: string, value: string): number | undefined {
  if (name.includes("memory") || name.includes("storage")) {
    return unitsToBytes(value);
  }

  if (name.includes("cpu")) {
    return cpuUnitsToNumber(value);
  }

  return metricUnitsToNumber(value);
}

/**
 * 🎯 목적: Quota 항목 렌더링 (LineProgress 포함)
 */
function renderQuotas(quota: ResourceQuota): JSX.Element[] {
  const { hard = {}, used = {} } = quota.status ?? {};

  return object
    .entries(hard)
    .filter(hasDefinedTupleValue)
    .map(([name, rawMax]) => {
      const rawCurrent = used[name] ?? "0";
      const current = transformUnit(name, rawCurrent);
      const max = transformUnit(name, rawMax);

      if (current === undefined || max === undefined) {
        return (
          <div key={name} className={cssNames("param", kebabCase(name))}>
            <span className="title">{name}</span>
            <Badge variant="secondary">{`${rawCurrent} / ${rawMax}`}</Badge>
          </div>
        );
      }

      const usage =
        max === 0
          ? 100 // special case 0 max as always 100% usage
          : (current / max) * 100;

      return (
        <div key={name} className={cssNames("param", kebabCase(name))}>
          <span className="title">{name}</span>
          <Badge variant="secondary">{`${rawCurrent} / ${rawMax}`}</Badge>
          <LineProgress max={max} value={current} tooltip={<p>{`Set: ${rawMax}. Usage: ${+usage.toFixed(2)}%`}</p>} />
        </div>
      );
    });
}

/**
 * 🎯 목적: ResourceQuota 상세 정보 우측 슬라이드 패널 컴포넌트
 */
class NonInjectedResourceQuotaDetailPanel extends Component<ResourceQuotaDetailPanelProps & Dependencies> {
  /**
   * 🎯 닫힘 애니메이션 동안 마지막 선택 항목 유지
   */
  @observable private renderQuota: ResourceQuota | undefined;
  private clearTimerRef: ReturnType<typeof setTimeout> | undefined;
  private prevIsOpenRef = true;

  constructor(props: ResourceQuotaDetailPanelProps & Dependencies) {
    super(props);
    makeObservable(this);
    // 초기값 설정
    this.renderQuota = props.quota;
  }

  /**
   * 🎯 패널 닫힘 애니메이션 처리 - 데이터 유지
   */
  componentDidUpdate(prevProps: ResourceQuotaDetailPanelProps & Dependencies) {
    const { isOpen, quota } = this.props;

    // 새로 선택된 리소스 반영
    if (quota) {
      this.renderQuota = quota;
    }

    // 패널 닫힘 애니메이션 처리
    const wasOpen = this.prevIsOpenRef;

    if (!isOpen && wasOpen) {
      this.clearTimerRef = setTimeout(() => {
        this.renderQuota = undefined;
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
    const { quota, createEditResourceTab } = this.props;
    if (quota) {
      createEditResourceTab(quota);
    }
  };

  /**
   * 🎯 액션 핸들러: Delete 액션 - ResourceQuota 삭제
   */
  handleDelete = () => {
    const { quota, deleteService, onClose, openConfirmDialog } = this.props;
    if (!quota) return;

    openConfirmDialog({
      ok: async () => {
        try {
          await deleteService.delete(quota, "delete");
          onClose();
        } catch (error) {
          // 🆕 FIX-038: clusterName 추가
          const clusterName = this.props.hostedCluster?.name.get() ?? "Unknown Cluster";
          notificationPanelStore.addError(
            "operations",
            "Error",
            error instanceof Error ? error.message : "Unknown error occurred while deleting resource quota",
            { clusterName },
          );
        }
      },
      labelOk: "Delete",
      message: (
        <p>
          Are you sure you want to delete resource quota <b>{quota.getName()}</b>?
        </p>
      ),
    });
  };

  render() {
    const { isOpen, onClose, logger } = this.props;

    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목 유지
    const quota = this.renderQuota;

    if (!quota) {
      return null;
    }

    if (!(quota instanceof ResourceQuota)) {
      logger.error("[ResourceQuotaDetailPanel]: passed object that is not an instanceof ResourceQuota", quota);
      return null;
    }

    const namespace = quota.getNs();

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={quota.getName()}
        subtitle={`Namespace: ${namespace}`}
        object={quota}
        onEdit={this.handleEdit}
        onDelete={this.handleDelete}
      >
        {/* ============================================ */}
        {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
        {/* ============================================ */}
        <KubeObjectMetaSection object={quota} />

        <Separator className="my-6" />

        <div className="ResourceQuotaDetails">
          <DetailPanelField label="Quotas" className="quota-list">
            {renderQuotas(quota)}
          </DetailPanelField>

          {quota.getScopeSelector().length > 0 && (
            <DetailPanelSection title="Scope Selector">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operator</TableHead>
                    <TableHead>Scope name</TableHead>
                    <TableHead>Values</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quota.getScopeSelector().map((selector, index) => {
                    const { operator, scopeName, values } = selector;

                    return (
                      <TableRow key={index}>
                        <TableCell>{operator}</TableCell>
                        <TableCell>{scopeName}</TableCell>
                        <TableCell>{values.join(", ")}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </DetailPanelSection>
          )}
        </div>

        <Separator className="my-6" />

        {/* ============================================ */}
        {/* 📋 Events 섹션 */}
        {/* ============================================ */}
        <KubeEventDetailsSection object={quota} />
      </DetailPanel>
    );
  }
}

/**
 * DI 패턴 적용된 ResourceQuota Detail Panel
 */
export const ResourceQuotaDetailPanel = withInjectables<Dependencies, ResourceQuotaDetailPanelProps>(
  observer(NonInjectedResourceQuotaDetailPanel),
  {
    getProps: (di, props) => ({
      ...props,
      logger: di.inject(loggerInjectionToken),
      // 🆕 FIX-038: hostedCluster DI 추가
      hostedCluster: di.inject(hostedClusterInjectable),
      createEditResourceTab: di.inject(createEditResourceTabInjectable),
      deleteService: di.inject(kubeObjectDeleteServiceInjectable),
      openConfirmDialog: di.inject(openConfirmDialogInjectable),
    }),
  },
);
