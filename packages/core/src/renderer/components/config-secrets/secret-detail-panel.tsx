/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Secret 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - shadcn DetailPanel 컴포넌트 사용
 *   - shadcn Table로 메타데이터 표시 (Created, Name, Namespace, Controlled By, Type)
 *   - SecretDetails 로직 재사용 (base64 인코딩/디코딩, 비밀번호 표시/숨김)
 *   - MobX observable 데이터 관리
 *   - DetailPanelActionsMenu로 Edit, Delete 액션 제공
 * 🔄 변경이력:
 *   - 2025-11-02: 초기 생성 (shadcn DetailPanel 기반)
 *   - 2025-11-03: shadcn Table로 메타데이터 UI 변경
 *   - 2025-11-06: shadcn DetailPanelActionsMenu 통합 (Edit, Delete)
 */

import "./secret-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Icon } from "@skuberplus/icon";
import { Secret } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Table, TableBody, TableCell, TableRow } from "@skuberplus/storybook-shadcn";
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import { DetailPanelSection } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { Separator } from "@skuberplus/storybook-shadcn/src/components/ui/separator";
import { base64, toggle } from "@skuberplus/utilities";
import { autorun, makeObservable, observable, reaction } from "mobx";
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
import secretStoreInjectable from "./store.injectable";

import type { KubeObject } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { Cluster } from "../../../common/cluster/cluster";
import type { ApiManager } from "../../../common/k8s-api/api-manager";
import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../dock/dock/store";
import type { GetDetailsUrl } from "../kube-detail-params/get-details-url.injectable";
import type { KubeObjectDeleteService } from "../kube-object-menu/kube-object-delete-service.injectable";
import type { SecretStore } from "./store";

/**
 * 🎯 목적: SecretDetailPanel Props 인터페이스
 */
export interface SecretDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 Secret 객체
   */
  secret: Secret | undefined;

  /**
   * 패널 닫기 콜백
   */
  onClose: () => void;
}

interface Dependencies {
  secretStore: SecretStore;
  logger: Logger;
  hostedCluster: Cluster | undefined;

  apiManager: ApiManager;
  getDetailsUrl: GetDetailsUrl;
  createEditResourceTab: (object: KubeObject, tabParams?: DockTabCreateSpecific) => string;
  deleteService: KubeObjectDeleteService;
  openConfirmDialog: OpenConfirmDialog;
}

/**
 * 🎯 목적: Secret 상세 정보 우측 슬라이드 패널 컴포넌트
 *
 * @param isOpen - 패널 열림/닫힘 상태
 * @param secret - 표시할 Secret 객체
 * @param onClose - 패널 닫기 콜백
 */
class NonInjectedSecretDetailPanel extends Component<SecretDetailPanelProps & Dependencies> {
  @observable isSaving = false;
  @observable data: Partial<Record<string, string>> = {};
  /** ObservableSet은 이미 observable이므로 @observable 데코레이터 제거 (HOC 체이닝 반응성 문제 해결) */
  revealSecret = observable.set<string>();

  /**
   * 🎯 닫힘 애니메이션 동안 마지막 선택 항목 유지
   */
  @observable private cachedSecret: Secret | undefined;
  private clearTimerRef: ReturnType<typeof setTimeout> | undefined;
  private prevIsOpenRef = true;

  constructor(props: SecretDetailPanelProps & Dependencies) {
    super(props);
    makeObservable(this);
    // 초기값 설정
    this.cachedSecret = props.secret;
  }

  /**
   * 🎯 액션 핸들러: Edit 액션 - YAML 편집 탭 열기
   */
  handleEdit = () => {
    const { secret, createEditResourceTab } = this.props;
    if (secret) {
      createEditResourceTab(secret);
    }
  };

  /**
   * 🎯 액션 핸들러: Delete 액션 - Secret 삭제
   */
  handleDelete = () => {
    const { secret, deleteService, onClose, openConfirmDialog, hostedCluster } = this.props;
    if (!secret) return;

    openConfirmDialog({
      ok: async () => {
        try {
          await deleteService.delete(secret, "delete");
          onClose();
        } catch (error) {
          // 🆕 FIX-038: clusterName 메타데이터 추가
          const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
          notificationPanelStore.addError(
            "operations",
            "Error",
            error instanceof Error ? error.message : "Unknown error occurred while deleting secret",
            { clusterName },
          );
        }
      },
      labelOk: "Delete",
      message: (
        <p>
          Are you sure you want to delete secret <b>{secret.getName()}</b>?
        </p>
      ),
    });
  };

  componentDidMount() {
    disposeOnUnmount(this, [
      // secret.data 동기화 (모든 변경에 반응)
      autorun(() => {
        const { secret } = this.props;

        if (secret) {
          this.data = secret.data;
        }
      }),

      // secret ID 변경 시에만 revealSecret 클리어
      reaction(
        () => this.props.secret?.getId(),
        (newId, oldId) => {
          if (newId !== oldId) {
            this.revealSecret.clear();
          }
        },
      ),
    ]);
  }

  /**
   * 🎯 패널 닫힘 애니메이션 처리 - 데이터 유지
   */
  componentDidUpdate(prevProps: SecretDetailPanelProps & Dependencies) {
    const { isOpen, secret } = this.props;

    // 새로 선택된 리소스 반영
    if (secret) {
      this.cachedSecret = secret;
    }

    // 패널 닫힘 애니메이션 처리
    const wasOpen = this.prevIsOpenRef;

    if (!isOpen && wasOpen) {
      this.clearTimerRef = setTimeout(() => {
        this.cachedSecret = undefined;
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
   * 🎯 목적: Secret 데이터 저장
   */
  saveSecret = () => {
    const { secret, hostedCluster } = this.props;

    if (!secret) return;

    void (async () => {
      this.isSaving = true;
      // 🆕 FIX-038: clusterName 메타데이터 추가
      const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";

      try {
        await this.props.secretStore.update(secret, { ...secret, data: this.data });
        notificationPanelStore.addSuccess("operations", "Success", "Secret successfully updated.", { clusterName });
      } catch (err) {
        notificationPanelStore.addError(
          "operations",
          "Error",
          err instanceof Error ? err.message : "Unknown error occurred while updating the secret",
          { clusterName },
        );
      }
      this.isSaving = false;
    })();
  };

  /**
   * 🎯 목적: Secret 데이터 편집
   * @param name - Secret 키 이름
   * @param value - 입력된 값
   * @param encoded - base64 인코딩 여부
   */
  editData = (name: string, value: string, encoded: boolean) => {
    this.data[name] = encoded ? value : base64.encode(value);
  };

  /**
   * 🎯 목적: 개별 Secret 항목 렌더링
   */
  renderSecret = ([name, value]: [string, string | undefined]) => {
    let decodedVal: string | undefined;

    try {
      decodedVal = value ? base64.decode(value) : undefined;
    } catch {
      /**
       * The value failed to be decoded, so don't show the visibility
       * toggle until the value is saved
       */
      this.revealSecret.delete(name);
    }

    const revealSecret = this.revealSecret.has(name);

    if (revealSecret && typeof decodedVal === "string") {
      value = decodedVal;
    }

    return (
      <div key={name} className="data" data-testid={`${name}-secret-entry`}>
        <div className="flex items-center justify-between mb-2">
          <Badge variant="outline">{name}</Badge>
          {typeof decodedVal === "string" && (
            <Icon
              material={revealSecret ? "visibility" : "visibility_off"}
              tooltip={revealSecret ? "Hide" : "Show"}
              onClick={() => toggle(this.revealSecret, name)}
            />
          )}
        </div>
        <MonacoEditor
          value={value || ""}
          readOnly={true}
          setInitialHeight
          style={{
            resize: "vertical",
            overflow: "hidden",
            border: "1px solid var(--borderFaintColor)",
            borderRadius: "4px",
          }}
          options={{
            readOnlyMessage: { value: "" },
            wordWrap: "on",
            scrollbar: {
              alwaysConsumeMouseWheel: false,
            },
          }}
        />
      </div>
    );
  };

  render() {
    const { isOpen, onClose, logger, apiManager, getDetailsUrl } = this.props;

    // 🎯 닫힘 애니메이션 동안 마지막 선택 항목 유지
    const secret = this.cachedSecret;

    if (!secret) {
      return null;
    }

    if (!(secret instanceof Secret)) {
      logger.error("[SecretDetailPanel]: passed object that is not an instanceof Secret", secret);
      return null;
    }

    const secrets = Object.entries(this.data);
    const ownerRefs = secret.getOwnerRefs();
    const namespace = secret.getNs();
    const creationTimestamp = secret.metadata.creationTimestamp;

    return (
      <DetailPanel
        isOpen={isOpen}
        onClose={onClose}
        title={secret.getName()}
        subtitle={`Namespace: ${namespace}`}
        object={secret}
        onEdit={this.handleEdit}
        onDelete={this.handleDelete}
      >
        {/* ============================================ */}
        {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
        {/* ============================================ */}
        <KubeObjectMetaSection object={secret} />

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
                    <KubeObjectAge object={secret} compact={false} withTooltip={false} />
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
                <span className="text-foreground text-sm">{secret.getName()}</span>
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
                        to={getDetailsUrl(apiManager.lookupApiLink(ref, secret))}
                        className="text-primary hover:underline"
                      >
                        {ref.name}
                      </Link>
                    </p>
                  ))}
                </TableCell>
              </TableRow>
            )}

            {/* Type */}
            <TableRow>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">Type</span>
              </TableCell>
              <TableCell className="border-border border-b px-2 py-[14px]">
                <span className="text-foreground text-sm">{secret.type}</span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        {/* Data 섹션 */}
        <div className="SecretDetails">
          {secrets.length > 0 && <DetailPanelSection title="Data">{secrets.map(this.renderSecret)}</DetailPanelSection>}
        </div>

        <Separator className="my-6" />

        {/* ============================================ */}
        {/* 📋 Events 섹션 */}
        {/* ============================================ */}
        <KubeEventDetailsSection object={secret} />
      </DetailPanel>
    );
  }
}

/**
 * DI 패턴 적용된 Secret Detail Panel
 */
export const SecretDetailPanel = withInjectables<Dependencies, SecretDetailPanelProps>(
  observer(NonInjectedSecretDetailPanel),
  {
    getProps: (di, props) => ({
      ...props,
      secretStore: di.inject(secretStoreInjectable),
      logger: di.inject(loggerInjectionToken),
      hostedCluster: di.inject(hostedClusterInjectable),

      apiManager: di.inject(apiManagerInjectable),
      getDetailsUrl: di.inject(getDetailsUrlInjectable),
      createEditResourceTab: di.inject(createEditResourceTabInjectable),
      deleteService: di.inject(kubeObjectDeleteServiceInjectable),
      openConfirmDialog: di.inject(openConfirmDialogInjectable),
    }),
  },
);
