/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { apiPrefix } from "../../../common/vars";
import prometheusProvidersInjectable from "../../prometheus/providers.injectable";
import { route } from "../../router/route";
import { getRouteInjectable } from "../../router/router.injectable";

import type { PrometheusProvider } from "@skuberplus/prometheus";

const getMetricProvidersRouteInjectable = getRouteInjectable({
  id: "get-metric-providers-route",

  instantiate: (di) => {
    const prometheusProviders = di.inject(prometheusProvidersInjectable);

    return route({
      method: "get",
      path: `${apiPrefix}/metrics/providers`,
    })(() => ({
      response: (prometheusProviders.get() as PrometheusProvider[])
        .filter((provider) => provider.showInUI)
        .map(({ name, kind: id, isConfigurable }) => ({ name, id, isConfigurable })),
    }));
  },
});

export default getMetricProvidersRouteInjectable;
