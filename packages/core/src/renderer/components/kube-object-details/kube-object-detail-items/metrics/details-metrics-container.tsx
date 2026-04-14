/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import React from "react";

import type { KubeObject } from "@skuberplus/kube-object";
import type { KubeObjectDetailMetrics } from "@skuberplus/metrics";

import type { IComputedValue } from "mobx";

export interface DetailsMetricsContainerProps<K extends KubeObject> {
  metrics: IComputedValue<KubeObjectDetailMetrics<K>[]>;
  object?: K;
}

function NonObservingDetailsMetricsContainer<K extends KubeObject>({
  metrics,
  object,
}: DetailsMetricsContainerProps<K>) {
  if (!object) {
    return null;
  }

  return (
    <>
      {metrics.get().map((metrics) => (
        <metrics.Component object={object} key={metrics.id} />
      ))}
    </>
  );
}

export const DetailsMetricsContainer = observer(NonObservingDetailsMetricsContainer);
