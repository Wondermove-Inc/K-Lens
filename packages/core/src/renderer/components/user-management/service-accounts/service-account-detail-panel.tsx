/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Service Account 상세 정보를 우측 슬라이드 패널로 표시
 * 📝 주의사항:
 *   - shadcn DetailPanel 컴포넌트 사용
 *   - shadcn Table, Badge 컴포넌트로 상세 정보 표시
 *   - Tokens, ImagePullSecrets, Mountable Secrets 표시
 *   - DetailPanelActionsMenu로 Edit, Delete 액션 제공
 * 🔄 변경이력:
 *   - 2025-11-10: 초기 생성 (RoleBinding DetailPanel 패턴 참고)
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Icon } from "@skuberplus/icon";
import { ServiceAccount } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Table, TableBody, TableCell, TableHead, TableRow } from "@skuberplus/storybook-shadcn";
import { Separator } from "@skuberplus/storybook-shadcn/src/components/ui/separator";
import { observer } from "mobx-react";
import React from "react";
import { Link } from "react-router-dom";
import hostedClusterInjectable from "../../../cluster-frame-context/hosted-cluster.injectable";
import { DetailPanel } from "../../common/detail-panel";
import secretStoreInjectable from "../../config-secrets/store.injectable";
import openConfirmDialogInjectable from "../../confirm-dialog/open.injectable";
import createEditResourceTabInjectable from "../../dock/edit-resource/edit-resource-tab.injectable";
import getDetailsUrlInjectable from "../../kube-detail-params/get-details-url.injectable";
import { KubeEventDetailsSection } from "../../kube-object-details/kube-event-details-section";
import { KubeObjectMetaSection } from "../../kube-object-details/kube-object-meta-section";
import kubeObjectDeleteServiceInjectable from "../../kube-object-menu/kube-object-delete-service.injectable";
import { notificationPanelStore } from "../../status-bar/items/notification-panel.store";
import { ServiceAccountsSecret } from "./secret";

import type { KubeObject, Secret } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { HostedCluster } from "../../../cluster-frame-context/hosted-cluster.injectable";
import type { SecretStore } from "../../config-secrets/store";
import type { OpenConfirmDialog } from "../../confirm-dialog/open.injectable";
import type { DockTabCreateSpecific } from "../../dock/dock/store";
import type { GetDetailsUrl } from "../../kube-detail-params/get-details-url.injectable";
import type { KubeObjectDeleteService } from "../../kube-object-menu/kube-object-delete-service.injectable";

/**
 * 🎯 목적: ServiceAccountDetailPanel Props 인터페이스
 */
export interface ServiceAccountDetailPanelProps {
  /**
   * 패널 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 표시할 ServiceAccount 객체
   */
  serviceAccount: ServiceAccount | undefined;

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
  secretStore: SecretStore;
  getDetailsUrl: GetDetailsUrl;
  hostedCluster: HostedCluster | undefined;
}

/**
 * 🎯 목적: Service Account 상세 정보 우측 슬라이드 패널 컴포넌트
 *
 * @param isOpen - 패널 열림/닫힘 상태
 * @param serviceAccount - 표시할 ServiceAccount 객체
 * @param onClose - 패널 닫기 콜백
 */
const NonInjectedServiceAccountDetailPanel = observer((props: ServiceAccountDetailPanelProps & Dependencies) => {
  const {
    isOpen,
    serviceAccount,
    onClose,
    logger,
    createEditResourceTab,
    deleteService,
    openConfirmDialog,
    secretStore,
    getDetailsUrl,
    hostedCluster,
  } = props;

  // 🎯 닫힘 애니메이션 동안 마지막 선택 항목을 유지하기 위한 상태
  const [renderServiceAccount, setRenderServiceAccount] = React.useState<ServiceAccount | undefined>(serviceAccount);
  const clearTimerRef = React.useRef<ReturnType<typeof setTimeout>>();
  const prevIsOpenRef = React.useRef(isOpen);

  // 🎯 Secret 로딩 상태
  const [secrets, setSecrets] = React.useState<(Secret | string)[]>([]);
  const [imagePullSecrets, setImagePullSecrets] = React.useState<(Secret | string)[]>([]);

  // 🔄 새로 선택된 리소스가 있으면 즉시 렌더 대상으로 반영
  React.useEffect(() => {
    if (serviceAccount) {
      setRenderServiceAccount(serviceAccount);
    }
  }, [serviceAccount]);

  // 🔄 패널 열림/닫힘 상태에 따른 렌더 대상 관리
  React.useEffect(() => {
    const wasOpen = prevIsOpenRef.current;

    // 닫힐 때는 애니메이션 시간 이후에 렌더 대상을 정리
    if (!isOpen && wasOpen) {
      clearTimerRef.current = setTimeout(() => {
        setRenderServiceAccount(undefined);
      }, 320);
    }

    // 다시 열리면 정리 타이머 취소
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

  // 🔄 ServiceAccount 변경 시 Secret 로딩
  React.useEffect(() => {
    if (!renderServiceAccount) {
      setSecrets([]);
      setImagePullSecrets([]);
      return;
    }

    const namespace = renderServiceAccount.getNs();
    if (!namespace) return;

    /**
     * 🎯 Secret 로딩 헬퍼 함수 (오류 시 이름만 반환)
     */
    const defensiveLoadSecretIn =
      (ns: string) =>
      ({ name }: { name: string }) =>
        secretStore.load({ name, namespace: ns }).catch(() => name);

    const defensiveLoadSecret = defensiveLoadSecretIn(namespace);

    const secretLoaders = Promise.all(renderServiceAccount.getSecrets().map(defensiveLoadSecret));
    const imagePullSecretLoaders = Promise.all(renderServiceAccount.getImagePullSecrets().map(defensiveLoadSecret));

    Promise.all([secretLoaders, imagePullSecretLoaders]).then(([loadedSecrets, loadedImagePullSecrets]) => {
      setSecrets(loadedSecrets);
      setImagePullSecrets(loadedImagePullSecrets);
    });
  }, [renderServiceAccount, secretStore]);

  /**
   * 🎯 액션 핸들러: Edit 액션 - YAML 편집 탭 열기
   */
  const handleEdit = () => {
    if (renderServiceAccount) {
      createEditResourceTab(renderServiceAccount);
    }
  };

  /**
   * 🎯 액션 핸들러: Delete 액션 - ServiceAccount 삭제
   */
  const handleDelete = () => {
    if (!renderServiceAccount) return;

    openConfirmDialog({
      ok: async () => {
        try {
          await deleteService.delete(renderServiceAccount, "delete");
          onClose();
        } catch (error) {
          // 🆕 FIX-038: clusterName metadata 추가
          const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
          notificationPanelStore.addError(
            "operations",
            "Error",
            error instanceof Error ? error.message : "Unknown error occurred while deleting service account",
            { clusterName },
          );
        }
      },
      labelOk: "Delete",
      message: (
        <p>
          Are you sure you want to delete service account <b>{renderServiceAccount.getName()}</b>?
        </p>
      ),
    });
  };

  /**
   * 🎯 Mountable Secrets 렌더링 (기존 ServiceAccountsSecret 컴포넌트 재사용)
   */
  const renderSecretsContent = () => {
    if (!secrets || secrets.length === 0) {
      return <span className="text-muted-foreground text-sm">No mountable secrets</span>;
    }

    return secrets.map((secret) => (
      <ServiceAccountsSecret key={typeof secret === "string" ? secret : secret.getName()} secret={secret} />
    ));
  };

  // ⚠️ 렌더 대상 ServiceAccount가 없으면 렌더링하지 않음
  if (!renderServiceAccount) {
    return null;
  }

  if (serviceAccount && !(serviceAccount instanceof ServiceAccount)) {
    logger.error("[ServiceAccountDetailPanel]: passed object that is not a ServiceAccount", serviceAccount);
    return null;
  }

  // 🎯 ServiceAccount 속성 데이터 추출
  const namespace = renderServiceAccount.getNs();

  // 🎯 Tokens: Secret에서 annotation으로 필터링
  const tokens = secretStore.items.filter(
    (secret) =>
      secret.getNs() === namespace &&
      secret
        .getAnnotations()
        .some((annot) => annot === `kubernetes.io/service-account.name: ${renderServiceAccount.getName()}`),
  );

  return (
    <DetailPanel
      isOpen={isOpen}
      onClose={onClose}
      title={renderServiceAccount.getName()}
      subtitle={`Namespace: ${namespace}`}
      object={renderServiceAccount}
      onEdit={handleEdit}
      onDelete={handleDelete}
    >
      {/* ============================================ */}
      {/* 🔖 공통 메타데이터 섹션 (Created, Labels, Annotations) */}
      {/* ============================================ */}
      <KubeObjectMetaSection object={renderServiceAccount} />

      <Separator className="my-6" />

      {/* ============================================ */}
      {/* 📋 Tokens 테이블 */}
      {/* ============================================ */}
      {tokens.length > 0 && (
        <>
          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-2">Tokens</h3>
            <Table>
              <TableHead>
                <TableCell className="border-border border-b px-2 py-2">
                  <span className="text-foreground text-sm font-medium">Name</span>
                </TableCell>
              </TableHead>
              <TableBody>
                {tokens.map((token) => (
                  <TableRow key={token.getId()}>
                    <TableCell className="border-border border-b px-2 py-[14px]">
                      <Link to={getDetailsUrl(token.selfLink)} className="text-primary text-sm hover:underline">
                        {token.getName()}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Separator className="my-6" />
        </>
      )}

      {/* ============================================ */}
      {/* 📋 ImagePullSecrets 테이블 */}
      {/* ============================================ */}
      {imagePullSecrets.length > 0 && (
        <>
          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-2">Image Pull Secrets</h3>
            <Table>
              <TableHead>
                <TableCell className="border-border border-b px-2 py-2">
                  <span className="text-foreground text-sm font-medium">Name</span>
                </TableCell>
              </TableHead>
              <TableBody>
                {imagePullSecrets.map((secret, index) => (
                  <TableRow key={typeof secret === "string" ? `${secret}-${index}` : secret.getId()}>
                    <TableCell className="border-border border-b px-2 py-[14px]">
                      {typeof secret === "string" ? (
                        <div className="flex items-center gap-1">
                          <span className="text-foreground text-sm">{secret}</span>
                          <Icon small material="warning" tooltip="Secret is not found" />
                        </div>
                      ) : (
                        <Link to={getDetailsUrl(secret.selfLink)} className="text-primary text-sm hover:underline">
                          {secret.getName()}
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Separator className="my-6" />
        </>
      )}

      {/* ============================================ */}
      {/* 📋 Mountable Secrets 섹션 */}
      {/* ============================================ */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold mb-2">Mountable Secrets</h3>
        {secrets.length > 0 ? (
          <div className="space-y-2">{renderSecretsContent()}</div>
        ) : (
          <p className="text-muted-foreground text-sm">No mountable secrets</p>
        )}
      </div>

      {/* ============================================ */}
      {/* 📋 Events 섹션 */}
      {/* ============================================ */}
      <KubeEventDetailsSection object={renderServiceAccount} />
    </DetailPanel>
  );
});

export const ServiceAccountDetailPanel = withInjectables<Dependencies, ServiceAccountDetailPanelProps>(
  NonInjectedServiceAccountDetailPanel,
  {
    getProps: (di, props) => ({
      ...props,
      logger: di.inject(loggerInjectionToken),
      createEditResourceTab: di.inject(createEditResourceTabInjectable),
      deleteService: di.inject(kubeObjectDeleteServiceInjectable),
      openConfirmDialog: di.inject(openConfirmDialogInjectable),
      secretStore: di.inject(secretStoreInjectable),
      getDetailsUrl: di.inject(getDetailsUrlInjectable),
      hostedCluster: di.inject(hostedClusterInjectable),
    }),
  },
);
