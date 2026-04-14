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
import { WebLink } from "../../../../../common/catalog-entities";
import { catalogEntityDetailItemInjectionToken } from "../token";

const weblinkDetailsItemInjectable = getInjectable({
  id: "weblink-details-item",
  instantiate: () => ({
    apiVersions: new Set([WebLink.apiVersion]),
    kind: WebLink.kind,
    components: {
      Details: ({ entity }) => (
        <DetailPanelSection title="More Information">
          <DetailPanelField label="URL" data-testid={`weblink-url-for-${entity.getId()}`}>
            {entity.spec.url}
          </DetailPanelField>
        </DetailPanelSection>
      ),
    },
    orderNumber: 40,
  }),
  injectionToken: catalogEntityDetailItemInjectionToken,
});

export default weblinkDetailsItemInjectable;
