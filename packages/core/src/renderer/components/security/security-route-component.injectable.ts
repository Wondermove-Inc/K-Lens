/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 *  Purpose: Connects the /security route to the SecurityPage component.
 * Added /cluster/:id/security route
 *
 * @packageDocumentation
 */

import { getInjectable } from "@ogre-tools/injectable";
import securityRouteInjectable from "../../../common/front-end-routing/routes/cluster/security/security-route.injectable";
import { routeSpecificComponentInjectionToken } from "../../routes/route-specific-component-injection-token";
import { SecurityPage } from "./security-page";

const securityRouteComponentInjectable = getInjectable({
  id: "security-route-component",

  instantiate: (di) => ({
    route: di.inject(securityRouteInjectable),
    Component: SecurityPage,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default securityRouteComponentInjectable;
