/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Icon } from "@skuberplus/icon";
import { cssNames } from "@skuberplus/utilities";
import autoBindReact from "auto-bind/react";
import { CirclePlay, ExternalLink, OctagonPause } from "lucide-react";
import React, { Component } from "react";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import openPortForwardInjectable from "../../port-forward/open-port-forward.injectable";
import portForwardDialogModelInjectable from "../../port-forward/port-forward-dialog-model/port-forward-dialog-model.injectable";
import portForwardStoreInjectable from "../../port-forward/port-forward-store/port-forward-store.injectable";
import { MenuItem } from "../menu";
import { MenuActions } from "../menu/menu-actions";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";

import type { Cluster } from "../../../common/cluster/cluster";
import type { PortForwardItem, PortForwardStore } from "../../port-forward";
import type { OpenPortForward } from "../../port-forward/open-port-forward.injectable";
import type { MenuActionsProps } from "../menu/menu-actions";

export interface PortForwardMenuProps extends MenuActionsProps {
  portForward: PortForwardItem;
  hideDetails?(): void;
}

interface Dependencies {
  portForwardStore: PortForwardStore;
  openPortForwardDialog: (item: PortForwardItem) => void;
  openPortForward: OpenPortForward;
  hostedCluster: Cluster | undefined;
}

class NonInjectedPortForwardMenu<Props extends PortForwardMenuProps & Dependencies> extends Component<Props> {
  constructor(props: Props) {
    super(props);
    autoBindReact(this);
  }

  remove() {
    const { portForward } = this.props;

    try {
      this.portForwardStore.remove(portForward);
    } catch (error) {
      // 🎯 FIX-037: NotificationPanel으로 마이그레이션
      // 🆕 FIX-038: clusterName metadata 추가
      const clusterName = this.props.hostedCluster?.name.get() ?? "Unknown Cluster";
      notificationPanelStore.addError(
        "network",
        "Port Forward Remove Failed",
        `Error occurred stopping the port-forward from port ${portForward.forwardPort}. The port-forward may still be active.`,
        { clusterName },
      );
    }
  }

  get portForwardStore() {
    return this.props.portForwardStore;
  }

  private startPortForwarding = async () => {
    const { portForward, hostedCluster } = this.props;

    const pf = await this.portForwardStore.start(portForward);
    const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";

    if (pf.status === "Disabled") {
      const { name, kind, forwardPort } = portForward;

      // 🎯 FIX-037: NotificationPanel으로 마이그레이션
      // 🆕 FIX-038: clusterName metadata 추가
      notificationPanelStore.addError(
        "network",
        "Port Forward Start Failed",
        `Error occurred starting port-forward, the local port ${forwardPort} may not be available or the ${kind} ${name} may not be reachable`,
        { clusterName },
      );
    } else {
      // 🎯 FIX-037: NotificationPanel으로 마이그레이션
      notificationPanelStore.addSuccess(
        "network",
        "Port Forward Started",
        `[${clusterName}] ${portForward.kind} ${portForward.name} → localhost:${portForward.forwardPort}`,
      );
    }
  };

  private stopPortForwarding = () => {
    const { portForward, hostedCluster } = this.props;

    this.portForwardStore.stop(portForward);

    // 🎯 FIX-037: NotificationPanel으로 마이그레이션
    const clusterName = hostedCluster?.name.get() ?? "Unknown Cluster";
    notificationPanelStore.addSuccess(
      "network",
      "Port Forward Stopped",
      `[${clusterName}] ${portForward.kind} ${portForward.name} stopped`,
    );
  };

  renderStartStopMenuItem() {
    const { portForward } = this.props;

    if (portForward.status === "Active") {
      return (
        <MenuItem onClick={this.stopPortForwarding}>
          <OctagonPause className="h-4 w-4" />
          <span className="title">Stop</span>
        </MenuItem>
      );
    }

    return (
      <MenuItem onClick={this.startPortForwarding}>
        <CirclePlay className="h-4 w-4" />
        <span className="title">Start</span>
      </MenuItem>
    );
  }

  renderContent() {
    const { portForward, toolbar } = this.props;

    if (!portForward) return null;

    return (
      <>
        {portForward.status === "Active" && (
          <MenuItem onClick={() => this.props.openPortForward(portForward)}>
            <ExternalLink className="h-4 w-4" />
            <span className="title">Open</span>
          </MenuItem>
        )}
        <MenuItem onClick={() => this.props.openPortForwardDialog(portForward)}>
          <Icon material="edit" tooltip="Change port or protocol" interactive={toolbar} />
          <span className="title">Edit</span>
        </MenuItem>
        {this.renderStartStopMenuItem()}
      </>
    );
  }

  render() {
    const { className, ...menuProps } = this.props;

    return (
      <MenuActions
        id={`menu-actions-for-port-forward-menu-for-${this.props.portForward.getId()}`}
        {...menuProps}
        className={cssNames("PortForwardMenu", className)}
        removeAction={this.remove}
      >
        {this.renderContent()}
      </MenuActions>
    );
  }
}

export const PortForwardMenu = withInjectables<Dependencies, PortForwardMenuProps>(NonInjectedPortForwardMenu, {
  getProps: (di, props) => ({
    ...props,
    portForwardStore: di.inject(portForwardStoreInjectable),
    openPortForwardDialog: di.inject(portForwardDialogModelInjectable).open,
    openPortForward: di.inject(openPortForwardInjectable),
    hostedCluster: di.inject(hostedClusterInjectable),
  }),
});
