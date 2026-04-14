/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { formatDuration } from "@skuberplus/utilities";
import React, { useEffect, useRef } from "react";

export interface ReactiveDurationProps {
  timestamp: string | undefined;

  /**
   * Whether the display string should prefer length over precision
   * @default true
   */
  compact?: boolean;
}

// Shared ticker pool - single timer for all ReactiveDuration components
const subscribers = new Set<() => void>();
let intervalHandle: ReturnType<typeof setInterval> | null = null;

function subscribe(callback: () => void): () => void {
  if (subscribers.size === 0) {
    intervalHandle = setInterval(() => {
      subscribers.forEach((cb) => cb());
    }, 1000);
  }
  subscribers.add(callback);

  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0 && intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  };
}

/**
 * A duration component that updates every second using vanilla JS DOM manipulation.
 * This bypasses React's rendering pipeline for better CPU efficiency.
 */
export const ReactiveDuration = ({ timestamp, compact = true }: ReactiveDurationProps) => {
  const spanRef = useRef<HTMLSpanElement>(null);
  const timestampMs = timestamp ? new Date(timestamp).getTime() : 0;

  // Calculate initial value to prevent flicker
  const initialText = timestamp ? formatDuration(Date.now() - timestampMs, compact) : "<unknown>";

  useEffect(() => {
    if (!timestamp) return;

    const update = () => {
      if (spanRef.current) {
        const elapsed = Date.now() - timestampMs;
        spanRef.current.textContent = formatDuration(elapsed, compact);
      }
    };

    return subscribe(update);
  }, [timestamp, timestampMs, compact]);

  if (!timestamp) {
    return <>{"<unknown>"}</>;
  }

  return <span ref={spanRef}>{initialText}</span>;
};
