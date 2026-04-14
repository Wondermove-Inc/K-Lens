/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./jobs.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import React from "react";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { JobCommonTable } from "./jobs-common-table";

// Re-export utility functions for backward compatibility
export { getStatusClass, getStatusText, getStatusVariant, type JobStatus } from "./job-utils";

/**
 * 🎯 목적: Jobs 화면 메인 컴포넌트
 * @returns JobCommonTable을 SiblingsInTabLayout으로 감싼 컴포넌트
 */
const NonInjectedJobs = observer(() => {
  return (
    <SiblingsInTabLayout>
      <JobCommonTable className="Jobs" />
    </SiblingsInTabLayout>
  );
});

export const Jobs = withInjectables(NonInjectedJobs, {
  getProps: (_di, props) => props,
});
