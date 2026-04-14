/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { serviceAccountApiInjectable } from "@skuberplus/kube-api-specifics";
import { stopPropagation } from "@skuberplus/utilities";
import React from "react";
import getMaybeDetailsUrlInjectable, {
  type GetMaybeDetailsUrl,
} from "../kube-detail-params/get-maybe-details-url.injectable";
import { MaybeLink } from "../maybe-link";
import { WithTooltip } from "../with-tooltip";

import type { ServiceAccountApi } from "@skuberplus/kube-api";

interface Dependencies {
  getMaybeDetailsUrl: GetMaybeDetailsUrl;
  serviceAccountApi: ServiceAccountApi;
}

interface LinkToServiceAccountProps {
  name?: string;
  namespace?: string;
}

function NonInjectedLinkToServiceAccount({
  name,
  namespace,
  getMaybeDetailsUrl,
  serviceAccountApi,
}: LinkToServiceAccountProps & Dependencies) {
  if (!name || !namespace) return null;

  return (
    <MaybeLink
      key="link"
      to={getMaybeDetailsUrl(
        serviceAccountApi.formatUrlForNotListing({
          name,
          namespace,
        }),
      )}
      onClick={stopPropagation}
    >
      <WithTooltip>{name}</WithTooltip>
    </MaybeLink>
  );
}

export const LinkToServiceAccount = withInjectables<Dependencies, LinkToServiceAccountProps>(
  NonInjectedLinkToServiceAccount,
  {
    getProps: (di, props) => ({
      ...props,
      getMaybeDetailsUrl: di.inject(getMaybeDetailsUrlInjectable),
      serviceAccountApi: di.inject(serviceAccountApiInjectable),
    }),
  },
);
