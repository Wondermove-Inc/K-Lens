/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: ClusterRoleBinding 생성/편집 다이얼로그 - shadcn UI 기반 구현
 *
 * 구성 요소:
 * - shadcn Dialog 컴포넌트 (DialogContent, DialogHeader, DialogFooter)
 * - shadcn Input, Button, Label
 * - Select 컴포넌트 (레거시 유지 - ClusterRole Reference, Service Accounts)
 * - EditableList 컴포넌트 (레거시 유지 - Users, Groups)
 * - MobX observable 상태 관리
 *
 * 📝 주요 기능:
 * - ClusterRoleBinding 생성 및 편집 모드 지원
 * - ClusterRole 선택
 * - Users, Groups, ServiceAccounts 바인딩
 * - ObservableHashSet으로 ServiceAccount 관리
 * - observable.set으로 Users/Groups 관리
 *
 * 📝 주의사항:
 * - ClusterRoleBinding은 cluster-scoped 리소스 (namespace 없음)
 * - 편집 모드에서는 ClusterRole Reference, Binding Name 수정 불가
 * - Users와 Groups는 EditableList로 동적 추가/삭제
 * - ServiceAccounts는 Multi-select로 선택
 *
 * 🔄 변경이력:
 * - 2025-11-20: shadcn UI로 마이그레이션 (레거시 Dialog/Wizard 제거)
 */

import "./view.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Icon } from "@skuberplus/icon";
import { Input } from "@skuberplus/storybook-shadcn";
import { TooltipPosition } from "@skuberplus/tooltip";
import { iter, ObservableHashSet } from "@skuberplus/utilities";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { action, computed, makeObservable, observable } from "mobx";
import { observer } from "mobx-react";
import React, { Component } from "react";
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
import { notificationPanelStore } from "../../../status-bar/items/notification-panel.store";
import clusterRoleStoreInjectable from "../../cluster-roles/store.injectable";
import serviceAccountStoreInjectable from "../../service-accounts/store.injectable";
import clusterRoleBindingStoreInjectable from "../store.injectable";
import closeClusterRoleBindingDialogInjectable from "./close.injectable";
import editClusterRoleBindingNameStateInjectable from "./edit-name-state.injectable";
import openClusterRoleBindingDialogInjectable from "./open.injectable";
import clusterRoleBindingDialogStateInjectable from "./state.injectable";

import type { ClusterRole, ServiceAccount, Subject } from "@skuberplus/kube-object";

import type { IObservableValue } from "mobx";

import type { HostedCluster } from "../../../../cluster-frame-context/hosted-cluster.injectable";
import type { ShowDetails } from "../../../kube-detail-params/show-details.injectable";
import type { ClusterRoleStore } from "../../cluster-roles/store";
import type { ServiceAccountStore } from "../../service-accounts/store";
import type { ClusterRoleBindingStore } from "../store";
import type { CloseClusterRoleBindingDialog } from "./close.injectable";
import type { OpenClusterRoleBindingDialog } from "./open.injectable";
import type { ClusterRoleBindingDialogState } from "./state.injectable";

/**
 * 🎯 목적: ClusterRoleBindingDialog Props 인터페이스
 */
export interface ClusterRoleBindingDialogProps {}

/**
 * 🎯 목적: Dependencies 인터페이스
 */
interface Dependencies {
  state: IObservableValue<ClusterRoleBindingDialogState>;
  editBindingNameState: IObservableValue<string>;
  clusterRoleStore: ClusterRoleStore;
  serviceAccountStore: ServiceAccountStore;
  clusterRoleBindingStore: ClusterRoleBindingStore;
  closeClusterRoleBindingDialog: CloseClusterRoleBindingDialog;
  openClusterRoleBindingDialog: OpenClusterRoleBindingDialog;
  showDetails: ShowDetails;
  hostedCluster: HostedCluster | undefined;
}

/**
 * 🎯 목적: ClusterRoleBindingDialog 컴포넌트 (MobX observer)
 */
class NonInjectedClusterRoleBindingDialog extends Component<ClusterRoleBindingDialogProps & Dependencies> {
  constructor(props: ClusterRoleBindingDialogProps & Dependencies) {
    super(props);
    makeObservable(this);
  }

  @computed get clusterRoleOptions() {
    return this.props.clusterRoleStore.items.map((clusterRole) => ({
      value: clusterRole,
      label: clusterRole.getName(),
    }));
  }

  @computed get serviceAccountOptions() {
    return this.props.serviceAccountStore.items.map((serviceAccount) => ({
      value: serviceAccount,
      label: `${serviceAccount.getName()} (${serviceAccount.getNs()})`,
      isSelected: this.selectedAccounts.has(serviceAccount),
    }));
  }

  get clusterRoleBinding() {
    return this.props.state.get().clusterRoleBinding;
  }

  get isEditing() {
    return !!this.clusterRoleBinding;
  }

  @observable selectedRoleRef: ClusterRole | undefined = undefined;
  @observable clusterRoleComboboxOpen = false;
  @observable serviceAccountComboboxOpen = false;
  selectedAccounts = new ObservableHashSet<ServiceAccount>([], (sa) => sa.getId());
  selectedUsers = observable.set<string>([]);
  selectedGroups = observable.set<string>([]);

  @computed get selectedBindings(): Subject[] {
    const serviceAccounts = Array.from(this.selectedAccounts, (sa) => ({
      name: sa.getName(),
      kind: "ServiceAccount" as const,
      namespace: sa.getNs(),
    }));
    const users = Array.from(this.selectedUsers, (user) => ({
      name: user,
      kind: "User" as const,
    }));
    const groups = Array.from(this.selectedGroups, (group) => ({
      name: group,
      kind: "Group" as const,
    }));

    return [...serviceAccounts, ...users, ...groups];
  }

  /**
   * 🎯 목적: 다이얼로그 열릴 때 초기화 (Create) 또는 데이터 로드 (Edit)
   */
  onOpen = action(() => {
    const binding = this.clusterRoleBinding;

    if (!binding) {
      return this.reset();
    }

    // 편집 모드: 기존 ClusterRoleBinding 데이터 로드
    this.selectedRoleRef = this.props.clusterRoleStore.items.find((item) => item.getName() === binding.roleRef.name);

    const [saSubjects, uSubjects, gSubjects] = iter.nFircate(binding.getSubjects(), "kind", [
      "ServiceAccount",
      "User",
      "Group",
    ]);
    const accountNames = new Set(saSubjects.map((acc) => acc.name));

    this.selectedAccounts.replace(this.props.serviceAccountStore.items.filter((sa) => accountNames.has(sa.getName())));
    this.selectedUsers.replace(uSubjects.map((user) => user.name));
    this.selectedGroups.replace(gSubjects.map((group) => group.name));
  });

  /**
   * 🎯 목적: 입력 필드 초기화
   */
  reset = action(() => {
    this.selectedRoleRef = undefined;
    this.clusterRoleComboboxOpen = false;
    this.serviceAccountComboboxOpen = false;
    this.selectedAccounts.clear();
    this.selectedUsers.clear();
    this.selectedGroups.clear();
  });

  /**
   * 🎯 목적: ClusterRoleBinding 생성 또는 업데이트 실행
   */
  createBindings = async () => {
    const { closeClusterRoleBindingDialog, clusterRoleBindingStore, editBindingNameState, showDetails, hostedCluster } =
      this.props;
    const { selectedRoleRef, selectedBindings, clusterRoleBinding } = this;

    // 유효성 검증
    if (!clusterRoleBinding || !selectedRoleRef) {
      return;
    }

    try {
      const { selfLink } = this.isEditing
        ? await clusterRoleBindingStore.updateSubjects(clusterRoleBinding, selectedBindings)
        : await clusterRoleBindingStore.create(
            { name: editBindingNameState.get() },
            {
              subjects: selectedBindings,
              roleRef: {
                name: selectedRoleRef.getName(),
                kind: selectedRoleRef.kind,
              },
            },
          );

      showDetails(selfLink);
      closeClusterRoleBindingDialog();
    } catch (err) {
      // 🆕 FIX-038: clusterName metadata 추가
      const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
      notificationPanelStore.addCheckedError(
        "operations",
        err,
        `Unknown error occurred while ${this.isEditing ? "editing the" : "creating a"} ClusterRoleBinding`,
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
      this.props.closeClusterRoleBindingDialog();
    }
  };

  /**
   * 🎯 목적: shadcn UI 기반 렌더링
   */
  render() {
    const { state, editBindingNameState } = this.props;
    const isOpen = state.get().isOpen;
    const [dialogAction, nextLabel] = this.isEditing ? ["Edit", "Update"] : ["Add", "Create"];
    const disableNext = !this.selectedRoleRef || !this.selectedBindings.length || !editBindingNameState.get();

    // 다이얼로그 열릴 때 onOpen 호출
    if (isOpen && this.clusterRoleBinding !== undefined) {
      this.onOpen();
    }

    return (
      <Dialog open={isOpen} onOpenChange={this.handleOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogAction} ClusterRoleBinding</DialogTitle>
          </DialogHeader>

          {/* ============================================ */}
          {/* 🎯 폼 입력 영역 */}
          {/* ============================================ */}
          <div className="flex flex-col gap-4 py-4">
            {/* Cluster Role Reference - shadcn Combobox */}
            <div className="flex flex-col gap-2">
              <Label>Cluster Role Reference</Label>
              <Popover
                open={this.clusterRoleComboboxOpen}
                onOpenChange={action((open) => {
                  this.clusterRoleComboboxOpen = open;
                })}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={this.clusterRoleComboboxOpen}
                    className="w-full justify-between"
                    disabled={this.isEditing}
                    autoFocus={!this.isEditing}
                  >
                    {this.selectedRoleRef ? (
                      <span className="flex items-center gap-2">
                        <Icon
                          small
                          material="people"
                          tooltip={{ preferredPositions: TooltipPosition.LEFT, children: this.selectedRoleRef.kind }}
                        />
                        {this.selectedRoleRef.getName()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Select cluster role ...</span>
                    )}
                    <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0" align="start" style={{ width: "var(--radix-popover-trigger-width)" }}>
                  <Command>
                    <CommandInput placeholder="Search cluster role..." />
                    <CommandList>
                      <CommandEmpty>No cluster role found.</CommandEmpty>
                      <CommandGroup>
                        {this.clusterRoleOptions.map((option) => (
                          <CommandItem
                            key={option.value.getId()}
                            value={option.label}
                            onSelect={action(() => {
                              this.selectedRoleRef = option.value;
                              this.clusterRoleComboboxOpen = false;
                              const bindingName = this.props.editBindingNameState.get();
                              if (!bindingName || bindingName === option.value.getName()) {
                                this.props.editBindingNameState.set(option.value.getName());
                              }
                            })}
                          >
                            <Icon
                              small
                              material="people"
                              tooltip={{ preferredPositions: TooltipPosition.LEFT, children: option.value.kind }}
                            />
                            <span className="ml-2">{option.label}</span>
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
                placeholder="Name of ClusterRoleBinding..."
                disabled={this.isEditing}
                value={this.props.editBindingNameState.get()}
                onChange={(e) => this.props.editBindingNameState.set(e.target.value)}
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

export const ClusterRoleBindingDialog = withInjectables<Dependencies, ClusterRoleBindingDialogProps>(
  observer(NonInjectedClusterRoleBindingDialog),
  {
    getProps: (di, props) => ({
      ...props,
      clusterRoleStore: di.inject(clusterRoleStoreInjectable),
      editBindingNameState: di.inject(editClusterRoleBindingNameStateInjectable),
      serviceAccountStore: di.inject(serviceAccountStoreInjectable),
      state: di.inject(clusterRoleBindingDialogStateInjectable),
      clusterRoleBindingStore: di.inject(clusterRoleBindingStoreInjectable),
      openClusterRoleBindingDialog: di.inject(openClusterRoleBindingDialogInjectable),
      closeClusterRoleBindingDialog: di.inject(closeClusterRoleBindingDialogInjectable),
      showDetails: di.inject(showDetailsInjectable),
      hostedCluster: di.inject(hostedClusterInjectable),
    }),
  },
);
