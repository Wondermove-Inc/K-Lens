import React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * 🎯 목적: Toaster 컴포넌트 (sonner toast 라이브러리)
 * 📝 주의사항:
 *   - sonner의 Toaster는 ref를 지원하지 않음
 *   - Electron 환경에서 사용하므로 next-themes 제거
 * 🔄 변경이력:
 *   - 2025-10-11 - React 18/19 dual support 검토 (ref 미지원 확인)
 *   - 2025-11-25 - next-themes 제거, Electron 호환 설정으로 변경
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      richColors
      closeButton
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
