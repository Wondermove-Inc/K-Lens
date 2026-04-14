/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { ArrowLeft } from "lucide-react";
import { observer } from "mobx-react";
import React from "react";
import { Button } from "@/components/shadcn-ui/button";
import { cn } from "@/lib/utils";
import styles from "../../top-bar.module.scss";
import goBackInjectable from "./go-back/go-back.injectable";
import topBarPrevEnabledInjectable from "./prev-enabled.injectable";

import type { IComputedValue } from "mobx";

interface Dependencies {
  prevEnabled: IComputedValue<boolean>;
  goBack: () => void;
}

const NonInjectedNavigationToBack = observer(({ prevEnabled, goBack }: Dependencies) => {
  const disabled = !prevEnabled.get();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      data-testid="history-back"
      aria-label="뒤로 가기"
      disabled={disabled}
      onClick={goBack}
      className={cn(styles.navigationButton)}
    >
      <ArrowLeft className="h-4 w-4" />
    </Button>
  );
});

export const NavigationToBack = withInjectables<Dependencies>(
  NonInjectedNavigationToBack,

  {
    getProps: (di) => ({
      prevEnabled: di.inject(topBarPrevEnabledInjectable),
      goBack: di.inject(goBackInjectable),
    }),
  },
);
