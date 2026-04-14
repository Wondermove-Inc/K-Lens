/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
// 🎯 shadcn UI 컴포넌트: DrawerTitle 대체
import { DetailPanelSection } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import { ObservableHashSet, prevDefault } from "@skuberplus/utilities";
import autoBindReact from "auto-bind/react";
import { reaction } from "mobx";
import { disposeOnUnmount, observer } from "mobx-react";
import React, { Component } from "react";
import { AddRemoveButtons } from "../../add-remove-buttons";
import openConfirmDialogInjectable from "../../confirm-dialog/open.injectable";
import { LinkToClusterRole, LinkToNamespace, LinkToServiceAccount } from "../../kube-object-link";
import { Table, TableCell, TableHead, TableRow } from "../../table";
import { WithTooltip } from "../../with-tooltip";
import { hashSubject } from "../hashers";
import openClusterRoleBindingDialogInjectable from "./dialog/open.injectable";
import clusterRoleBindingStoreInjectable from "./store.injectable";

import type { ClusterRoleBinding } from "@skuberplus/kube-object";

import type { OpenConfirmDialog } from "../../confirm-dialog/open.injectable";
import type { KubeObjectDetailsProps } from "../../kube-object-details";
import type { OpenClusterRoleBindingDialog } from "./dialog/open.injectable";
import type { ClusterRoleBindingStore } from "./store";

export interface ClusterRoleBindingDetailsProps extends KubeObjectDetailsProps<ClusterRoleBinding> {}

interface Dependencies {
  openConfirmDialog: OpenConfirmDialog;
  openClusterRoleBindingDialog: OpenClusterRoleBindingDialog;
  clusterRoleBindingStore: ClusterRoleBindingStore;
}

class NonInjectedClusterRoleBindingDetails extends Component<ClusterRoleBindingDetailsProps & Dependencies> {
  selectedSubjects = new ObservableHashSet([], hashSubject);

  constructor(props: ClusterRoleBindingDetailsProps & Dependencies) {
    super(props);
    autoBindReact(this);
  }

  async componentDidMount() {
    disposeOnUnmount(this, [
      reaction(
        () => this.props.object,
        () => {
          this.selectedSubjects.clear();
        },
      ),
    ]);
  }

  removeSelectedSubjects() {
    const { object: clusterRoleBinding, openConfirmDialog, clusterRoleBindingStore } = this.props;
    const { selectedSubjects } = this;

    openConfirmDialog({
      ok: () => clusterRoleBindingStore.removeSubjects(clusterRoleBinding, selectedSubjects),
      labelOk: `Remove`,
      message: (
        <p>
          Remove selected bindings for
          <b>{clusterRoleBinding.getName()}</b>?
        </p>
      ),
    });
  }

  render() {
    const { selectedSubjects } = this;
    const { object: clusterRoleBinding, openClusterRoleBindingDialog } = this.props;

    if (!clusterRoleBinding) {
      return null;
    }
    const { roleRef } = clusterRoleBinding;
    const subjects = clusterRoleBinding.getSubjects();

    // 🎯 shadcn DetailPanelSection으로 마이그레이션 완료
    return (
      <div className="ClusterRoleBindingDetails">
        <DetailPanelSection title="Reference">
          <Table>
            <TableHead>
              <TableCell>Kind</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>API Group</TableCell>
            </TableHead>
            <TableRow>
              <TableCell>
                <WithTooltip>{roleRef.kind}</WithTooltip>
              </TableCell>
              <TableCell>
                <LinkToClusterRole name={roleRef.name} />
              </TableCell>
              <TableCell>
                <WithTooltip>{roleRef.apiGroup}</WithTooltip>
              </TableCell>
            </TableRow>
          </Table>
        </DetailPanelSection>

        <DetailPanelSection title="Bindings">
          {subjects.length > 0 && (
            <Table selectable className="bindings box grow">
              <TableHead>
                <TableCell checkbox />
                <TableCell className="type">Type</TableCell>
                <TableCell className="binding">Name</TableCell>
                <TableCell className="ns">Namespace</TableCell>
              </TableHead>
              {subjects.map((subject, i) => {
                const { kind, name, namespace } = subject;
                const isSelected = selectedSubjects.has(subject);

                return (
                  <TableRow
                    key={i}
                    selected={isSelected}
                    onClick={prevDefault(() => this.selectedSubjects.toggle(subject))}
                  >
                    <TableCell checkbox isChecked={isSelected} />
                    <TableCell className="type">
                      <WithTooltip>{kind}</WithTooltip>
                    </TableCell>
                    <TableCell className="binding">
                      {kind === "ServiceAccount" ? <LinkToServiceAccount name={name} namespace={namespace} /> : name}
                    </TableCell>
                    <TableCell className="ns">
                      <LinkToNamespace namespace={namespace} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </Table>
          )}

          <AddRemoveButtons
            onAdd={() => openClusterRoleBindingDialog(clusterRoleBinding)}
            onRemove={selectedSubjects.size ? this.removeSelectedSubjects : undefined}
            addTooltip={`Add bindings to ${roleRef.name}`}
            removeTooltip={`Remove selected bindings from ${roleRef.name}`}
          />
        </DetailPanelSection>
      </div>
    );
  }
}

export const ClusterRoleBindingDetails = withInjectables<Dependencies, ClusterRoleBindingDetailsProps>(
  observer(NonInjectedClusterRoleBindingDetails),
  {
    getProps: (di, props) => ({
      ...props,
      openConfirmDialog: di.inject(openConfirmDialogInjectable),
      openClusterRoleBindingDialog: di.inject(openClusterRoleBindingDialogInjectable),
      clusterRoleBindingStore: di.inject(clusterRoleBindingStoreInjectable),
    }),
  },
);
