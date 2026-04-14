/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { DetailPanelField } from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import yaml from "js-yaml";
import React, { Component } from "react";
import { defaultYamlDumpOptions } from "../../../common/kube-helpers";
import { DrawerParamToggler } from "../drawer";
import { MonacoEditor } from "../monaco-editor";

import type { DaemonSet, Deployment, Job, Pod, ReplicaSet, StatefulSet } from "@skuberplus/kube-object";

export interface PodDetailsAffinitiesProps {
  workload: Pod | Deployment | DaemonSet | StatefulSet | ReplicaSet | Job;
}

export class PodDetailsAffinities extends Component<PodDetailsAffinitiesProps> {
  render() {
    const { workload } = this.props;
    const affinitiesNum = workload.getAffinityNumber();
    const affinities = workload.getAffinity();

    if (!affinitiesNum) return null;

    return (
      <DetailPanelField label="Affinities" className="PodDetailsAffinities">
        <DrawerParamToggler label={affinitiesNum}>
          <MonacoEditor readOnly style={{ height: 200 }} value={yaml.dump(affinities, defaultYamlDumpOptions)} />
        </DrawerParamToggler>
      </DetailPanelField>
    );
  }
}
