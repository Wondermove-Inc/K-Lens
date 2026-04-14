/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Observability Footer 섹션 컴포넌트
 */

import React from "react";
import { FOOTER_IMAGES } from "../utils/data";

interface ObservabilityFooterSectionProps {
  isDark: boolean;
}

export const ObservabilityFooterSection = ({ isDark }: ObservabilityFooterSectionProps) => {
  return (
    <section className="pt-10 pb-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-foreground text-2xl font-semibold">
            OpenTelemetry Native Open Standards Based Observability
          </h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            Build observability freely with OpenTelemetry standards, no vendor lock-in. <br />
            Fully compatible with existing infrastructure and provides flexible operations.
          </p>
        </div>

        <div className="rounded-lg overflow-hidden">
          <img
            src={isDark ? FOOTER_IMAGES.dark : FOOTER_IMAGES.light}
            alt="OpenTelemetry"
            className="w-full object-cover"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1">
            <h4 className="text-foreground text-sm font-semibold">OpenTelemetry Native</h4>
            <p className="text-muted-foreground text-xs">Open standards based, no vendor lock-in</p>
          </div>
          <div className="flex flex-col gap-1">
            <h4 className="text-foreground text-sm font-semibold">Multi-Cluster Integration</h4>
            <p className="text-muted-foreground text-xs">Unified AWS, GCP, Azure, On-premise management</p>
          </div>
          <div className="flex flex-col gap-1">
            <h4 className="text-foreground text-sm font-semibold">Real-time Analysis</h4>
            <p className="text-muted-foreground text-xs">Millisecond-level real-time data processing</p>
          </div>
          <div className="flex flex-col gap-1">
            <h4 className="text-foreground text-sm font-semibold">No Code Changes</h4>
            <p className="text-muted-foreground text-xs">Start immediately with agent installation</p>
          </div>
        </div>
      </div>
    </section>
  );
};
