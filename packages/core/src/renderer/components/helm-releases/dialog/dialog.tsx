/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./dialog.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import orderBy from "lodash/orderBy";
import { computed, observable, runInAction } from "mobx";
import { observer } from "mobx-react";
import React, { Component } from "react";
import requestHelmReleaseHistoryInjectable from "../../../../common/k8s-api/endpoints/helm-releases.api/request-history.injectable";
import hostedClusterInjectable from "../../../cluster-frame-context/hosted-cluster.injectable";
import { Dialog } from "../../dialog";
import { Select } from "../../select";
import { notificationPanelStore } from "../../status-bar/items/notification-panel.store";
import { Wizard, WizardStep } from "../../wizard";
import rollbackReleaseInjectable from "../rollback-release/rollback-release.injectable";
import releaseRollbackDialogStateInjectable from "./state.injectable";

import type { IObservableValue } from "mobx";

import type { Cluster } from "../../../../common/cluster/cluster";
import type { HelmRelease } from "../../../../common/k8s-api/endpoints/helm-releases.api";
import type {
  HelmReleaseRevision,
  RequestHelmReleaseHistory,
} from "../../../../common/k8s-api/endpoints/helm-releases.api/request-history.injectable";
import type { DialogProps } from "../../dialog";
import type { RollbackRelease } from "../rollback-release/rollback-release.injectable";

export interface ReleaseRollbackDialogProps extends DialogProps {}

interface Dependencies {
  rollbackRelease: RollbackRelease;
  state: IObservableValue<HelmRelease | undefined>;
  requestHelmReleaseHistory: RequestHelmReleaseHistory;
  hostedCluster: Cluster | undefined;
}

class NonInjectedReleaseRollbackDialog extends Component<ReleaseRollbackDialogProps & Dependencies> {
  readonly isLoading = observable.box(false);
  readonly revision = observable.box<HelmReleaseRevision | undefined>();
  readonly revisions = observable.array<HelmReleaseRevision>();
  readonly revisionOptions = computed(() =>
    this.revisions.map((revision) => ({
      value: revision,
      label: `${revision.revision} - ${revision.chart} - ${revision.app_version}, updated: ${new Date(revision.updated).toLocaleString()}`,
    })),
  );

  close = () => {
    this.props.state.set(undefined);
  };

  onOpen = async (release: HelmRelease) => {
    this.isLoading.set(true);

    const releases = await this.props.requestHelmReleaseHistory(release.getName(), release.getNs());

    runInAction(() => {
      this.revisions.replace(orderBy(releases, "revision", "desc"));
      this.revision.set(this.revisions[0]);
      this.isLoading.set(false);
    });
  };

  rollback = async (release: HelmRelease) => {
    const revision = this.revision.get();

    if (!revision) {
      return;
    }

    try {
      await this.props.rollbackRelease(release.getName(), release.getNs(), revision.revision);

      // 🎯 FIX-038: clusterName을 metadata로만 전달 (description에서 제거)
      const clusterName = this.props.hostedCluster?.name.get() ?? "Unknown Cluster";
      notificationPanelStore.addSuccess(
        "operations",
        "Helm Release Rollback",
        `${release.getName()} rolled back to revision ${revision.revision} successfully`,
        {
          resourceKind: "HelmRelease",
          resourceName: release.getName(),
          namespace: release.getNs(),
          clusterName,
        },
      );

      this.close();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error occurred while rolling back release";
      // 🆕 FIX-038: Add clusterName to error notification
      const clusterNameForError = this.props.hostedCluster?.name.get() ?? "Unknown Cluster";
      notificationPanelStore.addError("operations", "Rollback Failed", errorMsg, { clusterName: clusterNameForError });
    }
  };

  renderRevisionContent() {
    const revision = this.revision.get();

    if (!revision) {
      return <p>No revisions to rollback.</p>;
    }

    return (
      <div className="flex gaps align-center">
        <b>Revision</b>
        <Select
          id="revision-input"
          themeName="light"
          value={revision}
          options={this.revisionOptions.get()}
          onChange={(option) => this.revision.set(option?.value)}
        />
      </div>
    );
  }

  renderContent(release: HelmRelease) {
    return (
      <Wizard
        header={
          <h5>
            {"Rollback "}
            <b>{release.getName()}</b>
          </h5>
        }
        done={this.close}
      >
        <WizardStep
          scrollable={false}
          nextLabel="Rollback"
          next={() => this.rollback(release)}
          loading={this.isLoading.get()}
        >
          {this.renderRevisionContent()}
        </WizardStep>
      </Wizard>
    );
  }

  render() {
    const { state, ...dialogProps } = this.props;
    const release = state.get();

    return (
      <Dialog
        {...dialogProps}
        className="ReleaseRollbackDialog"
        isOpen={Boolean(release)}
        onOpen={release ? () => this.onOpen(release) : undefined}
        close={this.close}
      >
        {release && this.renderContent(release)}
      </Dialog>
    );
  }
}

export const ReleaseRollbackDialog = withInjectables<Dependencies, ReleaseRollbackDialogProps>(
  observer(NonInjectedReleaseRollbackDialog),
  {
    getProps: (di, props) => ({
      ...props,
      rollbackRelease: di.inject(rollbackReleaseInjectable),
      state: di.inject(releaseRollbackDialogStateInjectable),
      requestHelmReleaseHistory: di.inject(requestHelmReleaseHistoryInjectable),
      hostedCluster: di.inject(hostedClusterInjectable),
    }),
  },
);
