/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import logWindowRouteInjectable from "../../../common/front-end-routing/routes/log-window/log-window-route.injectable";
import { routeSpecificComponentInjectionToken } from "../../routes/route-specific-component-injection-token";
import { LogWindowPage } from "./log-window-page";

/**
 * 🎯 목적: /log-window 라우트에 LogWindowPage 컴포넌트 연결
 */
const logWindowRouteComponentInjectable = getInjectable({
  id: "log-window-route-component",

  instantiate: (di) => ({
    route: di.inject(logWindowRouteInjectable),
    Component: LogWindowPage,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default logWindowRouteComponentInjectable;
