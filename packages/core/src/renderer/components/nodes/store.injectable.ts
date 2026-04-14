/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: NodeStore 의존성 주입 설정
 *
 * 📝 주의사항:
 * - apiBase와 activeKubernetesCluster는 Prometheus fallback을 위해 추가됨
 * - metricsSource 설정에 따라 Metrics Server 또는 Prometheus 사용
 *
 * 🔄 변경이력: 2026-01-09 - Prometheus fallback 지원을 위한 의존성 추가
 */

import { getInjectable } from "@ogre-tools/injectable";
import {
  nodeApiInjectable,
  nodeMetricsApiInjectable,
  storesAndApisCanBeCreatedInjectionToken,
} from "@skuberplus/kube-api-specifics";
import { loggerInjectionToken } from "@skuberplus/logger";
import assert from "assert";
import apiBaseInjectable from "../../../common/k8s-api/api-base.injectable";
import { kubeObjectStoreInjectionToken } from "../../../common/k8s-api/api-manager/kube-object-store-token";
import clusterFrameContextForClusterScopedResourcesInjectable from "../../cluster-frame-context/for-cluster-scoped-resources.injectable";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { NodeStore } from "./store";

const nodeStoreInjectable = getInjectable({
  id: "node-store",
  instantiate: (di) => {
    assert(di.inject(storesAndApisCanBeCreatedInjectionToken), "nodeStore is only available in certain environments");

    const api = di.inject(nodeApiInjectable);

    return new NodeStore(
      {
        context: di.inject(clusterFrameContextForClusterScopedResourcesInjectable),
        logger: di.inject(loggerInjectionToken),
        nodeMetricsApi: di.inject(nodeMetricsApiInjectable),
        apiBase: di.inject(apiBaseInjectable),
        // 🔧 수정: hostedCluster 사용 (preferences 접근을 위한 올바른 경로)
        hostedCluster: di.inject(hostedClusterInjectable),
      },
      api,
    );
  },
  injectionToken: kubeObjectStoreInjectionToken,
});

export default nodeStoreInjectable;
