/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Pod } from "@skuberplus/kube-object";
import React from "react";
import { v4 as uuidv4 } from "uuid";
import { buildKubectlExecCommand } from "../../../common/utils/shell-utils";
import { App } from "../../../extensions/common-api";
import activeKubernetesClusterInjectable from "../../cluster-frame-context/active-kubernetes-cluster.injectable";
import createTerminalTabInjectable from "../dock/terminal/create-terminal-tab.injectable";
import sendCommandInjectable, { type SendCommand } from "../dock/terminal/send-command.injectable";
import hideDetailsInjectable, { type HideDetails } from "../kube-detail-params/hide-details.injectable";
import PodMenuItem from "./pod-menu-item";

import type { Container, EphemeralContainer } from "@skuberplus/kube-object";

import type { IComputedValue } from "mobx";

import type { KubernetesCluster } from "../../../common/catalog-entities";
import type { DockTabCreateSpecific } from "../dock/dock/store";

export interface PodShellMenuProps {
  object: any;
  toolbar: boolean;
}

interface Dependencies {
  createTerminalTab: (tabParams: DockTabCreateSpecific) => void;
  sendCommand: SendCommand;
  hideDetails: HideDetails;
  activeKubernetesCluster: IComputedValue<KubernetesCluster | null>;
}

const NonInjectablePodShellMenu: React.FC<PodShellMenuProps & Dependencies> = (props) => {
  const { object, toolbar, createTerminalTab, sendCommand, hideDetails, activeKubernetesCluster } = props;

  if (!object) {
    return null;
  }
  let pod: Pod;

  try {
    pod = new Pod(object);
  } catch (ex) {
    return null;
  }

  const containers = pod.getRunningContainersWithType();
  const statuses = pod.getContainerStatuses();

  const execShell = async (container: Container | EphemeralContainer) => {
    const containerName = container.name;
    const kubectlPath = App.Preferences.getKubectlPath() || "kubectl";
    const hostShellPath = App.Preferences.getTerminalShellPath();

    // 공통 유틸리티를 사용하여 명령어 빌드
    const command = buildKubectlExecCommand({
      kubectlPath,
      namespace: pod.getNs(),
      podName: pod.getName(),
      containerName,
      podOs: pod.getSelectedNodeOs(),
      hostShellPath,
    });

    const shellId = uuidv4();

    // 🎯 현재 활성화된 클러스터 정보 가져오기
    const activeCluster = activeKubernetesCluster.get();
    let contextName = "No Cluster";
    let clusterId: string | undefined = undefined;

    if (activeCluster) {
      clusterId = String(activeCluster.metadata?.uid || "");
      contextName = String(activeCluster.metadata?.name || activeCluster.metadata?.uid || "Active Cluster");
    }

    const tabParams = {
      title: `Pod: ${pod.getName()} (namespace: ${pod.getNs()})`,
      id: shellId,
      clusterId, // 🔧 클러스터 ID 추가
      contextName, // 🔧 실제 클러스터 컨텍스트 이름
    };

    createTerminalTab(tabParams);

    sendCommand(command, {
      enter: true,
      tabId: shellId,
    }).then(hideDetails);
  };

  return (
    <PodMenuItem
      svg="ssh"
      title="Shell"
      tooltip="Pod Shell"
      toolbar={toolbar}
      containers={containers}
      statuses={statuses}
      onMenuItemClick={execShell}
    />
  );
};

export const PodShellMenu = withInjectables<Dependencies, PodShellMenuProps>(NonInjectablePodShellMenu, {
  getProps: (di, props) => ({
    ...props,
    createTerminalTab: di.inject(createTerminalTabInjectable),
    sendCommand: di.inject(sendCommandInjectable),
    hideDetails: di.inject(hideDetailsInjectable),
    activeKubernetesCluster: di.inject(activeKubernetesClusterInjectable),
  }),
});
