/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🔄 변경이력:
 * - 2025-11-04: shadcn UI 마이그레이션 (NodesRoute → Nodes)
 *   - 기존 route.tsx (KubeObjectListLayout) 대신 nodes.tsx (shadcn + TanStack Table) 사용
 */

import { getInjectable } from "@ogre-tools/injectable";
import nodesRouteInjectable from "../../../common/front-end-routing/routes/cluster/nodes/nodes-route.injectable";
import { routeSpecificComponentInjectionToken } from "../../routes/route-specific-component-injection-token";
import { Nodes } from "./nodes";

const nodesRouteComponentInjectable = getInjectable({
  id: "nodes-route-component",

  instantiate: (di) => ({
    route: di.inject(nodesRouteInjectable),
    Component: Nodes, // 🎯 shadcn UI + TanStack Table 기반 컴포넌트
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default nodesRouteComponentInjectable;
