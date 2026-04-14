/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
// 🎯 shadcn UI 컴포넌트: DrawerItem/DrawerTitle 대체
import {
  DetailPanelField,
  DetailPanelSection,
} from "@skuberplus/storybook-shadcn/src/components/ui/detail-panel-section";
import React from "react";
import { KubernetesCluster } from "../../../../../common/catalog-entities";
import { catalogEntityDetailItemInjectionToken } from "../token";

const kubernetesClusterDetailsItemInjectable = getInjectable({
  id: "kubernetes-cluster-details-item",
  instantiate: () => ({
    apiVersions: new Set([KubernetesCluster.apiVersion]),
    kind: KubernetesCluster.kind,
    orderNumber: 40,
    components: {
      Details: ({ entity }) => (
        <DetailPanelSection title="Kubernetes Information">
          <div className="box grow EntityMetadata">
            <DetailPanelField label="Distribution" data-testid={`kubernetes-distro-for-${entity.getId()}`}>
              {String(entity.metadata.distro || "unknown")}
            </DetailPanelField>
            <DetailPanelField label="Kubelet Version">
              {String(entity.metadata.kubeVersion || "unknown")}
            </DetailPanelField>
          </div>
        </DetailPanelSection>
      ),
    },
  }),
  injectionToken: catalogEntityDetailItemInjectionToken,
});

export default kubernetesClusterDetailsItemInjectable;
