/**
 * 🎯 목적: 파일 저장 확인 다이얼로그
 * 📝 기능:
 *   - Save/Don't Save/Cancel 선택
 *   - 여러 파일 동시 닫기 시 순차 처리
 * 🔄 변경이력:
 *   - 2026-01-24: 초기 구현
 * @module file-editor/save-confirm-dialog
 */

import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../shadcn-ui/alert-dialog";
import { Button } from "../shadcn-ui/button";

/**
 * 저장 확인 결과
 */
export type SaveConfirmResult = "save" | "discard" | "cancel";

/**
 * SaveConfirmDialog Props
 */
export interface SaveConfirmDialogProps {
  /** 다이얼로그 열림 상태 */
  open: boolean;
  /** 파일명 */
  fileName: string;
  /** 파일 경로 */
  filePath?: string;
  /** 결과 콜백 */
  onResult: (result: SaveConfirmResult) => void;
}

/**
 * 파일 저장 확인 다이얼로그
 */
export function SaveConfirmDialog({ open, fileName, filePath, onResult }: SaveConfirmDialogProps) {
  const saveButtonRef = React.useRef<HTMLButtonElement>(null);

  return (
    <AlertDialog open={open}>
      <AlertDialogContent
        onOpenAutoFocus={(event) => {
          // Radix는 기본적으로 Cancel 버튼에 포커스 → Save 버튼으로 리다이렉트
          event.preventDefault();
          saveButtonRef.current?.focus();
        }}
        onKeyDown={(event) => {
          // Electron + Radix 환경에서 버튼의 네이티브 Enter→click이 동작하지 않는 문제 우회
          // Enter 키를 명시적으로 처리하여 Save 실행
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            onResult("save");
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Save changes?</AlertDialogTitle>
          <AlertDialogDescription>
            Do you want to save the changes you made to <span className="font-semibold">{fileName}</span>?
            {filePath && <span className="block mt-1 text-xs text-muted-foreground truncate">{filePath}</span>}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel onClick={() => onResult("cancel")}>Cancel</AlertDialogCancel>
          <Button variant="outline" onClick={() => onResult("discard")}>
            Don&apos;t Save
          </Button>
          <AlertDialogAction ref={saveButtonRef} onClick={() => onResult("save")}>
            Save
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * 여러 파일 저장 확인 다이얼로그 Props
 */
export interface MultiFileSaveConfirmDialogProps {
  /** 다이얼로그 열림 상태 */
  open: boolean;
  /** dirty 파일 목록 */
  files: Array<{
    tabId: string;
    fileName: string;
    filePath: string;
  }>;
  /** 결과 콜백 */
  onResult: (result: "saveAll" | "discardAll" | "cancel") => void;
}

/**
 * 여러 파일 저장 확인 다이얼로그
 */
export function MultiFileSaveConfirmDialog({ open, files, onResult }: MultiFileSaveConfirmDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Save changes?</AlertDialogTitle>
          <AlertDialogDescription>
            You have {files.length} unsaved file{files.length > 1 ? "s" : ""}:
            <ul className="mt-2 max-h-32 overflow-y-auto">
              {files.map((file) => (
                <li key={file.tabId} className="text-sm truncate">
                  • {file.fileName}
                </li>
              ))}
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel onClick={() => onResult("cancel")}>Cancel</AlertDialogCancel>
          <Button variant="outline" onClick={() => onResult("discardAll")}>
            Don&apos;t Save
          </Button>
          <AlertDialogAction onClick={() => onResult("saveAll")}>Save All</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
