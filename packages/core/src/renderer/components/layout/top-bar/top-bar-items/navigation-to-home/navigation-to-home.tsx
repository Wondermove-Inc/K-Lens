/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { Home } from "lucide-react";
import { observer } from "mobx-react";
import React from "react";
import { Button } from "@/components/shadcn-ui/button";
import { cn } from "@/lib/utils";
import navigateToWelcomeInjectable from "../../../../../../common/front-end-routing/routes/welcome/navigate-to-welcome.injectable";
import welcomeRouteInjectable from "../../../../../../common/front-end-routing/routes/welcome/welcome-route.injectable";
import routeIsActiveInjectable from "../../../../../routes/route-is-active.injectable";
import styles from "../../top-bar.module.scss";

import type { IComputedValue } from "mobx";

interface Dependencies {
  disabled: IComputedValue<boolean>;
  goHome: () => void;
}

const NonInjectedNavigationToHome = observer(({ disabled, goHome }: Dependencies) => {
  const isDisabled = disabled.get();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      data-testid="home-button"
      aria-label="홈으로 이동"
      disabled={isDisabled}
      onClick={goHome}
      className={cn(styles.navigationButton)}
    >
      <Home className="h-4 w-4" />
    </Button>
  );
});

export const NavigationToHome = withInjectables<Dependencies>(
  NonInjectedNavigationToHome,

  {
    getProps: (di) => ({
      disabled: di.inject(routeIsActiveInjectable, di.inject(welcomeRouteInjectable)),

      goHome: di.inject(navigateToWelcomeInjectable),
    }),
  },
);
