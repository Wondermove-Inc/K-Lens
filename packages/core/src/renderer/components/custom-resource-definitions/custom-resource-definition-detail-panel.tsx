/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: CustomResourceDefinition 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - shadcn DetailPanel 컴포넌트 사용
 *   - shadcn Table, Badge 컴포넌트로 상세 정보 표시
 *   - MobX observable 데이터 관리
 *   - YAML 읽기 전용 표시
 * 🔄 변경이력:
 *   - 2025-11-05: 초기 생성 (shadcn DetailPanel 기반)
 *   - 2025-11-05: shadcn 스타일로 상세 정보 섹션 구현 (Deployment 패턴 참고)
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 *   - 2026-01-29: YAML 편집 기능 제거, 읽기 전용으로 변경
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { CustomResourceDefinition } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Table, TableBody, TableCell, TableRow } from "@skuberplus/storybook-shadcn";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { Separator } from "@skuberplus/storybook-shadcn/src/components/ui/separator";
import yaml from "js-yaml";
import { makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import React, { Component } from "react";
import { Link } from "react-router-dom";
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

import type { KubeObject } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { HostedCluster } from "../../cluster-frame-context/hosted-cluster.injectable";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../dock/dock/store";
import type { KubeObjectDeleteService } from "../kube-object-menu/kube-object-delete-service.injectable";

/**
 * 🎯 목적: CustomResourceDefinitionDetailPanel Props 인터페이스
 */
export interface CustomResourceDefinitionDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 CustomResourceDefinition 객체
   */
  crd: CustomResourceDefinition | undefined;

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
 * 🎯 목적: CustomResourceDefinition 상세 정보 우측 슬라이드 패널 컴포넌트
 *
 * @param isOpen - 패널 열림/닫힘 상태
 * @param crd - 표시할 CustomResourceDefinition 객체
 * @param onClose - 패널 닫기 콜백
 */
class NonInjectedCustomResourceDefinitionDetailPanel extends Component<
  CustomResourceDefinitionDetailPanelProps & Dependencies
> {
  // ============================================
  // 🎯 닫힘 애니메이션 동안 마지막 선택 항목 유지
  // ============================================
  @observable private renderCrd: CustomResourceDefinition | undefined;
  private clearTimerRef: ReturnType<typeof setTimeout> | undefined;
  private prevIsOpenRef = true;

  // ============================================
  // 🎯 YAML 표시 상태 관리
  // ============================================
  @observable private yamlContent: string = "";

  constructor(props: CustomResourceDefinitionDetailPanelProps & Dependencies) {
    super(props);
    makeObservable(this);
    this.renderCrd = props.crd;
    this.initializeYaml(props.crd);
  }

  /**
   * 🎯 YAML 상태 초기화
   */
  private initializeYaml(crd: CustomResourceDefinition | undefined) {
    if (crd) {
      this.yamlContent = yaml.dump(crd.toPlainObject?.() ?? crd, defaultYamlDumpOptions);
    }
  }

  componentDidUpdate(prevProps: CustomResourceDefinitionDetailPanelProps & Dependencies) {
    const { isOpen, crd } = this.props;

    // 새로 선택된 리소스 반영 및 YAML 재초기화
    if (crd && crd !== prevProps.crd) {
      this.renderCrd = crd;
      this.initializeYaml(crd);
    }

    // 패널 닫힘 애니메이션 처리
    const wasOpen = this.prevIsOpenRef;

    if (!isOpen && wasOpen) {
      this.clearTimerRef = setTimeout(() => {
        this.renderCrd = undefined;
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
    const { crd, createEditResourceTab } = this.props;
    if (crd) {
      createEditResourceTab(crd);
    }
  };

  /**
   * 🎯 액션 핸들러: Delete 액션 - CRD 삭제
   */
  handleDelete = () => {
    const { crd, hostedCluster, deleteService, onClose, openConfirmDialog } = this.props;
    if (!crd) return;

    openConfirmDialog({
      ok: async () => {
        try {
          await deleteService.delete(crd, "delete");
          onClose();
        } catch (error) {
          const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
          notificationPanelStore.addError(
            "operations",
            "Error",
            error instanceof Error ? error.message : "Unknown error occurred while deleting custom resource definition",
            { clusterName },
          );
        }
      },
      labelOk: "Delete",
      message: (
        <p>
          Are you sure you want to delete custom resource definition <b>{crd.getName()}</b>?
        </p>
      ),
    });
  };

  render() {
    const { isOpen, onClose, logger } = this.props;

    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목 사용
    const crd = this.renderCrd;

    if (!crd) {
      return null;
    }

    if (!(crd instanceof CustomResourceDefinition)) {
      logger.error("[CustomResourceDefinitionDetailPanel]: passed object that is not a CustomResourceDefinition", crd);

      return null;
    }

    // 🎯 CRD 속성 데이터 추출
    const { plural, singular, kind, listKind, shortNames } = crd.getNames();
    const group = crd.getGroup();
    const versions = crd.getVersions() || [];
    const preferredVersion = crd.getVersion();
    const storedVersions = crd.getStoredVersions().split(", ");
    const scope = crd.getScope();
    const resourceUrl = crd.getResourceUrl();
    const resourceTitle = crd.getResourceTitle();

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={crd.getName()}
        subtitle={`Group: ${group}`}
        object={crd}
        onEdit={this.handleEdit}
        onDelete={this.handleDelete}
      >
        {/* ============================================ */}
        {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
        {/* ============================================ */}
        <KubeObjectMetaSection object={crd} />

        <Separator className="my-6" />

        {/* ============================================ */}
        {/* 📋 속성 테이블 - shadcn Table 컴포넌트 사용 */}
        {/* ============================================ */}
        <Table>
          <TableBody>
            {/* Group */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Group</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{group}</span>
              </TableCell>
            </TableRow>

            {/* Versions */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Versions</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <div className="flex flex-wrap gap-1">
                  {versions.map((version) => (
                    <Badge key={version} variant={version === preferredVersion ? "default" : "outline"}>
                      {version}
                      {version === preferredVersion && " ⭐"}
                    </Badge>
                  ))}
                </div>
              </TableCell>
            </TableRow>

            {/* Stored Versions */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Stored Versions</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <div className="flex flex-wrap gap-1">
                  {storedVersions.map((version) => (
                    <Badge key={version} variant="outline">
                      {version}
                    </Badge>
                  ))}
                </div>
              </TableCell>
            </TableRow>

            {/* Scope */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Scope</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <Badge variant="secondary">{scope}</Badge>
              </TableCell>
            </TableRow>

            {/* Resource */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Resource</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <Link to={resourceUrl} className="font-medium text-primary hover:underline">
                  {resourceTitle}
                </Link>
              </TableCell>
            </TableRow>

            {/* Names - Plural */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Plural</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{plural}</span>
              </TableCell>
            </TableRow>

            {/* Names - Singular */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Singular</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{singular}</span>
              </TableCell>
            </TableRow>

            {/* Names - Kind */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Kind</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{kind}</span>
              </TableCell>
            </TableRow>

            {/* Names - ListKind */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">List Kind</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{listKind}</span>
              </TableCell>
            </TableRow>

            {/* Names - Short Names */}
            {shortNames && shortNames.length > 0 && (
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">Short Names</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <div className="flex flex-wrap gap-1">
                    {shortNames.map((name) => (
                      <Badge key={name} variant="outline">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* ============================================ */}
        {/* 📋 YAML 섹션 - CRD YAML 표시 (읽기 전용) */}
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
        <KubeEventDetailsSection object={crd} />
      </DetailPanel>
    );
  }
}

export const CustomResourceDefinitionDetailPanel = withInjectables<
  Dependencies,
  CustomResourceDefinitionDetailPanelProps
>(observer(NonInjectedCustomResourceDefinitionDetailPanel), {
  getProps: (di, props) => ({
    ...props,
    logger: di.inject(loggerInjectionToken),
    hostedCluster: di.inject(hostedClusterInjectable),
    createEditResourceTab: di.inject(createEditResourceTabInjectable),
    deleteService: di.inject(kubeObjectDeleteServiceInjectable),
    openConfirmDialog: di.inject(openConfirmDialogInjectable),
  }),
});
