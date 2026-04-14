/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: CustomResource 상세 정보를 우측 슬라이드 패널로 표시
 *
 * 📝 주의사항:
 * - shadcn DetailPanel 컴포넌트 사용
 * - CRD의 printerColumns 기반 동적 속성 테이블
 * - MobX observable 데이터 관리
 * - YAML 읽기 전용 표시
 *
 * 🔄 변경이력:
 * - 2025-12-17: 초기 생성 (CustomResourceDefinitionDetailPanel 패턴 기반)
 * - 2026-01-29: YAML 편집 기능 제거, 읽기 전용으로 변경
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Table, TableBody, TableCell, TableRow } from "@skuberplus/storybook-shadcn";
import { Separator } from "@skuberplus/storybook-shadcn/src/components/ui/separator";
import { formatJSONValue, safeJSONPathValue } from "@skuberplus/utilities";
import yaml from "js-yaml";
import { startCase } from "lodash/fp";
import { makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import React, { Component } from "react";
import { defaultYamlDumpOptions } from "../../../common/kube-helpers";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { DetailPanel } from "../common/detail-panel";
import openConfirmDialogInjectable from "../confirm-dialog/open.injectable";
import createEditResourceTabInjectable from "../dock/edit-resource/edit-resource-tab.injectable";
import { KubeEventDetailsSection } from "../kube-object-details/kube-event-details-section";
import { KubeObjectMetaSection } from "../kube-object-details/kube-object-meta-section";
import kubeObjectDeleteServiceInjectable from "../kube-object-menu/kube-object-delete-service.injectable";
import { MonacoEditor } from "../monaco-editor";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";

import type { CustomResourceDefinition, KubeObject } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { HostedCluster } from "../../cluster-frame-context/hosted-cluster.injectable";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../dock/dock/store";
import type { KubeObjectDeleteService } from "../kube-object-menu/kube-object-delete-service.injectable";

/**
 * 🎯 목적: CustomResourceDetailPanel Props 인터페이스
 */
export interface CustomResourceDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 CustomResource 객체
   */
  resource: KubeObject | undefined;

  /**
   * CustomResourceDefinition 객체 (동적 속성 추출용)
   */
  crd: CustomResourceDefinition;

  /**
   * 패널 닫기 콜백
   */
  onClose: () => void;
}

interface Dependencies {
  logger: Logger;
  hostedCluster: HostedCluster | undefined;
  createEditResourceTab: (object: KubeObject, tabParams?: DockTabCreateSpecific) => string;
  deleteService: KubeObjectDeleteService;
  openConfirmDialog: OpenConfirmDialog;
}

/**
 * 🎯 목적: CustomResource 상세 정보 우측 슬라이드 패널 컴포넌트
 *
 * @param isOpen - 패널 열림/닫힘 상태
 * @param resource - 표시할 CustomResource 객체
 * @param crd - CustomResourceDefinition 객체
 * @param onClose - 패널 닫기 콜백
 */
class NonInjectedCustomResourceDetailPanel extends Component<CustomResourceDetailPanelProps & Dependencies> {
  // ============================================
  // 🎯 닫힘 애니메이션 동안 마지막 선택 항목 유지
  // ============================================
  @observable private renderResource: KubeObject | undefined;
  private clearTimerRef: ReturnType<typeof setTimeout> | undefined;
  private prevIsOpenRef = true;

  // ============================================
  // 🎯 YAML 표시 상태 관리
  // ============================================
  @observable private yamlContent: string = "";

  constructor(props: CustomResourceDetailPanelProps & Dependencies) {
    super(props);
    makeObservable(this);
    this.renderResource = props.resource;
    this.initializeYaml(props.resource);
  }

  /**
   * 🎯 YAML 상태 초기화
   */
  private initializeYaml(resource: KubeObject | undefined) {
    if (resource) {
      this.yamlContent = yaml.dump(resource.toPlainObject?.() ?? resource, defaultYamlDumpOptions);
    }
  }

  componentDidUpdate(prevProps: CustomResourceDetailPanelProps & Dependencies) {
    const { isOpen, resource } = this.props;

    // 새로 선택된 리소스 반영 및 YAML 재초기화
    if (resource && resource !== prevProps.resource) {
      this.renderResource = resource;
      this.initializeYaml(resource);
    }

    // 패널 닫힘 애니메이션 처리
    const wasOpen = this.prevIsOpenRef;

    if (!isOpen && wasOpen) {
      this.clearTimerRef = setTimeout(() => {
        this.renderResource = undefined;
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
    const { createEditResourceTab } = this.props;
    if (this.renderResource) {
      createEditResourceTab(this.renderResource);
    }
  };

  /**
   * 🎯 액션 핸들러: Delete 액션 - 리소스 삭제
   */
  handleDelete = () => {
    const { crd, hostedCluster, deleteService, onClose, openConfirmDialog } = this.props;
    const resource = this.renderResource;
    if (!resource) return;

    openConfirmDialog({
      ok: async () => {
        try {
          await deleteService.delete(resource, "delete");
          onClose();
        } catch (error) {
          const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
          notificationPanelStore.addError(
            "operations",
            "Error",
            error instanceof Error ? error.message : `Unknown error occurred while deleting ${crd.getResourceKind()}`,
            { clusterName },
          );
        }
      },
      labelOk: "Delete",
      message: (
        <p>
          Are you sure you want to delete {crd.getResourceKind()} <b>{resource.getName()}</b>?
        </p>
      ),
    });
  };

  render() {
    const { isOpen, onClose, crd, logger } = this.props;

    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목 사용
    const resource = this.renderResource;

    if (!resource) {
      return null;
    }

    if (!(resource instanceof Object) || !("getName" in resource)) {
      logger.error("[CustomResourceDetailPanel]: passed object is not a valid KubeObject", resource);
      return null;
    }

    // 🎯 CRD에서 동적 속성 추출
    const extraColumns = crd.getPrinterColumns();
    const isNamespaced = crd.isNamespaced();

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={resource.getName()}
        subtitle={isNamespaced ? `Namespace: ${resource.getNs()}` : `Kind: ${crd.getResourceKind()}`}
        object={resource}
        onEdit={this.handleEdit}
        onDelete={this.handleDelete}
      >
        {/* ============================================ */}
        {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
        {/* ============================================ */}
        <KubeObjectMetaSection object={resource} />

        <Separator className="my-6" />

        {/* ============================================ */}
        {/* 📋 동적 속성 테이블 - CRD printerColumns 기반 */}
        {/* ============================================ */}
        {extraColumns.length > 0 && (
          <Table>
            <TableBody>
              {extraColumns.map(({ name, jsonPath }) => {
                const value = formatJSONValue(safeJSONPathValue(resource, jsonPath));
                return (
                  <TableRow key={name}>
                    <TableCell className="border-border border-b px-2 py-[14px]">
                      <span className="text-foreground text-sm">{startCase(name)}</span>
                    </TableCell>
                    <TableCell className="border-border border-b px-2 py-[14px]">
                      <span className="text-foreground text-sm">{value || "-"}</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* ============================================ */}
        {/* 📋 YAML 섹션 - 리소스 YAML 표시 (읽기 전용) */}
        {/* ============================================ */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-foreground text-sm font-medium">YAML</h4>
          </div>
          <div className="border-border overflow-hidden rounded-md border">
            <MonacoEditor
              language="yaml"
              value={this.yamlContent}
              readOnly={true}
              style={{ height: 300 }}
              options={{
                readOnlyMessage: { value: "" },
              }}
            />
          </div>
        </div>

        {/* ============================================ */}
        {/* 📋 Events 섹션 */}
        {/* ============================================ */}
        <KubeEventDetailsSection object={resource} />
      </DetailPanel>
    );
  }
}

export const CustomResourceDetailPanel = withInjectables<Dependencies, CustomResourceDetailPanelProps>(
  observer(NonInjectedCustomResourceDetailPanel),
  {
    getProps: (di, props) => ({
      ...props,
      logger: di.inject(loggerInjectionToken),
      hostedCluster: di.inject(hostedClusterInjectable),
      createEditResourceTab: di.inject(createEditResourceTabInjectable),
      deleteService: di.inject(kubeObjectDeleteServiceInjectable),
      openConfirmDialog: di.inject(openConfirmDialogInjectable),
    }),
  },
);
