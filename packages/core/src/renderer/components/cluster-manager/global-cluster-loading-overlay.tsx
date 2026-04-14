/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { hasTypedProperty, isObject, isString } from "@skuberplus/utilities";
import { makeObservable, observable } from "mobx";
import { disposeOnUnmount, observer } from "mobx-react";
import React, { Component } from "react";
import { ipcRendererOn } from "../../../common/ipc";
import { LoadingOverlay } from "../shadcn-ui/loading-overlay";

import type { Cluster } from "../../../common/cluster/cluster";
import type { KubeAuthUpdate } from "../../../common/cluster-types";

export interface GlobalClusterLoadingOverlayProps {
  cluster: Cluster;
}

/**
 * 🎯 목적: 전역 클러스터 로딩 오버레이 컴포넌트
 *
 * ✨ 특징:
 * - ClusterManager 레벨에서 렌더링되어 현재 페이지 위에 오버레이 표시
 * - IPC 이벤트를 구독하여 실시간 연결 진행 상황 표시
 * - 에러 발생 시 Reconnect/Close 버튼 표시
 *
 * 🔄 변경이력: 2025-01-24 - 초기 생성 (전역 로딩 오버레이)
 */
@observer
export class GlobalClusterLoadingOverlay extends Component<GlobalClusterLoadingOverlayProps> {
  @observable authOutput: KubeAuthUpdate[] = [];

  constructor(props: GlobalClusterLoadingOverlayProps) {
    super(props);
    makeObservable(this);
  }

  get hasErrorsOrWarnings(): boolean {
    return this.authOutput.some(({ level }) => level !== "info");
  }

  componentDidMount() {
    // 🎯 목적: IPC 이벤트를 구독하여 클러스터 연결 진행 상황 수집
    disposeOnUnmount(this, [
      ipcRendererOn(`cluster:${this.props.cluster.id}:connection-update`, (evt, res: unknown) => {
        if (
          isObject(res) &&
          hasTypedProperty(res, "message", isString) &&
          hasTypedProperty(res, "level", function (val): val is KubeAuthUpdate["level"] {
            return ["info", "warning", "error"].includes(val as string);
          })
        ) {
          this.authOutput.push(res);
        } else {
          console.warn(`Got invalid connection update for ${this.props.cluster.id}`, { update: res });
        }
      }),
    ]);
  }

  componentDidUpdate(prevProps: Readonly<GlobalClusterLoadingOverlayProps>): void {
    // 🎯 목적: 클러스터 변경 시 authOutput 초기화
    if (prevProps.cluster.id !== this.props.cluster.id) {
      this.authOutput = [];
    }
  }

  render() {
    const { cluster } = this.props;

    return (
      <LoadingOverlay
        isVisible={true}
        title={`Connecting ${cluster.name.get()}...`}
        messages={this.authOutput}
        width="400px"
        size="lg"
        showActions={this.hasErrorsOrWarnings}
        onReconnect={
          this.hasErrorsOrWarnings
            ? () => {
                // 🎯 목적: Reconnect 버튼 클릭 시 authOutput 초기화 및 재연결 시도
                this.authOutput = [];
                // TODO: 재연결 로직 구현 (requestClusterActivation 호출)
              }
            : undefined
        }
        onClose={() => {
          // 🎯 목적: Close 버튼 클릭 시 오버레이 닫기
          // TODO: 오버레이 닫기 로직 구현 (카탈로그로 이동 또는 상태 초기화)
        }}
      />
    );
  }
}
