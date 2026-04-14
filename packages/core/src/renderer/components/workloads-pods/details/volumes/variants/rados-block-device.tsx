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

const NonInjectedRadosBlockDevice = (props: PodVolumeVariantSpecificProps<"rbd"> & Dependencies) => {
  const {
    pod,
    variant: {
      monitors,
      image,
      fsType = "ext4",
      pool = "rbd",
      user = "admin",
      keyring = "/etc/ceph/keyright",
      secretRef,
      readOnly = false,
    },
    secretApi,
  } = props;

  return (
    <>
      <DetailPanelField label="Ceph Monitors">
        <ul>
          {monitors.map((monitor) => (
            <li key={monitor}>{monitor}</li>
          ))}
        </ul>
      </DetailPanelField>
      <DetailPanelField label="Image">{image}</DetailPanelField>
      <DetailPanelField label="Filesystem Type">{fsType}</DetailPanelField>
      <DetailPanelField label="Pool">{pool}</DetailPanelField>
      <DetailPanelField label="User">{user}</DetailPanelField>
      {secretRef ? (
        <LocalRef pod={pod} title="Authentication Secret" kubeRef={secretRef} api={secretApi} />
      ) : (
        <DetailPanelField label="Keyright Path">{keyring}</DetailPanelField>
      )}
      <DetailPanelField label="Readonly">{readOnly.toString()}</DetailPanelField>
    </>
  );
};

export const RadosBlockDevice = withInjectables<Dependencies, PodVolumeVariantSpecificProps<"rbd">>(
  NonInjectedRadosBlockDevice,
  {
    getProps: (di, props) => ({
      ...props,
      secretApi: di.inject(secretApiInjectable),
    }),
  },
);
