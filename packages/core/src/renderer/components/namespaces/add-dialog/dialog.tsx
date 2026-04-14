/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Namespace 생성 다이얼로그 - shadcn UI 기반 구현
 *
 * 구성 요소:
 * - shadcn Dialog 컴포넌트 (DialogContent, DialogHeader, DialogFooter)
 * - shadcn Input, Button, Label
 * - MobX observable 상태 관리
 * - systemName validator 적용
 *
 * 📝 주의사항:
 * - Class Component 유지 (기존 MobX 패턴 보존)
 * - Injectable DI 패턴 유지
 * - validator 함수 유지 (systemName)
 *
 * 🔄 변경이력:
 * - 2025-11-20: shadcn UI로 마이그레이션 (레거시 Dialog/Wizard 제거)
 */

import "./dialog.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Input } from "@skuberplus/storybook-shadcn";
import autoBindReact from "auto-bind/react";
import { action, computed, makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import React, { Component } from "react";
import hostedClusterInjectable from "../../../cluster-frame-context/hosted-cluster.injectable";
import { systemName } from "../../input/input_validators";
import { Button } from "../../shadcn-ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../shadcn-ui/dialog";
import { Label } from "../../shadcn-ui/label";
import { notificationPanelStore } from "../../status-bar/items/notification-panel.store";
import namespaceStoreInjectable from "../store.injectable";
import addNamespaceDialogStateInjectable from "./state.injectable";

import type { Namespace } from "@skuberplus/kube-object";

import type { IObservableValue } from "mobx";

import type { Cluster } from "../../../../common/cluster/cluster";
import type { NamespaceStore } from "../store";

/**
 * 🎯 목적: AddNamespaceDialog Props 인터페이스
 */
export interface AddNamespaceDialogProps {
  onSuccess?(ns: Namespace): void;
  onError?(error: unknown): void;
}

interface Dependencies {
  namespaceStore: NamespaceStore;
  state: IObservableValue<boolean>;
  hostedCluster: Cluster | undefined;
}

/**
 * 🎯 목적: AddNamespaceDialog 컴포넌트 (MobX Class Component)
 */
class NonInjectedAddNamespaceDialog extends Component<AddNamespaceDialogProps & Dependencies> {
  @observable namespace = "";
  @observable validationError = "";

  constructor(props: AddNamespaceDialogProps & Dependencies) {
    super(props);
    makeObservable(this);
    autoBindReact(this);
  }

  /**
   * 🎯 목적: 다이얼로그 닫기 + 상태 초기화
   */
  @action
  close() {
    this.props.state.set(false);
    this.reset();
  }

  /**
   * 🎯 목적: 입력 필드 초기화
   */
  @action
  reset() {
    this.namespace = "";
    this.validationError = "";
  }

  /**
   * 🎯 목적: 입력값 검증 (systemName validator 적용)
   */
  @computed
  get isValid(): boolean {
    if (!this.namespace.trim()) {
      return false;
    }

    // systemName validator 적용 (returns boolean)
    return systemName.validate(this.namespace);
  }

  /**
   * 🎯 목적: Namespace 생성 실행
   */
  async addNamespace() {
    const { namespace } = this;
    const { onSuccess, onError, namespaceStore, hostedCluster } = this.props;

    // 유효성 검증
    if (!this.isValid) {
      // systemName validator 에러 메시지
      this.validationError =
        "A System Name must be lowercase DNS labels separated by dots. DNS labels are alphanumerics and dashes enclosed by alphanumerics.";
      return;
    }

    try {
      const created = await namespaceStore.create({ name: namespace });

      onSuccess?.(created);
      this.close();
    } catch (err) {
      // 🆕 FIX-038: clusterName 메타데이터 추가
      const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
      notificationPanelStore.addCheckedError("operations", err, "Unknown error occurred while creating the namespace", {
        clusterName,
      });
      onError?.(err);
    }
  }

  /**
   * 🎯 목적: shadcn UI 기반 렌더링
   */
  render() {
    const { state } = this.props;
    const { namespace, validationError } = this;
    const isOpen = state.get();

    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && this.close()}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Namespace</DialogTitle>
          </DialogHeader>

          {/* ============================================ */}
          {/* 🎯 폼 입력 영역 */}
          {/* ============================================ */}
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="namespace">Namespace Name</Label>
              <Input
                id="namespace"
                placeholder="Enter namespace name"
                value={namespace}
                onChange={(e) => {
                  this.namespace = e.target.value.toLowerCase();
                  this.validationError = "";
                }}
                autoFocus
                className={validationError ? "border-destructive" : ""}
              />
              {validationError && <p className="text-sm text-destructive">{validationError}</p>}
            </div>
          </div>

          {/* ============================================ */}
          {/* 🎯 액션 버튼 (Cancel, Create) */}
          {/* ============================================ */}
          <DialogFooter>
            <Button variant="ghost" onClick={() => this.close()}>
              Cancel
            </Button>
            <Button variant="default" onClick={() => this.addNamespace()} disabled={!this.isValid}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
}

export const AddNamespaceDialog = withInjectables<Dependencies, AddNamespaceDialogProps>(
  observer(NonInjectedAddNamespaceDialog),
  {
    getProps: (di, props) => ({
      ...props,
      namespaceStore: di.inject(namespaceStoreInjectable),
      state: di.inject(addNamespaceDialogStateInjectable),
      hostedCluster: di.inject(hostedClusterInjectable),
    }),
  },
);
