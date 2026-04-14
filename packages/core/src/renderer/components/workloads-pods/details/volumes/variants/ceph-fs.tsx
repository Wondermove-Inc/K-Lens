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

const NonInjectedCephFs = (props: PodVolumeVariantSpecificProps<"cephfs"> & Dependencies) => {
  const {
    pod,
    variant: {
      monitors,
      path = "/",
      user = "admin",
      secretFile = "/etc/ceph/user.secret",
      secretRef,
      readOnly = false,
    },
    secretApi,
  } = props;

  return (
    <>
      <DetailPanelField label="Monitors">
        <ul>
          {monitors.map((monitor) => (
            <li key={monitor}>{monitor}</li>
          ))}
        </ul>
      </DetailPanelField>
      <DetailPanelField label="Mount Path">{path}</DetailPanelField>
      <DetailPanelField label="Username">{user}</DetailPanelField>
      {secretRef ? (
        <LocalRef pod={pod} title="Secret" kubeRef={secretRef} api={secretApi} />
      ) : (
        <DetailPanelField label="Secret Filepath">{secretFile}</DetailPanelField>
      )}
      <DetailPanelField label="Readonly" data-testid="cephfs-readonly">
        {readOnly.toString()}
      </DetailPanelField>
    </>
  );
};

export const CephFs = withInjectables<Dependencies, PodVolumeVariantSpecificProps<"cephfs">>(NonInjectedCephFs, {
  getProps: (di, props) => ({
    ...props,
    secretApi: di.inject(secretApiInjectable),
  }),
});
