/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Observability Features 섹션 컴포넌트
 */

import React from "react";
import { FEATURES } from "../utils/data";

interface ObservabilityFeaturesProps {
  isDark: boolean;
}

export const ObservabilityFeatures = ({ isDark }: ObservabilityFeaturesProps) => {
  return (
    <section className="pt-10 pb-10">
      <div className="flex flex-col gap-2 mb-6">
        <h2 className="text-foreground text-2xl font-semibold">Powerful Observability Tools</h2>
        <p className="text-muted-foreground text-base leading-relaxed">
          Understand every aspect of your services and resolve issues quickly
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="flex flex-col gap-3">
            <div className="rounded-lg overflow-hidden border border-[var(--border)]">
              <img
                src={isDark ? feature.imageDark : feature.imageLight}
                alt={feature.title}
                className="w-full object-cover"
              />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-card-foreground text-base font-normal">{feature.title}</h3>
              <p className="text-muted-foreground text-sm font-normal leading-relaxed">{feature.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
