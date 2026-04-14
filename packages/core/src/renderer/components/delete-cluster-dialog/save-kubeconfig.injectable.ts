/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { dumpYaml } from "@skuberplus/kubernetes-client-node";
import * as lockFile from "proper-lockfile";
import writeFileInjectable from "../../../common/fs/write-file.injectable";

import type { KubeConfig } from "@skuberplus/kubernetes-client-node";

export type SaveKubeconfig = (config: KubeConfig, path: string) => Promise<void>;

const saveKubeconfigInjectable = getInjectable({
  id: "save-kubeconfig",
  instantiate: (di): SaveKubeconfig => {
    const writeFile = di.inject(writeFileInjectable);

    return async (config, filePath) => {
      const release = await lockFile.lock(filePath);

      try {
        const contents = dumpYaml(JSON.parse(config.exportConfig()));

        await writeFile(filePath, contents);
      } finally {
        await release();
      }
    };
  },
  causesSideEffects: true,
});

export default saveKubeconfigInjectable;
