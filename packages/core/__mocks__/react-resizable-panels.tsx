/**
 * react-resizable-panels 모킹
 *
 * 🎯 목적: Jest 테스트 시 react-resizable-panels ESM 문제 해결
 *
 * 문제: react-resizable-panels 패키지가 ESM import를 사용하며
 * Jest에서 파싱 오류 발생 (Cannot use import statement outside a module)
 *
 * 해결: 기본 컴포넌트 구조를 유지하는 Mock 컴포넌트 제공
 */
import * as React from "react";

/**
 * PanelGroup Mock
 * 📝 자식 요소를 flex 컨테이너로 렌더링
 */
export const PanelGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    direction?: "horizontal" | "vertical";
    onLayout?: (sizes: number[]) => void;
    autoSaveId?: string;
  }
>(({ children, direction = "horizontal", className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-panel-group=""
      data-panel-group-direction={direction}
      className={className}
      style={{ display: "flex", flexDirection: direction === "vertical" ? "column" : "row" }}
      {...props}
    >
      {children}
    </div>
  );
});
PanelGroup.displayName = "PanelGroup";

/**
 * Panel Mock
 * 📝 개별 패널을 div로 렌더링
 */
export const Panel = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    defaultSize?: number;
    minSize?: number;
    maxSize?: number;
    collapsible?: boolean;
    collapsedSize?: number;
    onCollapse?: () => void;
    onExpand?: () => void;
    onResize?: (size: number) => void;
    order?: number;
  }
>(({ children, defaultSize, minSize, maxSize, className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-panel=""
      className={className}
      style={{ flex: defaultSize ? `0 0 ${defaultSize}%` : "1 1 auto" }}
      {...props}
    >
      {children}
    </div>
  );
});
Panel.displayName = "Panel";

/**
 * PanelResizeHandle Mock
 * 📝 리사이즈 핸들을 div로 렌더링
 */
export function PanelResizeHandle({
  children,
  className,
  disabled,
  id,
  onDragging,
  ...props
}: React.ComponentProps<"div"> & {
  disabled?: boolean;
  id?: string;
  onDragging?: (isDragging: boolean) => void;
}) {
  return (
    <div
      data-panel-resize-handle=""
      data-panel-resize-handle-id={id}
      className={className}
      style={{ cursor: disabled ? "default" : "col-resize" }}
      {...props}
    >
      {children}
    </div>
  );
}
PanelResizeHandle.displayName = "PanelResizeHandle";

/**
 * Imperative Panel API Mock
 */
export type ImperativePanelHandle = {
  collapse: () => void;
  expand: () => void;
  getCollapsed: () => boolean;
  getSize: () => number;
  resize: (size: number) => void;
};

/**
 * Imperative PanelGroup API Mock
 */
export type ImperativePanelGroupHandle = {
  getLayout: () => number[];
  setLayout: (sizes: number[]) => void;
};

// 기본 내보내기
export default {
  PanelGroup,
  Panel,
  PanelResizeHandle,
};
