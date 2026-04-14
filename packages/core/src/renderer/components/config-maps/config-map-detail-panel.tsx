/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: ConfigMap 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - shadcn DetailPanel 컴포넌트 사용
 *   - shadcn Table로 메타데이터 표시 (Created, Name, Namespace, Controlled By)
 *   - ConfigMapDetails 로직 재사용 (MonacoEditor 기반 데이터 편집)
 *   - MobX observable 데이터 관리
 *   - DetailPanelActionsMenu로 Edit, Delete 액션 제공
 * 🔄 변경이력:
 *   - 2025-11-02: 초기 생성 (shadcn DetailPanel 기반)
 *   - 2025-11-03: shadcn Table로 메타데이터 UI 변경
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 */

import "./config-map-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { ConfigMap } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Table, TableBody, TableCell, TableRow } from "@skuberplus/storybook-shadcn";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { DetailPanelSection } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { Separator } from "@skuberplus/storybook-shadcn/src/components/ui/separator";
import { computed, makeObservable, observable, reaction, runInAction } from "mobx";
import { disposeOnUnmount, observer } from "mobx-react";
import React, { Component } from "react";
import { Link } from "react-router-dom";
import apiManagerInjectable from "../../../common/k8s-api/api-manager/manager.injectable";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { DetailPanel } from "../common/detail-panel";
import openConfirmDialogInjectable from "../confirm-dialog/open.injectable";
import createEditResourceTabInjectable from "../dock/edit-resource/edit-resource-tab.injectable";
import getDetailsUrlInjectable from "../kube-detail-params/get-details-url.injectable";
import { KubeObjectAge } from "../kube-object/age";
import { KubeEventDetailsSection } from "../kube-object-details/kube-event-details-section";
import { KubeObjectMetaSection } from "../kube-object-details/kube-object-meta-section";
import { LinkToNamespace } from "../kube-object-link";
import kubeObjectDeleteServiceInjectable from "../kube-object-menu/kube-object-delete-service.injectable";
import { LocaleDate } from "../locale-date";
import { MonacoEditor } from "../monaco-editor";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";
import configMapStoreInjectable from "./store.injectable";

import type { KubeObject } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { ApiManager } from "../../../common/k8s-api/api-manager";
import type { HostedCluster } from "../../cluster-frame-context/hosted-cluster.injectable";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../dock/dock/store";
import type { GetDetailsUrl } from "../kube-detail-params/get-details-url.injectable";
import type { KubeObjectDeleteService } from "../kube-object-menu/kube-object-delete-service.injectable";
import type { ConfigMapStore } from "./store";

/**
 * 🎯 목적: ConfigMapDetailPanel Props 인터페이스
 */
export interface ConfigMapDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 ConfigMap 객체
   */
  configMap: ConfigMap | undefined;

  /**
   * 패널 닫기 콜백
   */
  onClose: () => void;
}

interface Dependencies {
  configMapStore: ConfigMapStore;
  logger: Logger;
  // 🆕 FIX-038: hostedCluster DI 추가
  hostedCluster: HostedCluster | undefined;
  openConfirmDialog: OpenConfirmDialog;
  apiManager: ApiManager;
  getDetailsUrl: GetDetailsUrl;
  createEditResourceTab: (object: KubeObject, tabParams?: DockTabCreateSpecific) => string;
  deleteService: KubeObjectDeleteService;
}

/**
 * 🎯 목적: ConfigMap 상세 정보 우측 슬라이드 패널 컴포넌트
 *
 * @param isOpen - 패널 열림/닫힘 상태
 * @param configMap - 표시할 ConfigMap 객체
 * @param onClose - 패널 닫기 콜백
 */
class NonInjectedConfigMapDetailPanel extends Component<ConfigMapDetailPanelProps & Dependencies> {
  @observable isSaving = false;
  @observable data = observable.map<string, string | undefined>();

  /**
   * 🎯 원본 데이터 저장 - 변경 감지용
   */
  @observable private originalData = observable.map<string, string | undefined>();

  /**
   * 🎯 Computed: 데이터 변경 여부 감지
   * originalData와 현재 data를 비교하여 변경 사항 확인
   */
  @computed get hasChanges(): boolean {
    if (this.originalData.size !== this.data.size) {
      return true;
    }

    for (const [key, value] of this.originalData.entries()) {
      if (this.data.get(key) !== value) {
        return true;
      }
    }

    return false;
  }

  /**
   * 🎯 닫힘 애니메이션 동안 마지막 선택 항목 유지
   */
  @observable private renderConfigMap: ConfigMap | undefined;
  private clearTimerRef: ReturnType<typeof setTimeout> | undefined;
  private prevIsOpenRef = true;

  constructor(props: ConfigMapDetailPanelProps & Dependencies) {
    super(props);
    makeObservable(this);
    // 초기값 설정
    this.renderConfigMap = props.configMap;
  }

  /**
   * 🎯 액션 핸들러: Edit 액션 - YAML 편집 탭 열기
   */
  handleEdit = () => {
    const { configMap, createEditResourceTab } = this.props;
    if (configMap) {
      createEditResourceTab(configMap);
    }
  };

  /**
   * 🎯 액션 핸들러: Delete 액션 - ConfigMap 삭제 확인 다이얼로그 표시
   */
  handleDelete = () => {
    const { configMap, deleteService, onClose, openConfirmDialog } = this.props;
    if (!configMap) return;

    openConfirmDialog({
      ok: async () => {
        try {
          await deleteService.delete(configMap, "delete");
          onClose();
        } catch (error) {
          // 🆕 FIX-038: clusterName 추가
          const clusterName = this.props.hostedCluster?.name.get() ?? "Unknown Cluster";
          notificationPanelStore.addError(
            "operations",
            "Error",
            error instanceof Error ? error.message : "Unknown error occurred while deleting config map",
            { clusterName },
          );
        }
      },
      labelOk: "Delete",
      message: (
        <p>
          Are you sure you want to delete config map <b>{configMap.getName()}</b>?
        </p>
      ),
    });
  };

  componentDidMount() {
    disposeOnUnmount(this, [
      // 🔧 FIX: autorun → reaction 변경
      // autorun은 configMap 객체 참조가 변경될 때마다 실행되어
      // 사용자 입력 중에도 data가 덮어써지는 문제 발생
      // reaction은 configMap UID 변경 시에만 실행하여 문제 해결
      reaction(
        () => this.props.configMap?.metadata.uid,
        () => {
          const { configMap } = this.props;

          if (configMap) {
            this.data.replace(configMap.data); // refresh
            this.originalData.replace(configMap.data); // 원본 데이터 저장
          }
        },
        { fireImmediately: true }, // 최초 실행 보장
      ),
    ]);
  }

  /**
   * 🎯 패널 닫힘 애니메이션 처리 - 데이터 유지
   */
  componentDidUpdate(prevProps: ConfigMapDetailPanelProps & Dependencies) {
    const { isOpen, configMap } = this.props;

    // 새로 선택된 리소스 반영
    if (configMap) {
      this.renderConfigMap = configMap;
    }

    // 패널 닫힘 애니메이션 처리
    const wasOpen = this.prevIsOpenRef;

    if (!isOpen && wasOpen) {
      this.clearTimerRef = setTimeout(() => {
        this.renderConfigMap = undefined;
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

  save = () => {
    const { configMap, configMapStore } = this.props;

    if (!configMap) return;

    void (async () => {
      try {
        this.isSaving = true;
        await configMapStore.update(configMap, {
          ...configMap,
          data: Object.fromEntries(this.data),
        });

        // 성공 시 originalData를 현재 data로 업데이트
        runInAction(() => {
          this.originalData.replace(Object.fromEntries(this.data));
        });

        notificationPanelStore.addSuccess(
          "operations",
          "Success",
          `ConfigMap ${configMap.getName()} successfully updated.`,
        );
      } catch (error) {
        // 🆕 FIX-038: clusterName 추가
        const clusterName = this.props.hostedCluster?.name.get() ?? "Unknown Cluster";
        notificationPanelStore.addError("operations", "Error", `Failed to save config map: ${String(error)}`, {
          clusterName,
        });
      } finally {
        this.isSaving = false;
      }
    })();
  };

  render() {
    const { isOpen, onClose, logger, apiManager, getDetailsUrl } = this.props;

    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목 유지
    const configMap = this.renderConfigMap;

    if (!configMap) {
      return null;
    }

    if (!(configMap instanceof ConfigMap)) {
      logger.error("[ConfigMapDetailPanel]: passed object that is not an instanceof ConfigMap", configMap);
      return null;
    }

    const data = Array.from(this.data.entries());
    const ownerRefs = configMap.getOwnerRefs();
    const namespace = configMap.getNs();
    const creationTimestamp = configMap.metadata.creationTimestamp;

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={configMap.getName()}
        subtitle={`Namespace: ${namespace}`}
        object={configMap}
        onEdit={this.handleEdit}
        onDelete={this.handleDelete}
      >
        {/* ============================================ */}
        {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
        {/* ============================================ */}
        <KubeObjectMetaSection object={configMap} />

        <Separator className="my-6" />

        {/* 메타데이터 테이블 - shadcn Table 사용 */}
        <Table>
          <TableBody>
            {/* Created */}
            {creationTimestamp && (
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">Created</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">
                    <KubeObjectAge object={configMap} compact={false} withTooltip={false} />
                    {" ago ("}
                    <LocaleDate date={creationTimestamp} />
                    {")"}
                  </span>
                </TableCell>
              </TableRow>
            )}

            {/* Name */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Name</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{configMap.getName()}</span>
              </TableCell>
            </TableRow>

            {/* Namespace */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Namespace</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <LinkToNamespace namespace={namespace} />
              </TableCell>
            </TableRow>

            {/* Controlled By */}
            {ownerRefs && ownerRefs.length > 0 && (
              <TableRow>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  <span className="text-foreground text-sm">Controlled By</span>
                </TableCell>
                <TableCell className="border-border border-b px-2 py-[14px]">
                  {ownerRefs.map((ref) => (
                    <p key={ref.name} className="text-foreground text-sm">
                      {`${ref.kind} `}
                      <Link
                        to={getDetailsUrl(apiManager.lookupApiLink(ref, configMap))}
                        className="text-primary hover:underline"
                      >
                        {ref.name}
                      </Link>
                    </p>
                  ))}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Data 섹션 */}
        <div className="ConfigMapDetails">
          {data.length > 0 ? (
            <DetailPanelSection title="Data">
              {data.map(([name, value = ""]) => (
                <div key={name} className="data">
                  <Badge variant="outline">{name}</Badge>
                  <MonacoEditor
                    id={`config-map-data-${name}`}
                    style={{
                      resize: "vertical",
                      overflow: "hidden",
                      border: "1px solid var(--borderFaintColor)",
                      borderRadius: "4px",
                    }}
                    value={value}
                    readOnly={true}
                    setInitialHeight
                    options={{
                      readOnlyMessage: { value: "" },
                      scrollbar: {
                        alwaysConsumeMouseWheel: false,
                      },
                    }}
                  />
                </div>
              ))}
            </DetailPanelSection>
          ) : (
            <div className="text-muted-foreground text-sm">No data available</div>
          )}
        </div>

        <Separator className="my-6" />

        {/* ============================================ */}
        {/* 📋 Events 섹션 */}
        {/* ============================================ */}
        <KubeEventDetailsSection object={configMap} />
      </DetailPanel>
    );
  }
}

/**
 * DI 패턴 적용된 ConfigMap Detail Panel
 */
export const ConfigMapDetailPanel = withInjectables<Dependencies, ConfigMapDetailPanelProps>(
  observer(NonInjectedConfigMapDetailPanel),
  {
    getProps: (di, props) => ({
      ...props,
      configMapStore: di.inject(configMapStoreInjectable),
      openConfirmDialog: di.inject(openConfirmDialogInjectable),
      logger: di.inject(loggerInjectionToken),
      // 🆕 FIX-038: hostedCluster DI 추가
      hostedCluster: di.inject(hostedClusterInjectable),
      apiManager: di.inject(apiManagerInjectable),
      getDetailsUrl: di.inject(getDetailsUrlInjectable),
      createEditResourceTab: di.inject(createEditResourceTabInjectable),
      deleteService: di.inject(kubeObjectDeleteServiceInjectable),
    }),
  },
);
