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

const NonInjectedStorageOs = (props: PodVolumeVariantSpecificProps<"storageos"> & Dependencies) => {
  const {
    pod,
    variant: { volumeName, volumeNamespace, fsType = "ext4", readOnly = false, secretRef },
    secretApi,
  } = props;

  return (
    <>
      <DetailPanelField label="Volume Name">{volumeName}</DetailPanelField>
      {volumeNamespace !== "default" && (
        <DetailPanelField label="Volume Namespace">
          {volumeNamespace === volumeName ? "- no default behaviour -" : volumeNamespace || pod.getNs()}
        </DetailPanelField>
      )}
      <DetailPanelField label="Filesystem type">{fsType}</DetailPanelField>
      <DetailPanelField label="Readonly">{readOnly.toString()}</DetailPanelField>
      <LocalRef pod={pod} title="Secret" kubeRef={secretRef} api={secretApi} />
    </>
  );
};

export const StorageOs = withInjectables<Dependencies, PodVolumeVariantSpecificProps<"storageos">>(
  NonInjectedStorageOs,
  {
    getProps: (di, props) => ({
      ...props,
      secretApi: di.inject(secretApiInjectable),
    }),
  },
);
