/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Secret 생성 다이얼로그 - shadcn UI 기반 구현
 *
 * 구성 요소:
 * - shadcn Dialog 컴포넌트 (DialogContent, DialogHeader, DialogFooter)
 * - shadcn Input, Button, Label, Select
 * - MobX observable 상태 관리
 * - ClusterContext로 namespace 목록 조회
 *
 * 📝 주요 기능:
 * - Secret 생성 (Opaque, ServiceAccountToken 타입 지원)
 * - Data 필드 동적 추가/삭제 (key-value 쌍)
 * - Labels 필드 동적 추가/삭제
 * - Annotations 필드 동적 추가/삭제
 *
 * 🔄 변경이력:
 * - 2025-12-05: shadcn UI로 마이그레이션 (레거시 Dialog/Wizard 제거)
 */

import "./view.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { secretApiInjectable } from "@skuberplus/kube-api-specifics";
import { reverseSecretTypeMap, SecretType } from "@skuberplus/kube-object";
import { Input } from "@skuberplus/storybook-shadcn";
import { base64, iter, object } from "@skuberplus/utilities";
import { Plus, Trash2 } from "lucide-react";
import { action, makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import React, { Component } from "react";
import clusterFrameContextForNamespacedResourcesInjectable from "../../../cluster-frame-context/for-namespaced-resources.injectable";
import hostedClusterInjectable from "../../../cluster-frame-context/hosted-cluster.injectable";
import showDetailsInjectable from "../../kube-detail-params/show-details.injectable";
import { Button } from "../../shadcn-ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../shadcn-ui/dialog";
import { Label } from "../../shadcn-ui/label";
import { SelectContent, SelectItem, SelectTrigger, SelectValue, Select as ShadcnSelect } from "../../shadcn-ui/select";
import { notificationPanelStore } from "../../status-bar/items/notification-panel.store";
import closeAddSecretDialogInjectable from "./close.injectable";
import isAddSecretDialogOpenInjectable from "./is-open.injectable";

import type { SecretApi } from "@skuberplus/kube-api";

import type { IComputedValue } from "mobx";

import type { Cluster } from "../../../../common/cluster/cluster";
import type { ClusterContext } from "../../../cluster-frame-context/cluster-frame-context";
import type { ShowDetails } from "../../kube-detail-params/show-details.injectable";

export interface AddSecretDialogProps {}

interface SecretTemplateField {
  key: string;
  value?: string;
  required?: boolean;
}

interface SecretTemplate {
  [field: string]: SecretTemplateField[] | undefined;
  annotations?: SecretTemplateField[];
  labels?: SecretTemplateField[];
  data?: SecretTemplateField[];
}

type ISecretField = keyof SecretTemplate;

interface Dependencies {
  secretApi: SecretApi;
  isAddSecretDialogOpen: IComputedValue<boolean>;
  closeAddSecretDialog: () => void;
  showDetails: ShowDetails;
  clusterContext: ClusterContext;
  hostedCluster: Cluster | undefined;
}

/**
 * 🎯 목적: AddSecretDialog 컴포넌트 (MobX observer)
 */
class NonInjectedAddSecretDialog extends Component<AddSecretDialogProps & Dependencies> {
  constructor(props: AddSecretDialogProps & Dependencies) {
    super(props);
    makeObservable(this);
  }

  private secretTemplate: Partial<Record<SecretType, SecretTemplate>> = {
    [SecretType.Opaque]: {},
    [SecretType.ServiceAccountToken]: {
      annotations: [
        { key: "kubernetes.io/service-account.name", required: true },
        { key: "kubernetes.io/service-account.uid", required: true },
      ],
    },
  };

  @observable secret = this.secretTemplate;
  @observable name = "";
  @observable namespace = "default";
  @observable type = SecretType.Opaque;

  /**
   * 🎯 목적: 입력 필드 초기화
   */
  reset = action(() => {
    this.name = "";
    this.namespace = "default";
    this.type = SecretType.Opaque;
    this.secret = this.secretTemplate;
  });

  /**
   * 🎯 목적: 다이얼로그 닫기
   */
  close = () => {
    this.props.closeAddSecretDialog();
  };

  /**
   * 🎯 목적: 다이얼로그 열기/닫기 핸들러 (onOpenChange)
   */
  handleOpenChange = (open: boolean) => {
    if (open) {
      this.reset();
    } else {
      this.close();
    }
  };

  private getDataFromFields = (
    fields: SecretTemplateField[] = [],
    processValue: (val: string) => string = (val) => val,
  ) => {
    return iter
      .chain(fields.values())
      .filterMap(({ key, value }) => (value ? ([key, processValue(value)] as const) : undefined))
      .collect(object.fromEntries);
  };

  /**
   * 🎯 목적: Secret 생성 실행
   */
  createSecret = async () => {
    const { name, namespace, type } = this;
    const { data = [], labels = [], annotations = [] } = this.secret[type] ?? {};
    // 🆕 FIX-038: clusterName 메타데이터 추가
    const clusterName = this.props.hostedCluster?.name.get() ?? "Unknown Cluster";

    try {
      const newSecret = await this.props.secretApi.create(
        { namespace, name },
        {
          type,
          data: this.getDataFromFields(data, (val) => (val ? base64.encode(val) : "")),
          metadata: {
            name,
            namespace,
            annotations: this.getDataFromFields(annotations),
            labels: this.getDataFromFields(labels),
          },
        },
      );

      this.props.showDetails(newSecret?.selfLink);
      this.close();
    } catch (err) {
      notificationPanelStore.addCheckedError("operations", err, "Unknown error occurred while creating a Secret", {
        clusterName,
      });
    }
  };

  private getFields(field: ISecretField) {
    return ((this.secret[this.type] ??= {})[field] ??= []);
  }

  /**
   * 🎯 목적: 필드 추가
   */
  addField = action((field: ISecretField) => {
    this.getFields(field).push({ key: "", value: "" });
  });

  /**
   * 🎯 목적: 필드 제거
   */
  removeField = action((field: ISecretField, index: number) => {
    this.getFields(field).splice(index, 1);
  });

  /**
   * 🎯 목적: 동적 필드 렌더링 (annotations, labels, data)
   */
  renderFields(field: ISecretField, title: string) {
    const fields = this.getFields(field);

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label className="font-medium">{title}</Label>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => this.addField(field)}>
            <Plus className="size-4 mr-1" />
            Add
          </Button>
        </div>
        {fields.length > 0 && (
          <div className="flex flex-col gap-2">
            {fields.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  placeholder="Key"
                  title={item.key}
                  tabIndex={item.required ? -1 : 0}
                  readOnly={item.required}
                  value={item.key}
                  onChange={action((e) => {
                    item.key = e.target.value;
                  })}
                />
                <Input
                  className="flex-1"
                  placeholder="Value"
                  value={item.value ?? ""}
                  onChange={action((e) => {
                    item.value = e.target.value;
                  })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  disabled={item.required}
                  title={item.required ? "Required field" : "Remove field"}
                  onClick={() => this.removeField(field, index)}
                >
                  <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  render() {
    const { isAddSecretDialogOpen, clusterContext } = this.props;
    const { namespace, name, type } = this;
    const isOpen = isAddSecretDialogOpen.get();
    const namespaceOptions = clusterContext.allNamespaces;
    const secretTypeOptions = Object.keys(this.secretTemplate) as SecretType[];
    const isValid = name.trim().length > 0;

    return (
      <Dialog open={isOpen} onOpenChange={this.handleOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Secret</DialogTitle>
          </DialogHeader>

          {/* ============================================ */}
          {/* 🎯 폼 입력 영역 */}
          {/* ============================================ */}
          <div className="flex flex-col gap-4 py-4">
            {/* Secret Name */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="secret-name">Secret Name</Label>
              <Input
                id="secret-name"
                placeholder="Enter secret name"
                value={name}
                onChange={action((e) => {
                  this.name = e.target.value;
                })}
                autoFocus
              />
            </div>

            {/* Namespace & Secret Type */}
            <div className="grid grid-cols-2 gap-4">
              {/* Namespace Select */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="secret-namespace">Namespace</Label>
                <ShadcnSelect
                  value={namespace}
                  onValueChange={action((value) => {
                    this.namespace = value;
                  })}
                >
                  <SelectTrigger id="secret-namespace" className="w-full">
                    <SelectValue placeholder="Select namespace..." />
                  </SelectTrigger>
                  <SelectContent>
                    {namespaceOptions.map((ns: string) => (
                      <SelectItem key={ns} value={ns}>
                        {ns}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </ShadcnSelect>
              </div>

              {/* Secret Type Select */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="secret-type">Secret Type</Label>
                <ShadcnSelect
                  value={type}
                  onValueChange={action((value: SecretType) => {
                    this.type = value;
                  })}
                >
                  <SelectTrigger id="secret-type" className="w-full">
                    <SelectValue placeholder="Select secret type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {secretTypeOptions.map((secretType) => (
                      <SelectItem key={secretType} value={secretType}>
                        {reverseSecretTypeMap[secretType]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </ShadcnSelect>
              </div>
            </div>

            {/* Annotations */}
            {this.renderFields("annotations", "Annotations")}

            {/* Labels */}
            {this.renderFields("labels", "Labels")}

            {/* Data */}
            {this.renderFields("data", "Data")}
          </div>

          {/* ============================================ */}
          {/* 🎯 액션 버튼 (Cancel, Create) */}
          {/* ============================================ */}
          <DialogFooter>
            <Button variant="ghost" onClick={this.close}>
              Cancel
            </Button>
            <Button variant="default" onClick={this.createSecret} disabled={!isValid}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
}

export const AddSecretDialog = withInjectables<Dependencies, AddSecretDialogProps>(
  observer(NonInjectedAddSecretDialog),
  {
    getProps: (di, props) => ({
      ...props,
      closeAddSecretDialog: di.inject(closeAddSecretDialogInjectable),
      secretApi: di.inject(secretApiInjectable),
      showDetails: di.inject(showDetailsInjectable),
      isAddSecretDialogOpen: di.inject(isAddSecretDialogOpenInjectable),
      clusterContext: di.inject(clusterFrameContextForNamespacedResourcesInjectable),
      hostedCluster: di.inject(hostedClusterInjectable),
    }),
  },
);
