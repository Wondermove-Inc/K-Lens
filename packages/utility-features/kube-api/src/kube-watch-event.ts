/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { KubeStatusData } from "@skuberplus/kube-object";

export type IKubeWatchEvent<T> =
  | {
      readonly type: "ADDED" | "MODIFIED" | "DELETED";
      readonly object: T;
    }
  | {
      readonly type: "ERROR";
      readonly object?: KubeStatusData;
    };
