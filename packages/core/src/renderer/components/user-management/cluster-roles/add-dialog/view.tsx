/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: ClusterRole 생성 다이얼로그 - shadcn UI 기반 구현
 *
 * 구성 요소:
 * - shadcn Dialog 컴포넌트 (DialogContent, DialogHeader, DialogFooter)
 * - shadcn Input, Button, Label
 * - MobX observable 상태 관리 (state injectable)
 * - showDetails integration (생성 후 자동으로 detail 표시)
 *
 * 📝 주의사항:
 * - ClusterRole은 cluster-scoped 리소스 (namespace 없음)
 * - state는 external injectable (AddClusterRoleDialogState)
 * - 생성 후 showDetails로 자동 이동
 *
 * 🔄 변경이력:
 * - 2025-11-20: shadcn UI로 마이그레이션 (레거시 Dialog/Wizard 제거)
 */

import "./view.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Input } from "@skuberplus/storybook-shadcn";
import { observer } from "mobx-react";
import React, { Component } from "react";
import hostedClusterInjectable from "../../../../cluster-frame-context/hosted-cluster.injectable";
import showDetailsInjectable from "../../../kube-detail-params/show-details.injectable";
import { Button } from "../../../shadcn-ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../../shadcn-ui/dialog";
import { Label } from "../../../shadcn-ui/label";
import { notificationPanelStore } from "../../../status-bar/items/notification-panel.store";
import clusterRoleStoreInjectable from "../store.injectable";
import closeAddClusterRoleDialogInjectable from "./close.injectable";
import addClusterRoleDialogStateInjectable from "./state.injectable";

import type { HostedCluster } from "../../../../cluster-frame-context/hosted-cluster.injectable";
import type { ShowDetails } from "../../../kube-detail-params/show-details.injectable";
import type { ClusterRoleStore } from "../store";
import type { AddClusterRoleDialogState } from "./state.injectable";

/**
 * 🎯 목적: AddClusterRoleDialog Props 인터페이스
 */
export interface AddClusterRoleDialogProps {}

/**
 * 🎯 목적: Dependencies 인터페이스
 */
interface Dependencies {
  state: AddClusterRoleDialogState;
  clusterRoleStore: ClusterRoleStore;
  showDetails: ShowDetails;
  closeAddClusterRoleDialog: () => void;
  hostedCluster: HostedCluster | undefined;
}

/**
 * 🎯 목적: AddClusterRoleDialog 컴포넌트 (MobX observer)
 */
class NonInjectedAddClusterRoleDialog extends Component<AddClusterRoleDialogProps & Dependencies> {
  /**
   * 🎯 목적: ClusterRole 생성 실행
   *
   * @remarks
   * - clusterRoleStore.create()로 ClusterRole 생성
   * - 생성 후 showDetails로 자동 이동 (detail panel 표시)
   * - 에러 발생 시 notificationPanelStore 표시
   */
  createRole = async () => {
    const { closeAddClusterRoleDialog, clusterRoleStore, showDetails, state, hostedCluster } = this.props;

    const roleName = state.clusterRoleName.get().trim();
    // 🆕 FIX-038: clusterName metadata 추가
    const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";

    // 빈 값 검증
    if (!roleName) {
      notificationPanelStore.addError("operations", "Validation Error", "ClusterRole name cannot be empty", {
        clusterName,
      });
      return;
    }

    try {
      const role = await clusterRoleStore.create({ name: roleName });

      showDetails(role.selfLink);
      closeAddClusterRoleDialog();
    } catch (error) {
      notificationPanelStore.addCheckedError(
        "operations",
        error,
        "Unknown error occurred while creating the ClusterRole",
        { clusterName },
      );
    }
  };

  /**
   * 🎯 목적: shadcn UI 기반 렌더링
   */
  render() {
    const { closeAddClusterRoleDialog, state } = this.props;
    const roleName = state.clusterRoleName.get();
    const isOpen = state.isOpen.get();
    const isValid = roleName.trim().length > 0;

    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && closeAddClusterRoleDialog()}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create ClusterRole</DialogTitle>
          </DialogHeader>

          {/* ============================================ */}
          {/* 🎯 폼 입력 영역 */}
          {/* ============================================ */}
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="clusterRoleName">ClusterRole Name</Label>
              <Input
                id="clusterRoleName"
                placeholder="Enter ClusterRole name"
                value={roleName}
                onChange={(e) => state.clusterRoleName.set(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {/* ============================================ */}
          {/* 🎯 액션 버튼 (Cancel, Create) */}
          {/* ============================================ */}
          <DialogFooter>
            <Button variant="ghost" onClick={closeAddClusterRoleDialog}>
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

export const AddClusterRoleDialog = withInjectables<Dependencies, AddClusterRoleDialogProps>(
  observer(NonInjectedAddClusterRoleDialog),
  {
    getProps: (di, props) => ({
      ...props,
      closeAddClusterRoleDialog: di.inject(closeAddClusterRoleDialogInjectable),
      clusterRoleStore: di.inject(clusterRoleStoreInjectable),
      showDetails: di.inject(showDetailsInjectable),
      state: di.inject(addClusterRoleDialogStateInjectable),
      hostedCluster: di.inject(hostedClusterInjectable),
    }),
  },
);
