"use client";

import * as AspectRatioPrimitive from "@radix-ui/react-aspect-ratio";
import React from "react";

/**
 * 🎯 목적: AspectRatio 컴포넌트에 forwardRef 적용하여 React 18/19 호환성 제공
 * 📝 주의사항: Radix UI AspectRatio.Root primitive 사용
 * 🔄 변경이력: 2025-10-11 - React 18/19 dual support를 위한 forwardRef 추가
 */
const AspectRatio = React.forwardRef<
  React.ElementRef<typeof AspectRatioPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AspectRatioPrimitive.Root>
>((props, ref) => {
  return <AspectRatioPrimitive.Root ref={ref} data-slot="aspect-ratio" {...props} />;
});
AspectRatio.displayName = "AspectRatio";

export { AspectRatio };
