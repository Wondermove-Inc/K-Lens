/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { ToggleGroup, ToggleGroupItem } from "@skuberplus/storybook-shadcn/src/components/ui/toggle-group";
import { observer } from "mobx-react";
import React, { useState } from "react";
import styles from "./cluster-metric-switchers.module.scss";
import selectedMetricsTypeInjectable from "./overview/selected-metrics-type.injectable";
import selectedNodeRoleForMetricsInjectable from "./overview/selected-node-role-for-metrics.injectable";

import type { SelectedMetricsType } from "./overview/selected-metrics-type.injectable";
import type { SelectedNodeRoleForMetrics } from "./overview/selected-node-role-for-metrics.injectable";

interface Dependencies {
  selectedMetricsType: SelectedMetricsType;
  selectedNodeRoleForMetrics: SelectedNodeRoleForMetrics;
}

const NonInjectedClusterMetricSwitchers = observer(
  ({ selectedMetricsType, selectedNodeRoleForMetrics }: Dependencies) => {
    // 🎯 목적: CPU/Memory 탭 상태 관리
    const [metricTab, setMetricTab] = useState<"CPU" | "Memory">("CPU");

    // 🎯 목적: 노드 역할 선택 (Master/Worker)
    const nodeRole = selectedNodeRoleForMetrics.value.get();

    // 🎯 수집 시간을 1분으로 고정 (화면에 안보임)
    // selectedNodeRoleForMetrics.setCollectionInterval이 없으면 기본값 60000(1분) 사용

    return (
      <div className={styles.ClusterMetricSwitchers}>
        {/* 🔄 노드 역할 선택 - ToggleGroup 버튼 */}
        <div className={styles.nodeRoleContainer}>
          <ToggleGroup
            type="single"
            value={nodeRole}
            onValueChange={(value) => {
              if (value) {
                selectedNodeRoleForMetrics.set(value as "master" | "worker");
              }
            }}
          >
            <ToggleGroupItem value="master">Master</ToggleGroupItem>
            <ToggleGroupItem value="worker">Worker</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* 📊 CPU/Memory 전환 - ToggleGroup 버튼 */}
        <div className={styles.metricTypeContainer}>
          <ToggleGroup
            type="single"
            value={metricTab}
            onValueChange={(value) => value && setMetricTab(value as "CPU" | "Memory")}
          >
            <ToggleGroupItem value="CPU">CPU</ToggleGroupItem>
            <ToggleGroupItem value="Memory">Memory</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
    );
  },
);

export const ClusterMetricSwitchers = withInjectables<Dependencies>(NonInjectedClusterMetricSwitchers, {
  getProps: (di) => ({
    selectedMetricsType: di.inject(selectedMetricsTypeInjectable),
    selectedNodeRoleForMetrics: di.inject(selectedNodeRoleForMetricsInjectable),
  }),
});
