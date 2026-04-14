/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./storage-class-details.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { StorageClass } from "@skuberplus/kube-object";
import { loggerInjectionToken } from "@skuberplus/logger";
// 🎯 shadcn UI 컴포넌트: DrawerItem/DrawerTitle/Badge 대체
import { Badge } from "@skuberplus/storybook-shadcn/src/components/ui/badge";
import {
  DetailPanelField,
  DetailPanelSection,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import startCase from "lodash/startCase";
import { disposeOnUnmount, observer } from "mobx-react";
import React, { Component } from "react";
import subscribeStoresInjectable from "../../kube-watch-api/subscribe-stores.injectable";
import persistentVolumeStoreInjectable from "../storage-volumes/store.injectable";
import { VolumeDetailsList } from "../storage-volumes/volume-details-list";
import storageClassStoreInjectable from "./store.injectable";

import type { Logger } from "@skuberplus/logger";

import type { SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { KubeObjectDetailsProps } from "../kube-object-details";
import type { PersistentVolumeStore } from "../storage-volumes/store";
import type { StorageClassStore } from "./store";

export interface StorageClassDetailsProps extends KubeObjectDetailsProps<StorageClass> {}

interface Dependencies {
  subscribeStores: SubscribeStores;
  storageClassStore: StorageClassStore;
  persistentVolumeStore: PersistentVolumeStore;
  logger: Logger;
}

class NonInjectedStorageClassDetails extends Component<StorageClassDetailsProps & Dependencies> {
  componentDidMount() {
    disposeOnUnmount(this, [this.props.subscribeStores([this.props.persistentVolumeStore])]);
  }

  render() {
    const { object: storageClass, storageClassStore } = this.props;

    if (!storageClass) {
      return null;
    }

    if (!(storageClass instanceof StorageClass)) {
      this.props.logger.error(
        "[StorageClassDetails]: passed object that is not an instanceof StorageClass",
        storageClass,
      );

      return null;
    }

    const persistentVolumes = storageClassStore.getPersistentVolumes(storageClass);
    const { provisioner, parameters, mountOptions } = storageClass;

    // 🎯 shadcn DetailPanelField/DetailPanelSection으로 마이그레이션 완료
    return (
      <div className="StorageClassDetails">
        {provisioner && (
          <DetailPanelField label="Provisioner">
            <Badge variant="outline">{provisioner}</Badge>
          </DetailPanelField>
        )}
        <DetailPanelField label="Volume Binding Mode">{storageClass.getVolumeBindingMode()}</DetailPanelField>
        <DetailPanelField label="Reclaim Policy">{storageClass.getReclaimPolicy()}</DetailPanelField>

        {mountOptions && <DetailPanelField label="Mount Options">{mountOptions.join(", ")}</DetailPanelField>}
        {parameters && (
          <DetailPanelSection title="Parameters">
            {Object.entries(parameters).map(([name, value]) => (
              <DetailPanelField key={name + value} label={startCase(name)}>
                {value}
              </DetailPanelField>
            ))}
          </DetailPanelSection>
        )}
        <VolumeDetailsList persistentVolumes={persistentVolumes} />
      </div>
    );
  }
}

export const StorageClassDetails = withInjectables<Dependencies, StorageClassDetailsProps>(
  observer(NonInjectedStorageClassDetails),
  {
    getProps: (di, props) => ({
      ...props,
      subscribeStores: di.inject(subscribeStoresInjectable),
      storageClassStore: di.inject(storageClassStoreInjectable),
      persistentVolumeStore: di.inject(persistentVolumeStoreInjectable),
      logger: di.inject(loggerInjectionToken),
    }),
  },
);
