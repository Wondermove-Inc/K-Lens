/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Observability Hero 섹션 컴포넌트
 */

import React from "react";
import { CLOUD_LOGOS, MAIN_IMAGES } from "../utils/data";

interface ObservabilityHeroProps {
  isDark: boolean;
}

export const ObservabilityHero = ({ isDark }: ObservabilityHeroProps) => {
  return (
    <section className="pt-10 lg:pt-14 pb-10">
      <h1 className="text-4xl font-semibold leading-tight text-center">
        <span
          style={
            {
              backgroundImage: isDark
                ? "linear-gradient(90deg, #E5E5E5 0%, #3B82F6 50%, #172554 100%)"
                : "linear-gradient(90deg, #171717 0%, #3B82F6 50%, #172554 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              display: "inline-block",
            } as React.CSSProperties
          }
        >
          A New Experience in
          <br />
          Kubernetes Observability.
        </span>
      </h1>
      <p className="text-muted-foreground mt-3 text-base leading-relaxed text-center">
        Visually observe everything in your cluster without complex commands.
        <br /> Monitor connections, traffic, latency, and errors in real-time with Service Map,
        <br /> and diagnose root causes instantly with Metrics · Logs · Traces.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-4 md:gap-6">
        {CLOUD_LOGOS.map((logo) => (
          <div key={logo.alt} className="relative h-[50px] w-[50px]">
            <img
              src={isDark ? logo.srcDark : logo.srcLight}
              alt={logo.alt}
              className="h-full w-full object-contain hover:opacity-80 transition-opacity"
            />
          </div>
        ))}
      </div>

      <div className="mt-8">
        <div
          className="rounded-lg overflow-hidden"
          style={
            isDark
              ? {
                  border: "1px solid var(--accent)",
                  boxShadow: "0 0 40px 0 #0C4A6E",
                }
              : { boxShadow: "none" }
          }
        >
          <img
            src={isDark ? MAIN_IMAGES.dark : MAIN_IMAGES.light}
            alt="Observability Dashboard"
            className="w-full object-cover"
          />
        </div>
      </div>
    </section>
  );
};
