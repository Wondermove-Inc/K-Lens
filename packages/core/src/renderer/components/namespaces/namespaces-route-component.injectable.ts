/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import namespacesRouteInjectable from "../../../common/front-end-routing/routes/cluster/namespaces/namespaces-route.injectable";
import { routeSpecificComponentInjectionToken } from "../../routes/route-specific-component-injection-token";
import { Namespaces } from "./namespaces";

const namespacesRouteComponentInjectable = getInjectable({
  id: "namespaces-route-component",

  instantiate: (di) => ({
    route: di.inject(namespacesRouteInjectable),
    Component: Namespaces,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default namespacesRouteComponentInjectable;
