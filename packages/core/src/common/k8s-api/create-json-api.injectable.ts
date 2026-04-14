/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { JsonApi } from "@skuberplus/json-api";
import { loggerInjectionToken } from "@skuberplus/logger";
import { Agent } from "https";
import lensProxyCertificateInjectable from "../certificate/lens-proxy-certificate.injectable";
import nodeFetchInjectable from "../fetch/node-fetch.injectable";

import type { JsonApiConfig, JsonApiData, JsonApiDependencies, JsonApiParams } from "@skuberplus/json-api";
import type { RequestInit } from "@skuberplus/node-fetch";

export type CreateJsonApi = <Data = JsonApiData, Params extends JsonApiParams<Data> = JsonApiParams<Data>>(
  config: JsonApiConfig,
  reqInit?: RequestInit,
) => JsonApi<Data, Params>;

const createJsonApiInjectable = getInjectable({
  id: "create-json-api",
  instantiate: (di): CreateJsonApi => {
    const deps: JsonApiDependencies = {
      fetch: di.inject(nodeFetchInjectable),
      logger: di.inject(loggerInjectionToken),
    };
    const lensProxyCert = di.inject(lensProxyCertificateInjectable);

    return (config, reqInit) => {
      if (!config.getRequestOptions) {
        config.getRequestOptions = async () => {
          const agent = new Agent({
            ca: lensProxyCert.get().cert,
          });

          // MSD Agent and Node Agent are not compatible
          return {
            agent,
          } as any;
        };
      }

      // MSD RequestInit and Node RequestInit are not compatible
      return new JsonApi(deps, config, reqInit as any);
    };
  },
});

export default createJsonApiInjectable;
