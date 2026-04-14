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

const NonInjectedFlexVolume = (props: PodVolumeVariantSpecificProps<"flexVolume"> & Dependencies) => {
  const {
    pod,
    variant: { driver, fsType, secretRef, readOnly = false, options = {} },
    secretApi,
  } = props;

  return (
    <>
      <DetailPanelField label="Driver">{driver}</DetailPanelField>
      <DetailPanelField label="Filesystem Type">{fsType || "-- system default --"}</DetailPanelField>
      <LocalRef pod={pod} title="Secret" kubeRef={secretRef} api={secretApi} />
      <DetailPanelField label="Readonly">{readOnly.toString()}</DetailPanelField>
      {Object.entries(options).map(([key, value]) => (
        <DetailPanelField key={key} label={`Option: ${key}`}>
          {value}
        </DetailPanelField>
      ))}
    </>
  );
};

export const FlexVolume = withInjectables<Dependencies, PodVolumeVariantSpecificProps<"flexVolume">>(
  NonInjectedFlexVolume,
  {
    getProps: (di, props) => ({
      ...props,
      secretApi: di.inject(secretApiInjectable),
    }),
  },
);
