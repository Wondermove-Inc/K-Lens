/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: ResourceQuota 생성 다이얼로그 - shadcn UI 기반 구현
 *
 * 구성 요소:
 * - shadcn Dialog 컴포넌트 (DialogContent, DialogHeader, DialogFooter)
 * - shadcn Input, Button, Label, Badge, Select
 * - MobX observable 상태 관리 (동적 quota key-value 쌍)
 * - systemName validator 적용
 * - ClusterContext로 namespace 목록 조회
 *
 * 📝 주요 기능:
 * - 동적 Quota Key-Value 쌍 추가/삭제
 * - Badge로 quota 표시
 * - Icon 기반 quota 타입 구분 (CPU/Memory, Storage, Count)
 *
 * 📝 주의사항:
 * - ResourceQuota는 namespace-scoped 리소스
 * - quotas는 observable.box로 관리 (동적 업데이트)
 * - Namespace, Quota 선택 모두 shadcn Select 사용
 *
 * 🔄 변경이력:
 * - 2025-11-20: shadcn UI로 마이그레이션 (레거시 Dialog/Wizard 제거)
 * - 2025-11-20: NamespaceSelect를 shadcn Select로 교체
 * - 2025-12-02: Quota Select를 레거시에서 shadcn Select로 교체
 */

import "./view.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Icon } from "@skuberplus/icon";
import { resourceQuotaApiInjectable } from "@skuberplus/kube-api-specifics";
import { Input } from "@skuberplus/storybook-shadcn";
import { X } from "lucide-react";
import { computed, makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import React, { Component } from "react";
import clusterFrameContextForNamespacedResourcesInjectable from "../../../cluster-frame-context/for-namespaced-resources.injectable";
import hostedClusterInjectable from "../../../cluster-frame-context/hosted-cluster.injectable";
import { systemName } from "../../input/input_validators";
import { Badge } from "../../shadcn-ui/badge";
import { Button } from "../../shadcn-ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../shadcn-ui/dialog";
import { Label } from "../../shadcn-ui/label";
import { SelectContent, SelectItem, SelectTrigger, SelectValue, Select as ShadcnSelect } from "../../shadcn-ui/select";
import { notificationPanelStore } from "../../status-bar/items/notification-panel.store";
import closeAddQuotaDialogInjectable from "./close.injectable";
import isAddQuotaDialogOpenInjectable from "./is-open.injectable";

import type { ResourceQuotaApi } from "@skuberplus/kube-api";
import type { ResourceQuotaValues } from "@skuberplus/kube-object";

import type { IComputedValue } from "mobx";

import type { ClusterContext } from "../../../cluster-frame-context/cluster-frame-context";
import type { HostedCluster } from "../../../cluster-frame-context/hosted-cluster.injectable";

/**
 * 🎯 목적: AddQuotaDialog Props 인터페이스
 */
export interface AddQuotaDialogProps {}

interface Dependencies {
  resourceQuotaApi: ResourceQuotaApi;
  isAddQuotaDialogOpen: IComputedValue<boolean>;
  closeAddQuotaDialog: () => void;
  clusterContext: ClusterContext;
  // 🆕 FIX-038: hostedCluster DI 추가
  hostedCluster: HostedCluster | undefined;
}

const getDefaultQuotas = (): ResourceQuotaValues => ({
  "limits.cpu": "",
  "limits.memory": "",
  "requests.cpu": "",
  "requests.memory": "",
  "requests.storage": "",
  persistentvolumeclaims: "",
  "count/pods": "",
  "count/persistentvolumeclaims": "",
  "count/services": "",
  "count/secrets": "",
  "count/configmaps": "",
  "count/replicationcontrollers": "",
  "count/deployments.apps": "",
  "count/replicasets.apps": "",
  "count/statefulsets.apps": "",
  "count/jobs.batch": "",
  "count/cronjobs.batch": "",
  "count/deployments.extensions": "",
});

class NonInjectedAddQuotaDialog extends Component<AddQuotaDialogProps & Dependencies> {
  public defaultNamespace = "default";

  @observable quotaName = "";
  @observable quotaSelectValue: string | null = null;
  @observable quotaInputValue = "";
  @observable namespace: string | null = this.defaultNamespace;
  readonly quotas = observable.box(getDefaultQuotas());

  constructor(props: AddQuotaDialogProps & Dependencies) {
    super(props);
    makeObservable(this);
  }

  /**
   * 🎯 목적: Namespace 목록 가져오기 (computed)
   */
  @computed get namespaceOptions() {
    return this.props.clusterContext.allNamespaces;
  }

  @computed get quotaEntries() {
    return Object.entries(this.quotas.get()).filter(([, value]) => !!value?.trim());
  }

  private getQuotaOptionLabelIconMaterial(quota: string) {
    if (quota.endsWith(".cpu") || quota.endsWith(".memory")) {
      return "memory";
    }

    if (quota.endsWith(".storage") || quota === "persistentvolumeclaims") {
      return "storage";
    }

    if (quota.startsWith("count/")) {
      return "looks_one";
    }

    return undefined;
  }

  setQuota = () => {
    if (!this.quotaSelectValue) return;
    this.quotas.get()[this.quotaSelectValue] = this.quotaInputValue;
    this.quotaInputValue = "";
  };

  close = () => {
    this.props.closeAddQuotaDialog();
  };

  reset = () => {
    this.quotaName = "";
    this.quotaSelectValue = "";
    this.quotaInputValue = "";
    this.namespace = this.defaultNamespace;
    this.quotas.set(getDefaultQuotas());
  };

  addQuota = async () => {
    const { quotaName, namespace } = this;

    if (!quotaName || !namespace) {
      return;
    }

    try {
      const quotas = Object.fromEntries(this.quotaEntries);

      await this.props.resourceQuotaApi.create(
        { namespace, name: quotaName },
        {
          spec: {
            hard: quotas,
          },
        },
      );
      this.close();
    } catch (err) {
      // 🆕 FIX-038: clusterName 추가
      const clusterName = this.props.hostedCluster?.name.get() ?? "Unknown Cluster";
      notificationPanelStore.addCheckedError("operations", err, "Unknown error occurred while creating ResourceQuota", {
        clusterName,
      });
    }
  };

  onInputQuota = (evt: React.KeyboardEvent) => {
    switch (evt.key) {
      case "Enter":
        this.setQuota();
        evt.preventDefault(); // don't submit form
        break;
    }
  };

  /**
   * 🎯 목적: shadcn UI 기반 렌더링
   */
  render() {
    const { isAddQuotaDialogOpen } = this.props;
    const { quotaName, namespace, quotaSelectValue, quotaInputValue } = this;
    const isOpen = isAddQuotaDialogOpen.get();

    // 유효성 검증 (systemName.validate는 boolean 반환)
    const isValid = quotaName.trim().length > 0 && namespace !== null && systemName.validate(quotaName.trim());

    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && this.close()}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Create ResourceQuota</DialogTitle>
          </DialogHeader>

          {/* ============================================ */}
          {/* 🎯 폼 입력 영역 */}
          {/* ============================================ */}
          <div className="flex flex-col gap-4 py-4">
            {/* ResourceQuota Name */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="quotaName">ResourceQuota Name</Label>
              <Input
                id="quotaName"
                placeholder="Enter ResourceQuota name"
                value={quotaName}
                onChange={(e) => (this.quotaName = e.target.value.toLowerCase())}
                autoFocus
              />
            </div>

            {/* Namespace Select */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="namespace">Namespace</Label>
              <ShadcnSelect value={namespace ?? undefined} onValueChange={(value) => (this.namespace = value)}>
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
              </ShadcnSelect>
            </div>

            {/* Quota Values */}
            <div className="flex flex-col gap-2">
              <Label>Quota Values</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <ShadcnSelect
                    value={quotaSelectValue ?? undefined}
                    onValueChange={(value) => (this.quotaSelectValue = value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a quota..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.keys(this.quotas.get()).map((quota) => {
                        const iconMaterial = this.getQuotaOptionLabelIconMaterial(quota);

                        return (
                          <SelectItem key={quota} value={quota}>
                            {iconMaterial ? (
                              <span className="flex items-center gap-2">
                                <Icon material={iconMaterial} small />
                                {quota}
                              </span>
                            ) : (
                              quota
                            )}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </ShadcnSelect>
                </div>
                <Input
                  maxLength={10}
                  placeholder="Value"
                  value={quotaInputValue}
                  onChange={(e) => (this.quotaInputValue = e.target.value)}
                  onKeyDown={this.onInputQuota}
                  className="flex-1"
                />
                <Button
                  variant="default"
                  size="icon"
                  onClick={this.setQuota}
                  disabled={!quotaSelectValue}
                  title="Add quota"
                >
                  <Icon
                    material={quotaSelectValue && this.quotas.get()[quotaSelectValue] ? "edit" : "add"}
                    tooltip="Set quota"
                  />
                </Button>
              </div>
            </div>

            {/* Quota Entries (Added Quotas) */}
            {this.quotaEntries.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label>Added Quotas ({this.quotaEntries.length})</Label>
                <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[50px]">
                  {this.quotaEntries.map(([quota, value]) => (
                    <div key={quota} className="flex items-center gap-1 h-fit">
                      <Badge variant="outline">{quota}</Badge>
                      <Badge variant="secondary">{value}</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => (this.quotas.get()[quota] = "")}
                        title="Remove quota"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ============================================ */}
          {/* 🎯 액션 버튼 (Cancel, Create) */}
          {/* ============================================ */}
          <DialogFooter>
            <Button variant="ghost" onClick={this.close}>
              Cancel
            </Button>
            <Button variant="default" onClick={this.addQuota} disabled={!isValid}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
}

export const AddQuotaDialog = withInjectables<Dependencies, AddQuotaDialogProps>(observer(NonInjectedAddQuotaDialog), {
  getProps: (di, props) => ({
    ...props,
    closeAddQuotaDialog: di.inject(closeAddQuotaDialogInjectable),
    isAddQuotaDialogOpen: di.inject(isAddQuotaDialogOpenInjectable),
    resourceQuotaApi: di.inject(resourceQuotaApiInjectable),
    clusterContext: di.inject(clusterFrameContextForNamespacedResourcesInjectable),
    // 🆕 FIX-038: hostedCluster DI 추가
    hostedCluster: di.inject(hostedClusterInjectable),
  }),
});
