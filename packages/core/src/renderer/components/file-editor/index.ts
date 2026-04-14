/**
 * 🎯 목적: FileEditor 모듈 barrel export
 * 📝 기능:
 *   - FileEditorTab 컴포넌트 export
 *   - FileEditorToolbar 컴포넌트 export
 *   - 타입 export
 * 🔄 변경이력:
 *   - 2026-01-24: 초기 구현
 *   - 2026-01-25: FIX-030 - FileEditorTab injectable 버전으로 변경
 * @module file-editor/index
 */

// Components (FIX-030: DI injectable 버전 사용)
export { FileEditorTab } from "./file-editor-tab.injectable";
export { FileEditorToolbar } from "./file-editor-toolbar";
export { MultiFileSaveConfirmDialog, SaveConfirmDialog } from "./save-confirm-dialog";

export type { FileEditorTabProps } from "./file-editor-tab";
export type { FileEditorToolbarProps, MarkdownViewMode } from "./file-editor-toolbar";
export type { MultiFileSaveConfirmDialogProps, SaveConfirmDialogProps, SaveConfirmResult } from "./save-confirm-dialog";
