/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import React from "react";
import { ButtonGroup } from "@/components/shadcn-ui/button-group";
import { Separator } from "@/components/shadcn-ui/separator";
import styles from "../../top-bar.module.scss";
import { NavigationToBack } from "../navigation-to-back/navigation-to-back";
import { NavigationToForward } from "../navigation-to-forward/navigation-to-forward";
import { NavigationToHome } from "../navigation-to-home/navigation-to-home";

export const NavigationControls = () => (
  <div className={styles.navigationControls}>
    <ButtonGroup className={styles.navigationGroup}>
      <NavigationToHome />
      <Separator
        orientation="vertical"
        className="mx-1 h-5 w-px bg-sidebar-border"
        style={{ height: "20px", width: "1px" }}
      />
      <NavigationToBack />
      <NavigationToForward />
    </ButtonGroup>
  </div>
);
