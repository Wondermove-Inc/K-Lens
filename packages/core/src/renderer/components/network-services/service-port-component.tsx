/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./service-port-component.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { Button } from "@skuberplus/button";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Spinner } from "@skuberplus/spinner";
import { cssNames } from "@skuberplus/utilities";
import { action, makeObservable, observable, reaction } from "mobx";
import { disposeOnUnmount, observer } from "mobx-react";
import React, { Component } from "react";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { predictProtocol } from "../../port-forward";
import aboutPortForwardingInjectable from "../../port-forward/about-port-forwarding.injectable";
import notifyErrorPortForwardingInjectable from "../../port-forward/notify-error-port-forwarding.injectable";
import openPortForwardInjectable from "../../port-forward/open-port-forward.injectable";
import portForwardDialogModelInjectable from "../../port-forward/port-forward-dialog-model/port-forward-dialog-model.injectable";
import portForwardStoreInjectable from "../../port-forward/port-forward-store/port-forward-store.injectable";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";

import type { Service, ServicePort } from "@skuberplus/kube-object";
import type { Logger } from "@skuberplus/logger";

import type { Cluster } from "../../../common/cluster/cluster";
import type { ForwardedPort, PortForwardStore } from "../../port-forward";
import type { OpenPortForward } from "../../port-forward/open-port-forward.injectable";

export interface ServicePortComponentProps {
  service: Service;
  port: ServicePort;
}

interface Dependencies {
  portForwardStore: PortForwardStore;
  logger: Logger;
  openPortForwardDialog: (item: ForwardedPort, options: { openInBrowser: boolean; onClose: () => void }) => void;
  aboutPortForwarding: () => void;
  notifyErrorPortForwarding: (message: string) => void;
  openPortForward: OpenPortForward;
  hostedCluster: Cluster | undefined;
}

class NonInjectedServicePortComponent extends Component<ServicePortComponentProps & Dependencies> {
  @observable waiting = false;
  @observable forwardPort = 0;
  @observable isPortForwarded = false;
  @observable isActive = false;

  constructor(props: ServicePortComponentProps & Dependencies) {
    super(props);
    makeObservable(this);
    this.checkExistingPortForwarding();
  }

  componentDidMount() {
    disposeOnUnmount(this, [
      reaction(
        () => this.props.service,
        () => this.checkExistingPortForwarding(),
      ),
    ]);
  }

  get portForwardStore() {
    return this.props.portForwardStore;
  }

  @action
  async checkExistingPortForwarding() {
    const { service, port } = this.props;
    let portForward: ForwardedPort | undefined;

    try {
      portForward = await this.portForwardStore.getPortForward({
        kind: "service",
        name: service.getName(),
        namespace: service.getNs(),
        port: port.port,
        forwardPort: this.forwardPort,
      });
    } catch (error) {
      this.isPortForwarded = false;
      this.isActive = false;

      return;
    }

    if (!portForward) {
      return;
    }

    this.forwardPort = portForward.forwardPort;
    this.isPortForwarded = true;
    this.isActive = portForward.status === "Active";
  }

  @action
  async portForward() {
    const { service, port, openPortForward } = this.props;
    let portForward: ForwardedPort = {
      kind: "service",
      name: service.getName(),
      namespace: service.getNs(),
      port: port.port,
      forwardPort: this.forwardPort,
      protocol: predictProtocol(port.name),
      status: "Active",
    };

    this.waiting = true;

    try {
      // determine how many port-forwards already exist
      const { length } = this.portForwardStore.getPortForwards();

      if (!this.isPortForwarded) {
        portForward = await this.portForwardStore.add(portForward);
      } else if (!this.isActive) {
        portForward = await this.portForwardStore.start(portForward);
      }

      this.forwardPort = portForward.forwardPort;

      if (portForward.status === "Active") {
        openPortForward(portForward);

        // if this is the first port-forward show the about notification
        if (!length) {
          this.props.aboutPortForwarding();
        }
      } else {
        this.props.notifyErrorPortForwarding(
          `Error occurred starting port-forward, the local port may not be available or the ${portForward.kind} ${portForward.name} may not be reachable`,
        );
      }
    } catch (error) {
      this.props.logger.error("[SERVICE-PORT-COMPONENT]:", error, portForward);
    } finally {
      this.checkExistingPortForwarding();
      this.waiting = false;
    }
  }

  @action
  async stopPortForward() {
    const { service, port } = this.props;
    const portForward: ForwardedPort = {
      kind: "service",
      name: service.getName(),
      namespace: service.getNs(),
      port: port.port,
      forwardPort: this.forwardPort,
    };

    this.waiting = true;

    try {
      await this.portForwardStore.remove(portForward);
    } catch (error) {
      // 🎯 FIX-037: NotificationPanel으로 마이그레이션
      // 🆕 FIX-038: clusterName metadata 추가
      const clusterName = this.props.hostedCluster?.name.get() ?? "Unknown Cluster";
      notificationPanelStore.addError(
        "network",
        "Port Forward Stop Failed",
        `Error occurred stopping the port-forward from port ${portForward.forwardPort}.`,
        { clusterName },
      );
    } finally {
      this.checkExistingPortForwarding();
      this.forwardPort = 0;
      this.waiting = false;
    }
  }

  render() {
    const { port, service } = this.props;

    const name = port.name ? `${port.name}: ` : "";
    const nodeAddr = port.nodePort ? `${port.nodePort} → ` : "";
    const appProtocol = port.appProtocol ? `/${port.appProtocol}` : "";
    const servicePort = `${port.port}${appProtocol} → `;
    const targetPort = `${port.targetPort ?? port.port}/${port.protocol ?? "TCP"}`;
    const text = `${name}${nodeAddr}${servicePort}${targetPort}`;

    const portForwardAction = action(async () => {
      if (this.isPortForwarded) {
        await this.stopPortForward();
      } else {
        const portForward: ForwardedPort = {
          kind: "service",
          name: service.getName(),
          namespace: service.getNs(),
          port: port.port,
          forwardPort: this.forwardPort,
          protocol: predictProtocol(port.name),
        };

        this.props.openPortForwardDialog(portForward, {
          openInBrowser: true,
          onClose: () => this.checkExistingPortForwarding(),
        });
      }
    });

    return (
      <div className={cssNames("ServicePortComponent", { waiting: this.waiting })}>
        {service.getSelector().length ? (
          <>
            <span title="Open in a browser" onClick={() => this.portForward()}>
              {text}
            </span>
            <Button primary onClick={portForwardAction}>
              {" "}
              {this.isPortForwarded ? (this.isActive ? "Stop/Remove" : "Remove") : "Forward..."}{" "}
            </Button>
            {this.waiting && <Spinner />}
          </>
        ) : (
          text
        )}
      </div>
    );
  }
}

export const ServicePortComponent = withInjectables<Dependencies, ServicePortComponentProps>(
  observer(NonInjectedServicePortComponent),
  {
    getProps: (di, props) => ({
      ...props,
      portForwardStore: di.inject(portForwardStoreInjectable),
      openPortForwardDialog: di.inject(portForwardDialogModelInjectable).open,
      aboutPortForwarding: di.inject(aboutPortForwardingInjectable),
      notifyErrorPortForwarding: di.inject(notifyErrorPortForwardingInjectable),
      openPortForward: di.inject(openPortForwardInjectable),
      logger: di.inject(loggerInjectionToken),
      hostedCluster: di.inject(hostedClusterInjectable),
    }),
  },
);
