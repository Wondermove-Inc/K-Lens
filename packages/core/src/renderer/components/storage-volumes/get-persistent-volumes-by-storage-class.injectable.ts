/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import persistentVolumeStoreInjectable from "./store.injectable";

import type { PersistentVolume, StorageClass } from "@skuberplus/kube-object";

export type GetPersistentVolumesByStorageClass = (obj: StorageClass) => PersistentVolume[];

const getPersistentVolumesByStorageClassInjectable = getInjectable({
  id: "get-persistent-volumes-by-storage-class",
  instantiate: (di): GetPersistentVolumesByStorageClass => {
    const store = di.inject(persistentVolumeStoreInjectable);

    return (obj) => store.getByStorageClass(obj);
  },
});

export default getPersistentVolumesByStorageClassInjectable;
