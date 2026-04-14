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

const NonInjectedContainerStorageInterface = (props: PodVolumeVariantSpecificProps<"csi"> & Dependencies) => {
  const {
    pod,
    variant: {
      driver,
      readOnly = false,
      fsType = "ext4",
      volumeAttributes = {},
      nodePublishSecretRef,
      controllerPublishSecretRef,
      nodeStageSecretRef,
      controllerExpandSecretRef,
    },
    secretApi,
  } = props;

  return (
    <>
      <DetailPanelField label="Driver">{driver}</DetailPanelField>
      <DetailPanelField label="ReadOnly">{readOnly.toString()}</DetailPanelField>
      <DetailPanelField label="Filesystem Type">{fsType}</DetailPanelField>
      <LocalRef pod={pod} title="Controller Publish Secret" kubeRef={controllerPublishSecretRef} api={secretApi} />
      <LocalRef pod={pod} title="Controller Expand Secret" kubeRef={controllerExpandSecretRef} api={secretApi} />
      <LocalRef pod={pod} title="Node Publish Secret" kubeRef={nodePublishSecretRef} api={secretApi} />
      <LocalRef pod={pod} title="Node Stage Secret" kubeRef={nodeStageSecretRef} api={secretApi} />
      {Object.entries(volumeAttributes).map(([key, value]) => (
        <DetailPanelField key={key} label={key}>
          {value}
        </DetailPanelField>
      ))}
    </>
  );
};

export const ContainerStorageInterface = withInjectables<Dependencies, PodVolumeVariantSpecificProps<"csi">>(
  NonInjectedContainerStorageInterface,
  {
    getProps: (di, props) => ({
      ...props,
      secretApi: di.inject(secretApiInjectable),
    }),
  },
);
