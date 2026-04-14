/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { secretApiInjectable } from "@skuberplus/kube-api-specifics";
// 🎯 shadcn UI 컴포넌트: DrawerItem 대체
import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import React from "react";
import { LocalRef } from "../variant-helpers";

import type { SecretApi } from "@skuberplus/kube-api";

import type { PodVolumeVariantSpecificProps } from "../variant-helpers";

interface Dependencies {
  secretApi: SecretApi;
}

const NonInjectedSecret = (props: PodVolumeVariantSpecificProps<"secret"> & Dependencies) => {
  const {
    pod,
    variant: { secretName, items = [], defaultMode = 0o644, optional = false },
    secretApi,
  } = props;

  return (
    <>
      <LocalRef pod={pod} title="Name" kubeRef={{ name: secretName }} api={secretApi} />
      {items.length > 0 && (
        <DetailPanelField label="Items">
          <ul>
            {items.map(({ key }) => (
              <li key={key}>{key}</li>
            ))}
          </ul>
        </DetailPanelField>
      )}
      <DetailPanelField label="Default File Mode">{`0o${defaultMode.toString(8)}`}</DetailPanelField>
      <DetailPanelField label="Optional">{optional.toString()}</DetailPanelField>
    </>
  );
};

export const Secret = withInjectables<Dependencies, PodVolumeVariantSpecificProps<"secret">>(NonInjectedSecret, {
  getProps: (di, props) => ({
    ...props,
    secretApi: di.inject(secretApiInjectable),
  }),
});
