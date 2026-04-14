/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { loggerInjectionToken } from "@skuberplus/logger";
import assert from "assert";
import hostedClusterIdInjectable from "../cluster-frame-context/hosted-cluster-id.injectable";
import defaultWebsocketApiParamsInjectable from "./default-websocket-api-params.injectable";
import { TerminalApi } from "./terminal-api";

import type { TerminalApiDependencies, TerminalApiQuery } from "./terminal-api";

export interface CreateTerminalApiOptions {
  clusterId?: string;
}

export type CreateTerminalApi = (query: TerminalApiQuery, options?: CreateTerminalApiOptions) => TerminalApi;

const createTerminalApiInjectable = getInjectable({
  id: "create-terminal-api",
  instantiate: (di): CreateTerminalApi => {
    const hostedClusterId = di.inject(hostedClusterIdInjectable);
    const deps: Omit<TerminalApiDependencies, "clusterId"> = {
      logger: di.inject(loggerInjectionToken),
      defaultParams: di.inject(defaultWebsocketApiParamsInjectable),
    };

    return (query, options) => {
      const targetClusterId = options?.clusterId ?? hostedClusterId;

      assert(targetClusterId, "Can only create terminal APIs within a cluster frame");

      return new TerminalApi(
        {
          clusterId: targetClusterId,
          ...deps,
        },
        query,
      );
    };
  },
});

export default createTerminalApiInjectable;
