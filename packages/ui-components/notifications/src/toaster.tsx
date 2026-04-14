/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import React from "react";
import { Toaster as Sonner } from "sonner";

/**
 * 🎯 목적: Sonner Toaster 래퍼 컴포넌트
 * 📝 주의사항:
 *   - Electron 환경에서 사용하므로 next-themes 미사용
 *   - 다크 테마 고정, 오른쪽 하단 위치
 * 🔄 변경이력: 2025-11-25 - 초기 생성 (Sonner 마이그레이션)
 */
export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      richColors
      closeButton
      className="toaster group"
      // 🔄 THEME-040: HSL fallback 제거 (global.css에 정의됨)
      toastOptions={{
        style: {
          background: "var(--popover)",
          color: "var(--popover-foreground)",
          border: "1px solid var(--border)",
        },
      }}
    />
  );
}
