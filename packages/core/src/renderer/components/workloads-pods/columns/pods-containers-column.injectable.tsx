/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { podListLayoutColumnInjectionToken } from "@skuberplus/list-layout";
import { object } from "@skuberplus/utilities";
import startCase from "lodash/startCase";
import React from "react";
import { StatusBrick } from "../../status-brick";
import { containerStatusClassName } from "../container-status-class-name";
import { COLUMN_PRIORITY } from "./column-priority";

import type {
  ContainerStateRunning,
  ContainerStateTerminated,
  ContainerStateWaiting,
  ContainerWithType,
  EphemeralContainerWithType,
  Pod,
  PodContainerStatus,
} from "@skuberplus/kube-object";

/**
 * 🎯 목적: 컨테이너 상태 정보를 툴팁용 JSX로 렌더링
 *
 * @param container - 컨테이너 정보 (name, type)
 * @param status - 컨테이너 상태 정보 (state, restartCount, ready)
 * @returns 컨테이너 이름, 상태, 상세 정보를 포함한 JSX
 *
 * 📝 주의사항:
 * - shadcn Tooltip 스타일에 맞춰 Tailwind 클래스 사용
 * - init containers: "init" 라벨 추가
 * - ephemeral containers: "ephemeral" 라벨 추가
 * - terminated 상태: reason과 exit code 표시
 */
const renderState = (container: ContainerWithType | EphemeralContainerWithType, status?: PodContainerStatus) => {
  const state = status ? Object.keys(status?.state ?? {})[0] : "";
  const terminated = status?.state ? (status?.state.terminated ?? "") : "";

  if (!state) return;
  const statusState = status?.state ?? {};
  let stateDetails: ContainerStateRunning | ContainerStateWaiting | ContainerStateTerminated | undefined;
  if (state === "running" || state === "waiting" || state === "terminated") {
    stateDetails = statusState[state];
  }

  return (
    <div className="space-y-1">
      <div className="font-medium pb-1 border-b border-border/50">
        {container.name}{" "}
        <span className="text-muted-foreground font-normal">
          {state}
          {container.type === "initContainers" ? ", init" : ""}
          {container.type === "ephemeralContainers" ? ", ephemeral" : ""}
          {status?.restartCount ? ", restarted" : ""}
          {status?.ready ? ", ready" : ""}
          {terminated ? ` - ${terminated.reason} (exit code: ${terminated.exitCode})` : ""}
        </span>
      </div>
      {stateDetails && (
        <div className="space-y-0.5 text-xs pt-1">
          {state === "running" &&
            object.entries(stateDetails as ContainerStateRunning).map(([name, value]) => (
              <div key={name} className="flex gap-2">
                <span className="font-medium shrink-0">{startCase(name)}</span>
                <span className="text-muted-foreground truncate" title={String(value)}>
                  {value}
                </span>
              </div>
            ))}
          {state === "waiting" &&
            object.entries(stateDetails as ContainerStateWaiting).map(([name, value]) => (
              <div key={name} className="flex gap-2">
                <span className="font-medium shrink-0">{startCase(name)}</span>
                <span className="text-muted-foreground truncate" title={String(value)}>
                  {value}
                </span>
              </div>
            ))}
          {state === "terminated" &&
            object.entries(stateDetails as ContainerStateTerminated).map(([name, value]) => (
              <div key={name} className="flex gap-2">
                <span className="font-medium shrink-0">{startCase(name)}</span>
                <span className="text-muted-foreground truncate" title={String(value ?? "")}>
                  {value ?? ""}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

/**
 * 🎯 목적: Pod의 모든 컨테이너 상태를 StatusBrick 배열로 렌더링
 *
 * @param pod - Pod 객체
 * @returns StatusBrick 컴포넌트 배열 (각 컨테이너마다 색상 블록 표시)
 */
const renderContainersStatus = (pod: Pod) => {
  const statuses = pod.getContainerStatuses();
  return (
    <div data-column-id={columnId}>
      {pod.getAllContainersWithType().map((container) => {
        const status = statuses.find((status) => status.name === container.name);
        return (
          <StatusBrick
            key={container.name}
            className={containerStatusClassName(container, status)}
            tooltip={renderState(container, status)}
          />
        );
      })}
    </div>
  );
};

const columnId = "containers";

export const podsContainersColumnInjectable = getInjectable({
  id: "pods-containers-column",
  instantiate: () => ({
    id: columnId,
    kind: "Pod",
    apiVersion: "v1",
    priority: COLUMN_PRIORITY.CONTAINERS,
    content: renderContainersStatus,
    header: {
      title: "Containers",
      className: "containers",
      sortBy: columnId,
      id: columnId,
      "data-column-id": columnId,
    },
    sortingCallBack: (pod) => pod.getContainerStatuses().length,
  }),
  injectionToken: podListLayoutColumnInjectionToken,
});
