/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Validating Webhook Configurations 리스트 뷰 래퍼 컴포넌트 (shadcn UI 마이그레이션 완료)
 *
 * 🔄 변경이력:
 *   - 2025-10-30: shadcn UI 마이그레이션 (기존 80줄 → 20줄, 75% 감소)
 */

import React from "react";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { ValidatingWebhookConfigurationsCommonTable } from "./validating-webhook-configurations-common-table";

export const ValidatingWebhookConfigurations = () => {
  return (
    <SiblingsInTabLayout>
      <ValidatingWebhookConfigurationsCommonTable />
    </SiblingsInTabLayout>
  );
};
