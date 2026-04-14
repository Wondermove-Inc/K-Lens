/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * 🎯 목적: Info Badges 컴포넌트
 */

import React from "react";
import { INFO_TABLE } from "../utils/data";

interface InfoBadgesProps {
  className?: string;
}

export const InfoBadges = ({ className }: InfoBadgesProps) => {
  return (
    <div className={className}>
      {INFO_TABLE.map((item) => (
        <div key={item.key} className="flex items-start gap-3 py-3" style={{ borderBottom: "1px solid var(--accent)" }}>
          <span className="text-muted-foreground text-xs w-38 shrink-0">{item.key}</span>
          <div className="text-foreground text-xs font-medium flex-1">
            {Array.isArray(item.value) ? (
              <ul className="list-disc pl-4 space-y-1">
                {item.value.map((v, idx) => (
                  <li key={idx}>{v}</li>
                ))}
              </ul>
            ) : (
              item.value
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
