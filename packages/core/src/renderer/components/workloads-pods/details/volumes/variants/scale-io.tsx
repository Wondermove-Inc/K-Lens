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

const NonInjectedScaleIo = (props: PodVolumeVariantSpecificProps<"scaleIO"> & Dependencies) => {
  const {
    pod,
    variant: {
      gateway,
      system,
      secretRef,
      sslEnabled = false,
      protectionDomain,
      storagePool,
      storageMode = "ThinProvisioned",
      volumeName,
      fsType = "xfs",
      readOnly = false,
    },
    secretApi,
  } = props;

  return (
    <>
      <DetailPanelField label="Gateway">{gateway}</DetailPanelField>
      <DetailPanelField label="System">{system}</DetailPanelField>
      <LocalRef pod={pod} title="Name" kubeRef={secretRef} api={secretApi} />
      <DetailPanelField label="SSL Enabled">{sslEnabled.toString()}</DetailPanelField>
      {protectionDomain && <DetailPanelField label="Protection Domain Name">{protectionDomain}</DetailPanelField>}
      {storagePool && <DetailPanelField label="Storage Pool">{storagePool}</DetailPanelField>}
      {storageMode && <DetailPanelField label="Storage Mode">{storageMode}</DetailPanelField>}
      <DetailPanelField label="Volume Name">{volumeName}</DetailPanelField>
      <DetailPanelField label="Filesystem Type">{fsType}</DetailPanelField>
      <DetailPanelField label="Readonly">{readOnly.toString()}</DetailPanelField>
    </>
  );
};

export const ScaleIo = withInjectables<Dependencies, PodVolumeVariantSpecificProps<"scaleIO">>(NonInjectedScaleIo, {
  getProps: (di, props) => ({
    ...props,
    secretApi: di.inject(secretApiInjectable),
  }),
});
