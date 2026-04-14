/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { podApiInjectable } from "@skuberplus/kube-api-specifics";
import { stopPropagation } from "@skuberplus/utilities";
import React from "react";
import getMaybeDetailsUrlInjectable, {
  type GetMaybeDetailsUrl,
} from "../kube-detail-params/get-maybe-details-url.injectable";
import { MaybeLink } from "../maybe-link";
import { WithTooltip } from "../with-tooltip";

import type { PodApi } from "@skuberplus/kube-api";

interface Dependencies {
  getMaybeDetailsUrl: GetMaybeDetailsUrl;
  podApi: PodApi;
}

interface LinkToPodProps {
  name?: string;
  namespace?: string;
}

function NonInjectedLinkToPod({ name, namespace, getMaybeDetailsUrl, podApi }: LinkToPodProps & Dependencies) {
  if (!name || !namespace) return null;

  return (
    <MaybeLink
      key="link"
      to={getMaybeDetailsUrl(
        podApi.formatUrlForNotListing({
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

export const LinkToPod = withInjectables<Dependencies, LinkToPodProps>(NonInjectedLinkToPod, {
  getProps: (di, props) => ({
    ...props,
    getMaybeDetailsUrl: di.inject(getMaybeDetailsUrlInjectable),
    podApi: di.inject(podApiInjectable),
  }),
});
