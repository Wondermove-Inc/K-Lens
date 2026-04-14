/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Role 생성 다이얼로그 - shadcn UI 기반 구현
 *
 * 구성 요소:
 * - shadcn Dialog 컴포넌트 (DialogContent, DialogHeader, DialogFooter)
 * - shadcn Input, Button, Label, Select
 * - MobX observable 상태 관리 (state injectable)
 * - ClusterContext로 namespace 목록 조회
 *
 * 📝 주의사항:
 * - Role은 namespace-scoped 리소스
 * - shadcn Select로 Namespace 선택 (ClusterContext에서 namespace 목록 가져옴)
 * - state는 external injectable (AddRoleDialogState)
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
import showDetailsInjectable from "../../../kube-detail-params/show-details.injectable";
import { Button } from "../../../shadcn-ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../../shadcn-ui/dialog";
import { Label } from "../../../shadcn-ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../shadcn-ui/select";
import { notificationPanelStore } from "../../../status-bar/items/notification-panel.store";
import roleStoreInjectable from "../store.injectable";
import closeAddRoleDialogInjectable from "./close.injectable";
import addRoleDialogStateInjectable from "./state.injectable";

import type { ClusterContext } from "../../../../cluster-frame-context/cluster-frame-context";
import type { HostedCluster } from "../../../../cluster-frame-context/hosted-cluster.injectable";
import type { ShowDetails } from "../../../kube-detail-params/show-details.injectable";
import type { RoleStore } from "../store";
import type { AddRoleDialogState } from "./state.injectable";

/**
 * 🎯 목적: AddRoleDialog Props 인터페이스
 */
export interface AddRoleDialogProps {}

/**
 * 🎯 목적: Dependencies 인터페이스
 */
interface Dependencies {
  closeAddRoleDialog: () => void;
  showDetails: ShowDetails;
  state: AddRoleDialogState;
  roleStore: RoleStore;
  clusterContext: ClusterContext;
  hostedCluster: HostedCluster | undefined;
}

/**
 * 🎯 목적: AddRoleDialog 컴포넌트 (MobX observer)
 */
class NonInjectedAddRoleDialog extends Component<AddRoleDialogProps & Dependencies> {
  constructor(props: AddRoleDialogProps & Dependencies) {
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
   * 🎯 목적: Role 생성 실행
   *
   * @remarks
   * - roleStore.create()로 Role 생성
   * - 생성 후 showDetails로 자동 이동 (detail panel 표시)
   * - 에러 발생 시 notificationPanelStore 표시
   */
  createRole = async () => {
    const { closeAddRoleDialog, roleStore, state, showDetails, hostedCluster } = this.props;

    const roleName = state.roleName.get().trim();
    const namespace = state.namespace.get();
    // 🆕 FIX-038: clusterName metadata 추가
    const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";

    // 빈 값 검증
    if (!roleName) {
      notificationPanelStore.addError("operations", "Validation Error", "Role name cannot be empty", { clusterName });
      return;
    }

    try {
      const role = await roleStore.create({
        name: roleName,
        namespace,
      });

      showDetails(role.selfLink);
      closeAddRoleDialog();
    } catch (err) {
      notificationPanelStore.addCheckedError("operations", err, "Unknown error occurred while creating role", {
        clusterName,
      });
    }
  };

  /**
   * 🎯 목적: shadcn UI 기반 렌더링
   */
  render() {
    const { closeAddRoleDialog, state } = this.props;
    const roleName = state.roleName.get();
    const namespace = state.namespace.get();
    const isOpen = state.isOpen.get();
    const isValid = roleName.trim().length > 0;

    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && closeAddRoleDialog()}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Role</DialogTitle>
          </DialogHeader>

          {/* ============================================ */}
          {/* 🎯 폼 입력 영역 */}
          {/* ============================================ */}
          <div className="flex flex-col gap-4 py-4">
            {/* Role Name */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="roleName">Role Name</Label>
              <Input
                id="roleName"
                placeholder="Enter role name"
                value={roleName}
                onChange={(e) => state.roleName.set(e.target.value)}
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
            <Button variant="ghost" onClick={closeAddRoleDialog}>
              Cancel
            </Button>
            <Button variant="default" onClick={this.createRole} disabled={!isValid}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
}

export const AddRoleDialog = withInjectables<Dependencies, AddRoleDialogProps>(observer(NonInjectedAddRoleDialog), {
  getProps: (di, props) => ({
    ...props,
    closeAddRoleDialog: di.inject(closeAddRoleDialogInjectable),
    roleStore: di.inject(roleStoreInjectable),
    showDetails: di.inject(showDetailsInjectable),
    state: di.inject(addRoleDialogStateInjectable),
    clusterContext: di.inject(clusterFrameContextForNamespacedResourcesInjectable),
    hostedCluster: di.inject(hostedClusterInjectable),
  }),
});
