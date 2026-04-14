/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./confirm-dialog.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { cssNames, noop } from "@skuberplus/utilities";
import { XIcon } from "lucide-react";
import { observer } from "mobx-react";
import React, { useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../shadcn-ui/alert-dialog";
import { notificationPanelStore } from "../status-bar/items/notification-panel.store";
import confirmDialogStateInjectable from "./state.injectable";

import type { StrictReactNode } from "@skuberplus/utilities";

import type { IObservableValue } from "mobx";

// DialogProps를 명시적으로 정의 (기존 Dialog 컴포넌트 호환성 유지)
interface DialogProps {
  animated?: boolean;
  className?: string;
  [key: string]: any;
}

export interface ConfirmDialogProps extends Partial<DialogProps> {}

export interface ConfirmDialogParams extends ConfirmDialogBooleanParams {
  ok?: () => any | Promise<any>;
  cancel?: () => any | Promise<any>;
}

// shadcn AlertDialog 버튼에 전달할 수 있는 props
interface AlertDialogButtonProps {
  className?: string;
  [key: string]: any;
}

export interface ConfirmDialogBooleanParams {
  labelOk?: StrictReactNode;
  labelCancel?: StrictReactNode;
  message: StrictReactNode;
  icon?: StrictReactNode;
  okButtonProps?: Partial<AlertDialogButtonProps>;
  cancelButtonProps?: Partial<AlertDialogButtonProps>;
}

interface Dependencies {
  state: IObservableValue<ConfirmDialogParams | undefined>;
}

const defaultParams = {
  ok: noop,
  cancel: noop,
  labelOk: "Ok",
  labelCancel: "Cancel",
  icon: null,
};

/**
 * 🎯 목적: 사용자 확인 다이얼로그 컴포넌트 (shadcn AlertDialog 스토리북 표준 스타일)
 *
 * 📝 주의사항:
 * - observer() 함수 래퍼 사용 (MobX 반응형 상태 추적)
 * - withInjectables는 export 시 적용 (DI)
 * - shadcn AlertDialog 스토리북 표준 패턴 사용 (커스텀 className 제거)
 * - AlertDialogHeader에 icon + AlertDialogTitle 배치 (flex-row)
 * - AlertDialogFooter/Action/Cancel 모두 기본 스타일 사용
 * - Radix UI 기반 접근성 향상 (키보드 네비게이션, ARIA 속성)
 * - 기존 openConfirmDialog API 100% 호환성 유지
 * - animated, className 등 기존 DialogProps 호환성 유지 (테스트용)
 *
 * 🔄 변경이력:
 * - 2025-11-12 - 스토리북 표준 스타일 적용 (커스텀 className 제거, 기본 스타일 사용)
 * - 2025-11-12 - AlertDialogHeader에 icon + AlertDialogTitle 배치 (flex-row)
 * - 2025-11-12 - shadcn AlertDialog로 마이그레이션 (클래스 → 함수 컴포넌트)
 * - 2025-10-19 - @observer 데코레이터 추가 (MobX HOC 호환성 문제 해결)
 * - 2025-10-19 - React.Component로 변경 (TypeError 해결)
 * - 2025-10-19 - @observer → observer() 함수 래퍼로 변경 (트랜스파일 문제 우회)
 */
const NonInjectedConfirmDialog = observer(({ state, className, ...dialogProps }: ConfirmDialogProps & Dependencies) => {
  // 로딩 상태 관리 (ok 버튼 waiting 표시)
  const [isSaving, setIsSaving] = useState(false);

  // MobX 반응형 상태에서 파라미터 가져오기
  const params = useMemo(() => {
    return Object.assign({}, defaultParams, state.get() ?? ({} as ConfirmDialogParams));
  }, [state.get()]);

  // Dialog 열림 상태 확인
  const isOpen = Boolean(state.get());

  // OK 버튼 클릭 핸들러 (비동기 지원, 에러 처리)
  const handleOk = async (event: React.MouseEvent) => {
    // event.preventDefault() 제거 - Radix UI의 포커스 복원 허용

    try {
      setIsSaving(true);
      await (async () => params.ok())();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Unknown error occurred while ok-ing";
      notificationPanelStore.addError("system", "Confirmation Failed", `Confirmation action failed: ${errorMessage}`);
    } finally {
      setIsSaving(false);
      state.set(undefined);
    }
  };

  // Cancel 버튼 클릭 핸들러 (비동기 지원, 에러 처리)
  const handleCancel = async (event: React.MouseEvent) => {
    // event.preventDefault() 제거 - Radix UI의 포커스 복원 허용

    try {
      await Promise.resolve(params.cancel());
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Unknown error occurred while cancelling";
      notificationPanelStore.addError("system", "Cancel Failed", `Cancelling action failed: ${errorMessage}`);
    } finally {
      setIsSaving(false);
      state.set(undefined);
    }
  };

  // Dialog 닫힘 핸들러 (ESC 키, Overlay 클릭)
  // 🎯 목적: Dialog 닫을 때 Portal과 pointer-events 강제 정리 (포커스 트랩 해제)
  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        setIsSaving(false);
        state.set(undefined);

        // Dialog를 닫은 후 Portal 및 body style 강제 정리
        setTimeout(() => {
          // 모든 Radix Portal 제거
          document.querySelectorAll("[data-radix-portal]").forEach((portal) => {
            portal.remove();
          });

          // body의 pointer-events 강제 복원
          document.body.style.pointerEvents = "";
          document.body.style.overflow = "";

          // overlay div들 제거
          document.querySelectorAll(".fixed.inset-0").forEach((overlay) => {
            if (overlay.classList.contains("bg-black")) {
              overlay.remove();
            }
          });
        }, 300);
      }
    },
    [setIsSaving, state],
  );

  const { icon, labelOk, labelCancel, message } = params;

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        className={cssNames("ConfirmDialog", className)}
        {...(isOpen ? { "data-testid": "confirmation-dialog" } : {})}
      >
        <button
          type="button"
          onClick={() => handleOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          disabled={isSaving}
        >
          <XIcon className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        <AlertDialogHeader className="flex-row items-center gap-2">
          {icon}
          <AlertDialogTitle>{message}</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={isSaving}>
            {labelCancel}
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleOk} disabled={isSaving} data-testid="confirm">
            {isSaving ? "Loading..." : labelOk}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});

export const ConfirmDialog = withInjectables<Dependencies, ConfirmDialogProps>(NonInjectedConfirmDialog, {
  getProps: (di, props) => ({
    ...props,
    state: di.inject(confirmDialogStateInjectable),
  }),
});
