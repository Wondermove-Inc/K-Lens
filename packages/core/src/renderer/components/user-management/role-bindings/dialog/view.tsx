/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: RoleBinding 생성/편집 다이얼로그 - shadcn UI 기반 구현
 *
 * 구성 요소:
 * - shadcn Dialog 컴포넌트 (DialogContent, DialogHeader, DialogFooter)
 * - shadcn Input, Button, Label, Select
 * - EditableList 컴포넌트 (레거시 유지 - Users, Groups)
 * - Select 컴포넌트 (레거시 유지 - Role Reference, Service Accounts - Icon 포맷 때문)
 * - MobX observable 상태 관리
 * - ClusterContext로 namespace 목록 조회
 *
 * 📝 주요 기능:
 * - RoleBinding 생성 및 편집 모드 지원
 * - Role/ClusterRole 선택
 * - Users, Groups, ServiceAccounts 바인딩
 * - ObservableHashSet으로 ServiceAccount 관리
 * - observable.set으로 Users/Groups 관리
 *
 * 📝 주의사항:
 * - RoleBinding은 namespace-scoped 리소스
 * - 편집 모드에서는 Namespace, Role Reference, Binding Name 수정 불가
 * - Users와 Groups는 EditableList로 동적 추가/삭제 (레거시 유지)
 * - Role Reference와 ServiceAccounts는 레거시 Select 유지 (Icon formatOptionLabel 때문)
 *
 * 🔄 변경이력:
 * - 2025-11-20: shadcn UI로 마이그레이션 (레거시 Dialog/Wizard 제거)
 * - 2025-11-20: NamespaceSelect를 shadcn Select로 교체
 */

import "./view.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Icon } from "@skuberplus/icon";
import { roleApiInjectable } from "@skuberplus/kube-api-specifics";
import { Input } from "@skuberplus/storybook-shadcn";
import { iter, ObservableHashSet } from "@skuberplus/utilities";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { action, computed, makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import React, { Component } from "react";
import clusterFrameContextForNamespacedResourcesInjectable from "../../../../cluster-frame-context/for-namespaced-resources.injectable";
import hostedClusterInjectable from "../../../../cluster-frame-context/hosted-cluster.injectable";
import { cn } from "../../../../lib/utils";
import showDetailsInjectable from "../../../kube-detail-params/show-details.injectable";
import { Badge } from "../../../shadcn-ui/badge";
import { Button } from "../../../shadcn-ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../../shadcn-ui/command";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../../shadcn-ui/dialog";
import { Label } from "../../../shadcn-ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../../../shadcn-ui/popover";
import {
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Select as ShadcnSelect,
} from "../../../shadcn-ui/select";
import { notificationPanelStore } from "../../../status-bar/items/notification-panel.store";
import clusterRoleStoreInjectable from "../../cluster-roles/store.injectable";
import roleStoreInjectable from "../../roles/store.injectable";
import serviceAccountStoreInjectable from "../../service-accounts/store.injectable";
import roleBindingStoreInjectable from "../store.injectable";
import closeRoleBindingDialogInjectable from "./close.injectable";
import roleBindingDialogStateInjectable from "./state.injectable";

import type { RoleApi } from "@skuberplus/kube-api";
import type { ClusterRole, Role, ServiceAccount, Subject } from "@skuberplus/kube-object";

import type { IObservableValue } from "mobx";

import type { ClusterContext } from "../../../../cluster-frame-context/cluster-frame-context";
import type { HostedCluster } from "../../../../cluster-frame-context/hosted-cluster.injectable";
import type { ShowDetails } from "../../../kube-detail-params/show-details.injectable";
import type { ClusterRoleStore } from "../../cluster-roles/store";
import type { RoleStore } from "../../roles/store";
import type { ServiceAccountStore } from "../../service-accounts/store";
import type { RoleBindingStore } from "../store";
import type { RoleBindingDialogState } from "./state.injectable";

/**
 * 🎯 목적: RoleBindingDialog Props 인터페이스
 */
export interface RoleBindingDialogProps {}

/**
 * 🎯 목적: Dependencies 인터페이스
 */
interface Dependencies {
  state: IObservableValue<RoleBindingDialogState>;
  roleBindingStore: RoleBindingStore;
  closeRoleBindingDialog: () => void;
  showDetails: ShowDetails;
  roleStore: RoleStore;
  clusterRoleStore: ClusterRoleStore;
  serviceAccountStore: ServiceAccountStore;
  roleApi: RoleApi;
  clusterContext: ClusterContext;
  hostedCluster: HostedCluster | undefined;
}

/**
 * 🎯 목적: RoleBindingDialog 컴포넌트 (MobX observer)
 */
class NonInjectedRoleBindingDialog extends Component<RoleBindingDialogProps & Dependencies> {
  constructor(props: RoleBindingDialogProps & Dependencies) {
    super(props);
    makeObservable(this);
  }

  @computed get roleBinding() {
    return this.props.state.get().roleBinding;
  }

  @computed get isEditing() {
    return !!this.roleBinding;
  }

  /**
   * 🎯 목적: Namespace 목록 가져오기 (computed)
   */
  @computed get namespaceOptions() {
    return this.props.clusterContext.allNamespaces;
  }

  @observable.ref selectedRoleRef: Role | ClusterRole | null | undefined = null;
  @observable bindingName = "";
  @observable bindingNamespace: string | null = null;
  @observable roleComboboxOpen = false;
  @observable serviceAccountComboboxOpen = false;
  selectedAccounts = new ObservableHashSet<ServiceAccount>([], (sa) => sa.getId());
  selectedUsers = observable.set<string>([]);
  selectedGroups = observable.set<string>([]);

  @computed get selectedBindings(): Subject[] {
    const serviceAccounts: Subject[] = Array.from(this.selectedAccounts, (sa) => ({
      name: sa.getName(),
      kind: "ServiceAccount",
      namespace: sa.getNs(),
    }));
    const users: Subject[] = Array.from(this.selectedUsers, (user) => ({
      name: user,
      kind: "User",
    }));
    const groups: Subject[] = Array.from(this.selectedGroups, (group) => ({
      name: group,
      kind: "Group",
    }));

    return [...serviceAccounts, ...users, ...groups];
  }

  @computed get roleRefOptions() {
    const { roleStore, clusterRoleStore } = this.props;
    const roles = roleStore.items.filter((role) => role.getNs() === this.bindingNamespace);
    const clusterRoles = clusterRoleStore.items;

    return [...roles, ...clusterRoles].map((r) => ({
      value: r,
      label: r.getName(),
    }));
  }

  @computed get serviceAccountOptions() {
    return this.props.serviceAccountStore.items.map((serviceAccount) => ({
      value: serviceAccount,
      label: `${serviceAccount.getName()} (${serviceAccount.getNs()})`,
    }));
  }

  /**
   * 🎯 목적: 다이얼로그 열릴 때 초기화 (Create) 또는 데이터 로드 (Edit)
   */
  onOpen = action(() => {
    const { roleStore, clusterRoleStore, serviceAccountStore, roleApi } = this.props;
    const binding = this.roleBinding;

    if (!binding) {
      return this.reset();
    }

    // 편집 모드: 기존 RoleBinding 데이터 로드
    this.selectedRoleRef =
      binding.roleRef.kind === roleApi.kind
        ? roleStore.items.find((item) => item.getName() === binding.roleRef.name)
        : clusterRoleStore.items.find((item) => item.getName() === binding.roleRef.name);

    this.bindingName = binding.getName();
    this.bindingNamespace = binding.getNs();

    const [saSubjects, uSubjects, gSubjects] = iter.nFircate(binding.getSubjects(), "kind", [
      "ServiceAccount",
      "User",
      "Group",
    ]);
    const accountNames = new Set(saSubjects.map((acc) => acc.name));

    this.selectedAccounts.replace(serviceAccountStore.items.filter((sa) => accountNames.has(sa.getName())));
    this.selectedUsers.replace(uSubjects.map((user) => user.name));
    this.selectedGroups.replace(gSubjects.map((group) => group.name));
  });

  /**
   * 🎯 목적: 입력 필드 초기화
   */
  reset = action(() => {
    this.selectedRoleRef = null;
    this.bindingName = "";
    this.bindingNamespace = "";
    this.roleComboboxOpen = false;
    this.serviceAccountComboboxOpen = false;
    this.selectedAccounts.clear();
    this.selectedUsers.clear();
    this.selectedGroups.clear();
  });

  /**
   * 🎯 목적: RoleBinding 생성 또는 업데이트 실행
   */
  createBindings = async () => {
    const { roleBindingStore, showDetails, hostedCluster } = this.props;
    const { selectedRoleRef, bindingNamespace, selectedBindings, roleBinding, bindingName } = this;

    // 유효성 검증
    if (!selectedRoleRef || !roleBinding || !bindingNamespace || !bindingName) {
      return;
    }

    try {
      const newRoleBinding = this.isEditing
        ? await roleBindingStore.updateSubjects(roleBinding, selectedBindings)
        : await roleBindingStore.create(
            {
              name: bindingName,
              namespace: bindingNamespace,
            },
            {
              subjects: selectedBindings,
              roleRef: {
                name: selectedRoleRef.getName(),
                kind: selectedRoleRef.kind,
              },
            },
          );

      showDetails(newRoleBinding.selfLink);
      this.props.closeRoleBindingDialog();
    } catch (err) {
      // 🆕 FIX-038: clusterName metadata 추가
      const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
      notificationPanelStore.addCheckedError(
        "operations",
        err,
        `Unknown error occurred while ${this.isEditing ? "editing" : "creating"} role bindings.`,
        { clusterName },
      );
    }
  };

  /**
   * 🎯 목적: 다이얼로그 닫기 (onOpenChange 핸들러)
   */
  handleOpenChange = (open: boolean) => {
    if (!open) {
      this.reset();
      this.props.closeRoleBindingDialog();
    }
  };

  /**
   * 🎯 목적: shadcn UI 기반 렌더링
   */
  render() {
    const { state } = this.props;
    const isOpen = state.get().isOpen;
    const [dialogAction, nextLabel] = this.isEditing ? ["Edit", "Update"] : ["Add", "Create"];
    const disableNext =
      !this.selectedRoleRef || !this.selectedBindings.length || !this.bindingNamespace || !this.bindingName;

    // 다이얼로그 열릴 때 onOpen 호출
    if (isOpen && this.roleBinding !== undefined) {
      this.onOpen();
    }

    return (
      <Dialog open={isOpen} onOpenChange={this.handleOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogAction} RoleBinding</DialogTitle>
          </DialogHeader>

          {/* ============================================ */}
          {/* 🎯 폼 입력 영역 */}
          {/* ============================================ */}
          <div className="flex flex-col gap-4 py-4">
            {/* Namespace Select */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="dialog-namespace-input">Namespace</Label>
              <ShadcnSelect
                value={this.bindingNamespace ?? undefined}
                onValueChange={(value) => (this.bindingNamespace = value)}
                disabled={this.isEditing}
              >
                <SelectTrigger id="dialog-namespace-input" className="w-full">
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

            {/* Role Reference - shadcn Combobox */}
            <div className="flex flex-col gap-2">
              <Label>Role Reference</Label>
              <Popover
                open={this.roleComboboxOpen}
                onOpenChange={action((open) => {
                  this.roleComboboxOpen = open;
                })}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={this.roleComboboxOpen}
                    className="w-full justify-between"
                    disabled={this.isEditing}
                  >
                    {this.selectedRoleRef ? (
                      <span className="flex items-center gap-2">
                        <Icon small material="people" />
                        {this.selectedRoleRef.getName()}
                        <span className="text-muted-foreground text-xs">({this.selectedRoleRef.kind})</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Select role or cluster role ...</span>
                    )}
                    <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0" align="start" style={{ width: "var(--radix-popover-trigger-width)" }}>
                  <Command>
                    <CommandInput placeholder="Search role..." />
                    <CommandList>
                      <CommandEmpty>No role found.</CommandEmpty>
                      <CommandGroup>
                        {this.roleRefOptions.map((option) => (
                          <CommandItem
                            key={option.value.getId()}
                            value={`${option.label} ${option.value.kind}`}
                            onSelect={action(() => {
                              this.selectedRoleRef = option.value;
                              this.roleComboboxOpen = false;
                              if (!this.bindingName || this.bindingName === option.value.getName()) {
                                this.bindingName = option.value.getName();
                              }
                            })}
                          >
                            <Icon small material="people" />
                            <span className="ml-2">{option.label}</span>
                            <span className="ml-2 text-muted-foreground text-xs">({option.value.kind})</span>
                            <Check
                              className={cn(
                                "ml-auto size-4",
                                this.selectedRoleRef?.getId() === option.value.getId() ? "opacity-100" : "opacity-0",
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Binding Name */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="binding-name-input">Binding Name</Label>
              <Input
                id="binding-name-input"
                disabled={this.isEditing}
                value={this.bindingName}
                onChange={(e) => (this.bindingName = e.target.value)}
                placeholder="Name of RoleBinding..."
              />
            </div>

            {/* Binding Targets */}
            <div className="flex flex-col gap-4 pt-2">
              <Label className="text-base font-semibold">Binding Targets</Label>

              {/* Users - shadcn Input + Badge */}
              <div className="flex flex-col gap-2">
                <Label className="font-medium">Users</Label>
                {this.selectedUsers.size > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {Array.from(this.selectedUsers).map((user) => (
                      <Badge key={user} variant="secondary" className="gap-1">
                        {user}
                        <X
                          className="size-3 cursor-pointer hover:text-destructive"
                          onClick={action(() => this.selectedUsers.delete(user))}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
                <Input
                  placeholder="Add user (Enter to add)..."
                  onKeyDown={action((e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter" && e.currentTarget.value.trim()) {
                      e.preventDefault();
                      const value = e.currentTarget.value.trim();
                      // 콤마로 구분된 여러 값 지원
                      const users = value
                        .split(",")
                        .map((u) => u.trim())
                        .filter(Boolean);
                      for (const user of users) {
                        this.selectedUsers.add(user);
                      }
                      e.currentTarget.value = "";
                    }
                  })}
                />
              </div>

              {/* Groups - shadcn Input + Badge */}
              <div className="flex flex-col gap-2">
                <Label className="font-medium">Groups</Label>
                {this.selectedGroups.size > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {Array.from(this.selectedGroups).map((group) => (
                      <Badge key={group} variant="secondary" className="gap-1">
                        {group}
                        <X
                          className="size-3 cursor-pointer hover:text-destructive"
                          onClick={action(() => this.selectedGroups.delete(group))}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
                <Input
                  placeholder="Add group (Enter to add)..."
                  onKeyDown={action((e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter" && e.currentTarget.value.trim()) {
                      e.preventDefault();
                      const value = e.currentTarget.value.trim();
                      // 콤마로 구분된 여러 값 지원
                      const groups = value
                        .split(",")
                        .map((g) => g.trim())
                        .filter(Boolean);
                      for (const group of groups) {
                        this.selectedGroups.add(group);
                      }
                      e.currentTarget.value = "";
                    }
                  })}
                />
              </div>

              {/* Service Accounts - shadcn Multi-select Combobox */}
              <div className="flex flex-col gap-2">
                <Label className="font-medium">Service Accounts</Label>
                {this.selectedAccounts.size > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {Array.from(this.selectedAccounts).map((sa) => (
                      <Badge key={sa.getId()} variant="secondary" className="gap-1">
                        <Icon small material="account_box" />
                        {sa.getName()} ({sa.getNs()})
                        <X
                          className="size-3 cursor-pointer hover:text-destructive"
                          style={{ pointerEvents: "auto" }}
                          onClick={action((e: React.MouseEvent) => {
                            e.stopPropagation();
                            this.selectedAccounts.delete(sa);
                          })}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
                <Popover
                  open={this.serviceAccountComboboxOpen}
                  onOpenChange={action((open) => {
                    this.serviceAccountComboboxOpen = open;
                  })}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={this.serviceAccountComboboxOpen}
                      className="w-full justify-between"
                    >
                      <span className="text-muted-foreground">Select service accounts ...</span>
                      <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0" align="start" style={{ width: "var(--radix-popover-trigger-width)" }}>
                    <Command>
                      <CommandInput placeholder="Search service account..." />
                      <CommandList>
                        <CommandEmpty>No service account found.</CommandEmpty>
                        <CommandGroup>
                          {this.serviceAccountOptions.map((option) => (
                            <CommandItem
                              key={option.value.getId()}
                              value={option.label}
                              onSelect={action(() => {
                                if (this.selectedAccounts.has(option.value)) {
                                  this.selectedAccounts.delete(option.value);
                                } else {
                                  this.selectedAccounts.add(option.value);
                                }
                              })}
                            >
                              <div
                                className={cn(
                                  "mr-2 flex size-4 items-center justify-center rounded-sm border border-primary",
                                  this.selectedAccounts.has(option.value)
                                    ? "bg-primary text-primary-foreground"
                                    : "opacity-50 [&_svg]:invisible",
                                )}
                              >
                                <Check className="size-3" />
                              </div>
                              <Icon small material="account_box" />
                              <span className="ml-2">{option.label}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* ============================================ */}
          {/* 🎯 액션 버튼 (Cancel, Create/Update) */}
          {/* ============================================ */}
          <DialogFooter>
            <Button variant="ghost" onClick={() => this.handleOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="default" onClick={this.createBindings} disabled={disableNext}>
              {nextLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
}

export const RoleBindingDialog = withInjectables<Dependencies, RoleBindingDialogProps>(
  observer(NonInjectedRoleBindingDialog),
  {
    getProps: (di, props) => ({
      ...props,
      roleBindingStore: di.inject(roleBindingStoreInjectable),
      state: di.inject(roleBindingDialogStateInjectable),
      closeRoleBindingDialog: di.inject(closeRoleBindingDialogInjectable),
      showDetails: di.inject(showDetailsInjectable),
      clusterRoleStore: di.inject(clusterRoleStoreInjectable),
      roleStore: di.inject(roleStoreInjectable),
      serviceAccountStore: di.inject(serviceAccountStoreInjectable),
      roleApi: di.inject(roleApiInjectable),
      clusterContext: di.inject(clusterFrameContextForNamespacedResourcesInjectable),
      hostedCluster: di.inject(hostedClusterInjectable),
    }),
  },
);
