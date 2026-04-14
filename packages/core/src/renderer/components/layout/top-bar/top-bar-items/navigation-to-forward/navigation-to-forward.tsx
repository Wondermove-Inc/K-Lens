/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { ArrowRight } from "lucide-react";
import { observer } from "mobx-react";
import React from "react";
import { Button } from "@/components/shadcn-ui/button";
import { cn } from "@/lib/utils";
import styles from "../../top-bar.module.scss";
import goForwardInjectable from "./go-forward/go-forward.injectable";
import topBarNextEnabledInjectable from "./next-enabled.injectable";

import type { IComputedValue } from "mobx";

interface Dependencies {
  nextEnabled: IComputedValue<boolean>;
  goForward: () => void;
}

const NonInjectedNavigationToForward = observer(({ nextEnabled, goForward }: Dependencies) => {
  const disabled = !nextEnabled.get();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      data-testid="history-forward"
      aria-label="앞으로 가기"
      disabled={disabled}
      onClick={goForward}
      className={cn(styles.navigationButton)}
    >
      <ArrowRight className="h-4 w-4" />
    </Button>
  );
});

export const NavigationToForward = withInjectables<Dependencies>(
  NonInjectedNavigationToForward,

  {
    getProps: (di) => ({
      nextEnabled: di.inject(topBarNextEnabledInjectable),
      goForward: di.inject(goForwardInjectable),
    }),
  },
);
