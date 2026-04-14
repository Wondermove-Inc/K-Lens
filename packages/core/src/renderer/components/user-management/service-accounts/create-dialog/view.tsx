/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: ServiceAccount 생성 다이얼로그 - shadcn UI 기반 구현
 *
 * 구성 요소:
 * - shadcn Dialog 컴포넌트 (DialogContent, DialogHeader, DialogFooter)
 * - shadcn Input, Button, Label
 * - NamespaceSelect 컴포넌트 (레거시 유지)
 * - MobX observable 상태 관리 (state injectable)
 * - systemName validator 적용
 *
 * 📝 주의사항:
 * - ServiceAccount는 namespace-scoped 리소스
 * - shadcn Select로 Namespace 선택 (ClusterContext에서 namespace 목록 가져옴)
 * - state는 external injectable (CreateServiceAccountDialogState)
 * - 생성 후 showDetails로 자동 이동
 *
 * 🔄 변경이력:
 * - 2025-11-20: shadcn UI로 마이그레이션 (레거시 Dialog/Wizard 제거)
 * - 2025-11-20: NamespaceSelect를 shadcn Select로 교체
 */

import "./view.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Input } from "@skuberplus/storybook-shadcn";
import { computed, makeObservable } from "mobx";
import { observer } from "mobx-react";
import React, { Component } from "react";
import clusterFrameContextForNamespacedResourcesInjectable from "../../../../cluster-frame-context/for-namespaced-resources.injectable";
import hostedClusterInjectable from "../../../../cluster-frame-context/hosted-cluster.injectable";
import { systemName } from "../../../input/input_validators";
import showDetailsInjectable from "../../../kube-detail-params/show-details.injectable";
import { Button } from "../../../shadcn-ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../../shadcn-ui/dialog";
import { Label } from "../../../shadcn-ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../shadcn-ui/select";
import { notificationPanelStore } from "../../../status-bar/items/notification-panel.store";
import serviceAccountStoreInjectable from "../store.injectable";
import closeCreateServiceAccountDialogInjectable from "./close.injectable";
import createServiceAccountDialogStateInjectable from "./state.injectable";

import type { ClusterContext } from "../../../../cluster-frame-context/cluster-frame-context";
import type { HostedCluster } from "../../../../cluster-frame-context/hosted-cluster.injectable";
import type { ShowDetails } from "../../../kube-detail-params/show-details.injectable";
import type { ServiceAccountStore } from "../store";
import type { CreateServiceAccountDialogState } from "./state.injectable";

/**
 * 🎯 목적: CreateServiceAccountDialog Props 인터페이스
 */
export interface CreateServiceAccountDialogProps {}

/**
 * 🎯 목적: Dependencies 인터페이스
 */
interface Dependencies {
  state: CreateServiceAccountDialogState;
  serviceAccountStore: ServiceAccountStore;
  closeCreateServiceAccountDialog: () => void;
  showDetails: ShowDetails;
  clusterContext: ClusterContext;
  hostedCluster: HostedCluster | undefined;
}

/**
 * 🎯 목적: CreateServiceAccountDialog 컴포넌트 (MobX observer)
 */
class NonInjectedCreateServiceAccountDialog extends Component<CreateServiceAccountDialogProps & Dependencies> {
  constructor(props: CreateServiceAccountDialogProps & Dependencies) {
    super(props);
    makeObservable(this);
  }

  /**
   * 🎯 목적: Namespace 목록 가져오기 (computed)
   */
  @computed get namespaceOptions() {
    return this.props.clusterContext.allNamespaces;
  }

  /**
   * 🎯 목적: ServiceAccount 생성 실행
   *
   * @remarks
   * - systemName validator 적용 (name 필드)
   * - serviceAccountStore.create()로 ServiceAccount 생성
   * - 생성 후 showDetails로 자동 이동 (detail panel 표시)
   * - 에러 발생 시 showCheckedErrorNotification 표시
   */
  createAccount = async () => {
    const { closeCreateServiceAccountDialog, serviceAccountStore, state, showDetails, hostedCluster } = this.props;

    const accountName = state.name.get().trim();
    const namespace = state.namespace.get();
    // 🆕 FIX-038: clusterName metadata 추가
    const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";

    // 빈 값 검증
    if (!accountName) {
      notificationPanelStore.addError("operations", "Validation Error", "Account name cannot be empty", {
        clusterName,
      });
      return;
    }

    // systemName validator 적용 (returns boolean)
    const isValidName = systemName.validate(accountName);
    if (!isValidName) {
      // systemName validator 에러 메시지
      const errorMessage =
        "A System Name must be lowercase DNS labels separated by dots. DNS labels are alphanumerics and dashes enclosed by alphanumerics.";
      notificationPanelStore.addError("operations", "Validation Error", errorMessage, { clusterName });
      return;
    }

    try {
      const serviceAccount = await serviceAccountStore.create({
        namespace,
        name: accountName,
      });

      showDetails(serviceAccount.selfLink);
      closeCreateServiceAccountDialog();
    } catch (err) {
      notificationPanelStore.addCheckedError(
        "operations",
        err,
        "Unknown error occurred while creating service account",
        { clusterName },
      );
    }
  };

  /**
   * 🎯 목적: shadcn UI 기반 렌더링
   */
  render() {
    const { closeCreateServiceAccountDialog, state } = this.props;
    const accountName = state.name.get();
    const namespace = state.namespace.get();
    const isOpen = state.isOpen.get();

    // 유효성 검증 (systemName.validate는 boolean 반환)
    const isValid = accountName.trim().length > 0 && systemName.validate(accountName.trim());

    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && closeCreateServiceAccountDialog()}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Service Account</DialogTitle>
          </DialogHeader>

          {/* ============================================ */}
          {/* 🎯 폼 입력 영역 */}
          {/* ============================================ */}
          <div className="flex flex-col gap-4 py-4">
            {/* Account Name */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="accountName">Account Name</Label>
              <Input
                id="accountName"
                placeholder="Enter account name"
                value={accountName}
                onChange={(e) => state.name.set(e.target.value.toLowerCase())}
                autoFocus
              />
            </div>

            {/* Namespace Select */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="namespace">Namespace</Label>
              <Select value={namespace} onValueChange={(value) => state.namespace.set(value)}>
                <SelectTrigger id="namespace" className="w-full">
                  <SelectValue placeholder="Select namespace..." />
                </SelectTrigger>
                <SelectContent>
                  {this.namespaceOptions.map((ns: string) => (
                    <SelectItem key={ns} value={ns}>
                      {ns}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ============================================ */}
          {/* 🎯 액션 버튼 (Cancel, Create) */}
          {/* ============================================ */}
          <DialogFooter>
            <Button variant="ghost" onClick={closeCreateServiceAccountDialog}>
              Cancel
            </Button>
            <Button variant="default" onClick={this.createAccount} disabled={!isValid}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
}

export const CreateServiceAccountDialog = withInjectables<Dependencies, CreateServiceAccountDialogProps>(
  observer(NonInjectedCreateServiceAccountDialog),
  {
    getProps: (di, props) => ({
      ...props,
      closeCreateServiceAccountDialog: di.inject(closeCreateServiceAccountDialogInjectable),
      serviceAccountStore: di.inject(serviceAccountStoreInjectable),
      showDetails: di.inject(showDetailsInjectable),
      state: di.inject(createServiceAccountDialogStateInjectable),
      clusterContext: di.inject(clusterFrameContextForNamespacedResourcesInjectable),
      hostedCluster: di.inject(hostedClusterInjectable),
    }),
  },
);
