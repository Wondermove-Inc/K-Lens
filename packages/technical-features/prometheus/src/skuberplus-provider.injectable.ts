/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { getHelmLikeQueryFor } from "./helm-provider.injectable";
import { createPrometheusProvider, findFirstNamespacedService, prometheusProviderInjectionToken } from "./provider";

/**
 * SkuberPlus Prometheus Provider
 *
 * skuberclient-prometheus Helm 차트로 설치된 경량 Prometheus를 감지합니다.
 * 라벨: skuberclient.io/metrics=prometheus
 */
const skuberplusPrometheusProviderInjectable = getInjectable({
  id: "skuberplus-prometheus-provider",
  instantiate: () =>
    createPrometheusProvider({
      kind: "skuberplus",
      name: "SkuberPlus",
      isConfigurable: true,
      showInUI: true,
      getQuery: getHelmLikeQueryFor({ rateAccuracy: "5m" }),
      getService: (client) => findFirstNamespacedService(client, "skuberclient.io/metrics=prometheus"),
    }),
  injectionToken: prometheusProviderInjectionToken,
});

export default skuberplusPrometheusProviderInjectable;
