/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { persistentVolumeClaimApiInjectable } from "@skuberplus/kube-api-specifics";
import React from "react";
import { LocalRef } from "../variant-helpers";

import type { PersistentVolumeClaimApi } from "@skuberplus/kube-api";

import type { PodVolumeVariantSpecificProps } from "../variant-helpers";

interface Dependencies {
  persistentVolumeClaimApi: PersistentVolumeClaimApi;
}

const NonInjectedPersistentVolumeClaim = (
  props: PodVolumeVariantSpecificProps<"persistentVolumeClaim"> & Dependencies,
) => {
  const {
    pod,
    variant: { claimName },
    persistentVolumeClaimApi,
  } = props;

  return <LocalRef pod={pod} title="Name" kubeRef={{ name: claimName }} api={persistentVolumeClaimApi} />;
};

export const PersistentVolumeClaim = withInjectables<
  Dependencies,
  PodVolumeVariantSpecificProps<"persistentVolumeClaim">
>(NonInjectedPersistentVolumeClaim, {
  getProps: (di, props) => ({
    ...props,
    persistentVolumeClaimApi: di.inject(persistentVolumeClaimApiInjectable),
  }),
});
