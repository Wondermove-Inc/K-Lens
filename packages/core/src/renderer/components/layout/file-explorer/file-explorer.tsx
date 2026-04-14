/**
 * 🎯 Purpose: File Explorer main component
 * 📝 Features:
 *   - Open/close folder buttons
 *   - Refresh button
 *   - Hidden files toggle
 *   - Tree rendering with FileTreeNode
 *   - Loading/empty state display
 * 🔄 Change History:
 *   - 2026-01-24: Initial implementation
 *   - 2026-01-25: FIX-031 - Notification integration (injectable pattern)
 *   - 2026-01-25: FIX-032 - English UI, Notification Panel integration
 * @module file-explorer/file-explorer
 */

import { webUtils } from "electron";
import {
  CheckCircle,
  Clipboard,
  Copy,
  CopyPlus,
  ExternalLink,
  Eye,
  EyeOff,
  FilePlus,
  FileText,
  FolderOpen,
  FolderPlus,
  FolderRoot,
  FolderX,
  GitCompare,
  Info,
  Loader2,
  Pencil,
  Play,
  RefreshCw,
  Rocket,
  Scissors,
  Terminal,
  Trash2,
  XCircle,
} from "lucide-react";
import { observer } from "mobx-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { isYamlFile } from "../../../../common/ipc/filesystem";
import { cn } from "../../../lib/utils";
import { Button } from "../../shadcn-ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../shadcn-ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../shadcn-ui/tooltip";
import { notificationPanelStore } from "../../status-bar/items/notification-panel.store";
import { FileTreeNode } from "./file-tree-node";

import type { KubectlApplyFile } from "../../../kubectl/apply-file.injectable";
import type { KubectlDeleteFile } from "../../../kubectl/delete-file.injectable";
import type { KubectlDiffFile } from "../../../kubectl/diff-file.injectable";
import type { FileEntry, FileExplorerProps } from "./file-explorer.types";
import type { FileExplorerStore } from "./file-explorer-store";

/** 🆕/macOS 플랫폼 감지 (DnD 동작 분기) */
const isMacOS = process.platform === "darwin";

/**
 * 🆕 FIX-036: Parse kubectl diff output to readable summary
 * @param diffOutput - Raw diff output from kubectl diff
 * @returns Human-readable summary of changes
 */
function parseDiffSummary(diffOutput: string): string {
  const lines = diffOutput.split("\n");
  let additions = 0;
  let deletions = 0;
  let modifiedFields: string[] = [];

  for (const line of lines) {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      additions++;
      // Extract field name from YAML lines like "+  replicas: 3"
      const match = line.match(/^\+\s*(\w+):/);
      if (match && !modifiedFields.includes(match[1])) {
        modifiedFields.push(match[1]);
      }
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      deletions++;
      // Extract field name from YAML lines like "-  replicas: 2"
      const match = line.match(/^-\s*(\w+):/);
      if (match && !modifiedFields.includes(match[1])) {
        modifiedFields.push(match[1]);
      }
    }
  }

  // Build summary message
  const parts: string[] = [];
  if (additions > 0) parts.push(`+${additions} lines`);
  if (deletions > 0) parts.push(`-${deletions} lines`);

  let summary = `Changes: ${parts.join(", ")}`;

  if (modifiedFields.length > 0) {
    const fieldsDisplay = modifiedFields.slice(0, 5).join(", ");
    const moreFields = modifiedFields.length > 5 ? ` (+${modifiedFields.length - 5} more)` : "";
    summary += `\nModified: ${fieldsDisplay}${moreFields}`;
  }

  summary += "\n\nClick to view full diff";

  return summary;
}

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../shadcn-ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../shadcn-ui/dialog";
import { DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "../../shadcn-ui/dropdown-menu";

/**
 * FileExplorer Internal Props (with DI dependencies)
 * 📝 Extends FileExplorerProps to include clusterId, onOpenTerminal etc.
 * 📝 FIX-030: Added kubectl apply/delete/diff injectable
 * 📝 FIX-032: Removed Notification injectable, using notificationPanelStore directly
 */
interface FileExplorerInternalProps extends FileExplorerProps {
  store: FileExplorerStore;
  onOpenFolderDialog: () => void;
  kubectlApplyFile: KubectlApplyFile;
  kubectlDeleteFile: KubectlDeleteFile;
  kubectlDiffFile: KubectlDiffFile;
}

/**
 * 🆕 FIX-027: 루트 레벨 인라인 생성 입력 컴포넌트
 * 📝 빈 공간에서 New File/New Folder 시 루트 레벨에 표시
 */
interface InlineRootCreateInputProps {
  type: "file" | "folder";
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

const InlineRootCreateInput = ({ type, onConfirm, onCancel }: InlineRootCreateInputProps) => {
  const [value, setValue] = React.useState(type === "file" ? "untitled.txt" : "New Folder");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (value.trim()) {
        onConfirm(value.trim());
      } else {
        onCancel();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => {
    if (value.trim()) {
      onConfirm(value.trim());
    } else {
      onCancel();
    }
  };

  return (
    <div className="flex items-center gap-1.5 w-full px-2 py-0.5" style={{ paddingLeft: "4px" }}>
      <span className="w-4 shrink-0" />
      {/* 🎯 THEME-024: Semantic color for folder/file creation icons */}
      {type === "folder" ? (
        <FolderPlus className="h-4 w-4 text-status-warning shrink-0" />
      ) : (
        <FilePlus className="h-4 w-4 text-status-info shrink-0" />
      )}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className={cn(
          "flex-1 min-w-0 px-1 py-0 text-sm bg-background border border-primary rounded-sm",
          "focus:outline-none focus:ring-1 focus:ring-primary",
        )}
        data-testid={`inline-root-create-input-${type}`}
      />
    </div>
  );
};

/**
 * 🆕 파일 탐색기 키보드 단축키 훅
 * Ctrl/Cmd+C (복사), Ctrl/Cmd+X (잘라내기), Delete/Backspace (삭제), F2 (이름변경)
 * 📝 Ctrl+V는 Electron paste handler 충돌으로 별도 paste 이벤트 리스너로 처리
 */
const useFileExplorerKeyboard = (
  store: FileExplorerStore,
  options: {
    onDeleteRequest: (entry: FileEntry) => void;
  },
) => {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // 인라인 리네임/생성 중이면 무시 (입력 필드에서 처리)
      if (store.renamingPath || store.inlineCreateParentPath) return;

      const isMod = e.metaKey || e.ctrlKey;
      const selected = store.selectedPath;

      // Ctrl/Cmd+C → 복사
      if (isMod && e.key === "c") {
        if (!selected) return;
        e.preventDefault();
        store.copyToClipboard(selected);
        return;
      }

      // Ctrl/Cmd+X → 잘라내기
      if (isMod && e.key === "x") {
        if (!selected) return;
        e.preventDefault();
        store.cutToClipboard(selected);
        return;
      }

      // Delete / Backspace → 삭제 (확인 다이얼로그)
      if (e.key === "Delete" || e.key === "Backspace") {
        if (!selected) return;
        e.preventDefault();
        const entry = store.getEntryByPath(selected);
        if (entry) options.onDeleteRequest(entry);
        return;
      }

      // F2 → 이름 변경
      if (e.key === "F2") {
        if (!selected) return;
        e.preventDefault();
        store.startRename(selected);
        return;
      }
    },
    [store, options],
  );

  return handleKeyDown;
};

/**
 * 🎯 FileExplorer 내부 컴포넌트
 * 📝 파일 탐색기 UI 렌더링
 */
const FileExplorerInternal = observer(function FileExplorerInternal({
  store,
  onOpenFolderDialog,
  onFileDoubleClick,
  onFileSelect,
  className,
  clusterId,
  clusterName,
  onOpenTerminal,
  kubectlApplyFile,
  kubectlDeleteFile,
  kubectlDiffFile,
}: FileExplorerInternalProps) {
  /**
   * 컴포넌트 마운트 시 클러스터 ID 설정
   * 📝 FIX-004: clusterId가 변경될 때 해당 클러스터 상태 로드
   * 📝 FIX-023: clusterId 변경은 store 상태에 영향 없음 (글로벌 상태)
   */
  useEffect(() => {
    store.setClusterId(clusterId ?? null);
  }, [store, clusterId]);

  /**
   * 🆕 FIX-023: 컴포넌트 마운트 시 저장된 경로 복원 (마운트 1회만)
   * 📝 싱글톤 store가 이미 폴더를 열고 있으면 복원하지 않음
   * 📝 빈 dependency array로 마운트 시 1회만 실행
   */
  useEffect(() => {
    store.restoreLastPath();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 파일 선택 핸들러
   */
  const handleSelect = useCallback(
    (entry: FileEntry) => {
      store.selectEntry(entry.path);
      onFileSelect?.(entry);
    },
    [store, onFileSelect],
  );

  /**
   * 파일 더블클릭 핸들러
   */
  const handleDoubleClick = useCallback(
    (entry: FileEntry) => {
      if (!entry.isDirectory) {
        onFileDoubleClick?.(entry);
      }
    },
    [onFileDoubleClick],
  );

  /**
   * 디렉토리 토글 핸들러
   */
  const handleToggle = useCallback(
    (entry: FileEntry) => {
      store.toggleDirectory(entry);
    },
    [store],
  );

  /**
   * 새로고침 핸들러
   */
  const handleRefresh = useCallback(() => {
    store.refresh();
  }, [store]);

  /**
   * 폴더 닫기 핸들러
   */
  const handleCloseFolder = useCallback(() => {
    store.closeFolder();
  }, [store]);

  /**
   * 숨김 파일 토글 핸들러
   */
  const handleToggleHidden = useCallback(() => {
    store.toggleHiddenFiles();
  }, [store]);

  /**
   * 컨텍스트 메뉴 상태
   */
  const [contextMenuEntry, setContextMenuEntry] = useState<FileEntry | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  /** 빈 공간 컨텍스트 메뉴 여부 */
  const [isEmptySpaceMenu, setIsEmptySpaceMenu] = useState(false);

  /**
   * 🆕 FIX-027: VSCode 스타일 인라인 생성으로 변경
   * 📝 모달 Dialog 대신 트리 내 인라인 입력 사용
   * 📝 store.inlineCreateParentPath, store.inlineCreateType 참조
   */

  /**
   * 컨텍스트 메뉴 핸들러 (파일/폴더)
   */
  const handleContextMenu = useCallback((entry: FileEntry, event: React.MouseEvent) => {
    setContextMenuEntry(entry);
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    setContextMenuOpen(true);
    setIsEmptySpaceMenu(false);
  }, []);

  /**
   * 빈 공간 컨텍스트 메뉴 핸들러
   */
  const handleEmptySpaceContextMenu = useCallback(
    (event: React.MouseEvent) => {
      // 폴더가 열려있지 않으면 메뉴 표시하지 않음
      if (!store.hasOpenFolder) return;

      event.preventDefault();
      event.stopPropagation();
      setContextMenuEntry(null);
      setContextMenuPosition({ x: event.clientX, y: event.clientY });
      setContextMenuOpen(true);
      setIsEmptySpaceMenu(true);
    },
    [store.hasOpenFolder],
  );

  /**
   * 컨텍스트 메뉴 "Open" 클릭
   */
  const handleContextMenuOpen = useCallback(() => {
    if (contextMenuEntry && !contextMenuEntry.isDirectory) {
      onFileDoubleClick?.(contextMenuEntry);
    }
    setContextMenuOpen(false);
  }, [contextMenuEntry, onFileDoubleClick]);

  /**
   * 컨텍스트 메뉴 "Copy Path" 클릭
   */
  const handleCopyPath = useCallback(() => {
    if (contextMenuEntry) {
      navigator.clipboard.writeText(contextMenuEntry.path);
    }
    setContextMenuOpen(false);
  }, [contextMenuEntry]);

  /**
   * 컨텍스트 메뉴 "New File" 클릭
   * 📝 빈 공간 클릭 시에는 rootPath 사용
   * 📝 FIX-027: VSCode 스타일 인라인 생성으로 변경
   */
  const handleNewFile = useCallback(async () => {
    // 현재 상태 캡처 (메뉴 닫힌 후에도 사용)
    const entry = contextMenuEntry;
    const isEmptySpace = isEmptySpaceMenu;
    const rootPath = store.rootPath;

    // parentPath 계산
    let parentPath: string | null = null;
    if (entry) {
      parentPath = entry.isDirectory ? entry.path : entry.path.substring(0, entry.path.lastIndexOf("/"));
    } else if (isEmptySpace && rootPath) {
      parentPath = rootPath;
    }

    if (!parentPath) return;

    // 🆕 FIX-027: 폴더가 펼쳐져 있지 않으면 먼저 펼치기
    if (entry?.isDirectory && !store.expandedPaths.has(entry.path)) {
      await store.toggleDirectory(entry);
    }

    // 🆕 FIX-027: 인라인 생성 모드 시작
    store.startInlineCreate(parentPath, "file");
  }, [contextMenuEntry, isEmptySpaceMenu, store]);

  /**
   * 컨텍스트 메뉴 "New Folder" 클릭
   * 📝 빈 공간 클릭 시에는 rootPath 사용
   * 📝 FIX-027: VSCode 스타일 인라인 생성으로 변경
   */
  const handleNewFolder = useCallback(async () => {
    // 현재 상태 캡처 (메뉴 닫힌 후에도 사용)
    const entry = contextMenuEntry;
    const isEmptySpace = isEmptySpaceMenu;
    const rootPath = store.rootPath;

    // parentPath 계산
    let parentPath: string | null = null;
    if (entry) {
      parentPath = entry.isDirectory ? entry.path : entry.path.substring(0, entry.path.lastIndexOf("/"));
    } else if (isEmptySpace && rootPath) {
      parentPath = rootPath;
    }

    if (!parentPath) return;

    // 🆕 FIX-027: 폴더가 펼쳐져 있지 않으면 먼저 펼치기
    if (entry?.isDirectory && !store.expandedPaths.has(entry.path)) {
      await store.toggleDirectory(entry);
    }

    // 🆕 FIX-027: 인라인 생성 모드 시작
    store.startInlineCreate(parentPath, "folder");
  }, [contextMenuEntry, isEmptySpaceMenu, store]);

  /**
   * 🆕 FIX-027: 인라인 생성 확인 핸들러
   */
  const handleInlineCreateConfirm = useCallback(
    (name: string) => {
      store.confirmInlineCreate(name);
    },
    [store],
  );

  /**
   * 🆕 FIX-027: 인라인 생성 취소 핸들러
   */
  const handleInlineCreateCancel = useCallback(() => {
    store.cancelInlineCreate();
  }, [store]);

  // ========== 🆕 드래그 앤 드롭 핸들러 ==========

  /**
   * 외부 드롭 후 stale state 정리
   * 파일이 OS에 드롭되면 앱에 drop 이벤트 없음 → dragSourcePath 잔존
   * 다음 mousedown 시 정리 (mousedown은 드래그 중 발생하지 않으므로 안전)
   * 📝 focus 이벤트는 사용하지 않음 — OS 네이티브 드래그가 윈도우 위를 지날 때
   *    focus가 발생하여 dragSourcePath를 조기 제거하는 버그 방지
   */
  useEffect(() => {
    const cleanupDragState = () => {
      if (store.dragSourcePath) {
        store.clearDragState();
      }
    };
    document.addEventListener("mousedown", cleanupDragState);
    return () => {
      document.removeEventListener("mousedown", cleanupDragState);
    };
  }, [store]);

  /** 내부 이동 덮어쓰기 확인 다이얼로그 상태 */
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [overwriteSource, setOverwriteSource] = useState<string | null>(null);
  const [overwriteTarget, setOverwriteTarget] = useState<string | null>(null);

  /** 외부 복사 충돌 다이얼로그 상태 */
  const [showCopyConflict, setShowCopyConflict] = useState(false);
  const [copyConflictFiles, setCopyConflictFiles] = useState<string[]>([]);
  const [copyConflictTarget, setCopyConflictTarget] = useState<string | null>(null);
  const [copyConflictNames, setCopyConflictNames] = useState<string[]>([]);

  /** 🆕 클립보드 붙여넣기 충돌 다이얼로그 상태 */
  const [showPasteConflict, setShowPasteConflict] = useState(false);
  const [pasteConflictTarget, setPasteConflictTarget] = useState<string | null>(null);
  const [pasteConflictName, setPasteConflictName] = useState<string | null>(null);

  /**
   * 드래그 시작 핸들러
   * 📝 플랫폼별 분기:
   *    - macOS: e.preventDefault() + 네이티브 OS 드래그 (startDrag가 non-blocking, .textClipping 방지)
   *    - Windows/Linux: 순수 HTML5 DnD + 커스텀 MIME (startDrag가 blocking → 내부 DnD 차단)
   */
  const handleDragStart = useCallback(
    (entry: FileEntry, e: React.DragEvent) => {
      store.setDragSource(entry.path);

      if (isMacOS) {
        // macOS: 네이티브 드래그 (startDrag가 non-blocking이므로 안전, .textClipping 방지)
        e.preventDefault();
        store.startNativeDrag(entry.path);
      } else {
        // Windows/Linux: HTML5 DnD 유지
        // Windows: OLE DnD가 블록킹 → HTML5 drop 차단
        // Linux: GTK DnD가 블록킹 → HTML5 drop 차단
        e.dataTransfer.setData("application/x-skuberplus-path", entry.path);
        e.dataTransfer.effectAllowed = "copyMove";
        // DownloadURL: Chrome/Electron이 앱 밖으로 드래그 시 OS에 파일 전달 (VS Code 동일 패턴)
        // 📝 폴더는 DownloadURL 미지원 (VS Code도 동일 한계)
        if (!entry.isDirectory) {
          const fileName = entry.path.split("/").pop() || "";
          e.dataTransfer.setData(
            "DownloadURL",
            `application/octet-stream:${fileName}:file:///${entry.path.replace(/^\//, "")}`,
          );
        }
      }
    },
    [store],
  );

  /**
   * 드래그 오버 핸들러
   */
  const handleDragOver = useCallback(
    (entry: FileEntry, e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // 외부 파일 드래그 감지
      // Windows HTML5 DnD: 커스텀 MIME 타입으로도 내부 드래그 식별
      const hasInternalData = e.dataTransfer.types.includes("application/x-skuberplus-path");
      if (e.dataTransfer.types.includes("Files") && !store.dragSourcePath && !hasInternalData) {
        store.setExternalDrag(true);
        e.dataTransfer.dropEffect = "copy";
      } else {
        e.dataTransfer.dropEffect = "move";
      }

      // 대상 경로 설정 (폴더이면 해당 폴더, 파일이면 부모 폴더)
      const targetPath = entry.isDirectory ? entry.path : entry.path.substring(0, entry.path.lastIndexOf("/"));
      store.setDragOver(targetPath);
    },
    [store],
  );

  /**
   * 드래그 리브 핸들러
   */
  const handleDragLeave = useCallback(
    (_entry: FileEntry, e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // relatedTarget이 현재 요소의 자식이면 무시 (자식 요소 간 이동)
      const currentTarget = e.currentTarget as HTMLElement;
      const relatedTarget = e.relatedTarget as HTMLElement | null;
      if (relatedTarget && currentTarget.contains(relatedTarget)) {
        return;
      }
      store.setDragOver(null);
    },
    [store],
  );

  /**
   * 드롭 핸들러
   * 📝 파일 경로 매칭으로 내부/외부 드래그를 판별 (stale state 면역)
   *    - OS 네이티브 드래그로 인해 항상 e.dataTransfer.files가 존재할 수 있음
   *    - dragSourcePath만으로 판별 시 stale state에 취약
   */
  const handleDrop = useCallback(
    async (entry: FileEntry, e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // 드롭 대상 디렉토리 결정
      const targetDir = entry.isDirectory ? entry.path : entry.path.substring(0, entry.path.lastIndexOf("/"));

      // 🆕 Windows HTML5 DnD 내부 드래그 우선 처리
      const html5Path = e.dataTransfer.getData("application/x-skuberplus-path");
      if (html5Path && store.dragSourcePath) {
        const result = await store.moveEntry(store.dragSourcePath, targetDir);
        if (result === "dest_exists") {
          setOverwriteSource(store.dragSourcePath);
          setOverwriteTarget(targetDir);
          setShowOverwriteConfirm(true);
        } else if (result === "error") {
          notificationPanelStore.addError(
            "operations",
            "Move Failed",
            "Failed to move file/folder. Check if the operation creates a circular reference.",
          );
        }
        store.clearDragState();
        return;
      }

      // 📝 Electron 35+: webUtils.getPathForFile()로 파일 경로 추출
      // 🆕 Windows 경로 정규화 (백슬래시 → 슬래시)
      const filePaths = Array.from(e.dataTransfer.files)
        .map((f) => {
          try {
            const p = webUtils.getPathForFile(f);
            return process.platform === "win32" ? p.replace(/\\/g, "/") : p;
          } catch {
            return "";
          }
        })
        .filter(Boolean);

      // 내부/외부 판별: dragSourcePath가 드롭된 파일에 포함되면 내부 드래그 (macOS 네이티브)
      const isInternalDrag = store.dragSourcePath && filePaths.includes(store.dragSourcePath);

      if (isInternalDrag) {
        // 내부→내부: 파일 이동
        const result = await store.moveEntry(store.dragSourcePath!, targetDir);
        if (result === "dest_exists") {
          setOverwriteSource(store.dragSourcePath);
          setOverwriteTarget(targetDir);
          setShowOverwriteConfirm(true);
        } else if (result === "error") {
          notificationPanelStore.addError(
            "operations",
            "Move Failed",
            "Failed to move file/folder. Check if the operation creates a circular reference.",
          );
        }
      } else if (filePaths.length > 0) {
        // 외부→내부: 파일 복사 (stale dragSourcePath 정리)
        if (store.dragSourcePath) store.clearDragState();

        // 충돌 확인 후 다이얼로그 또는 직접 복사
        const conflicts = await store.checkCopyConflicts(filePaths, targetDir);
        if (conflicts.length > 0) {
          setCopyConflictFiles(filePaths);
          setCopyConflictTarget(targetDir);
          setCopyConflictNames(conflicts);
          setShowCopyConflict(true);
        } else {
          const success = await store.copyExternalFiles(filePaths, targetDir);
          if (!success) {
            notificationPanelStore.addError("operations", "Copy Failed", "Failed to copy external files.");
          }
        }
      }

      store.clearDragState();
    },
    [store],
  );

  /**
   * 드래그 종료 핸들러
   * 📝 preventDefault()로 HTML5 DnD 취소 시 dragend가 발생하지 않을 수 있음
   *    방어적으로 유지
   */
  const handleDragEnd = useCallback(
    (_e: React.DragEvent) => {
      store.clearDragState();
    },
    [store],
  );

  /**
   * 루트 영역 드래그 오버 핸들러 (빈 공간)
   */
  const handleRootDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!store.rootPath) return;
      e.preventDefault();
      e.stopPropagation();

      // 외부 파일 드래그 감지
      // Windows HTML5 DnD: 커스텀 MIME 타입으로도 내부 드래그 식별
      const hasInternalData = e.dataTransfer.types.includes("application/x-skuberplus-path");
      if (e.dataTransfer.types.includes("Files") && !store.dragSourcePath && !hasInternalData) {
        store.setExternalDrag(true);
        e.dataTransfer.dropEffect = "copy";
      } else {
        e.dataTransfer.dropEffect = "move";
      }

      store.setDragOver(store.rootPath);
    },
    [store],
  );

  /**
   * 루트 영역 드롭 핸들러 (빈 공간)
   * 📝 handleDrop과 동일한 파일 경로 매칭 로직 사용
   */
  const handleRootDrop = useCallback(
    async (e: React.DragEvent) => {
      if (!store.rootPath) return;
      e.preventDefault();
      e.stopPropagation();

      const targetDir = store.rootPath;

      // 🆕 Windows HTML5 DnD 내부 드래그 우선 처리
      const html5Path = e.dataTransfer.getData("application/x-skuberplus-path");
      if (html5Path && store.dragSourcePath) {
        const result = await store.moveEntry(store.dragSourcePath, targetDir);
        if (result === "dest_exists") {
          setOverwriteSource(store.dragSourcePath);
          setOverwriteTarget(targetDir);
          setShowOverwriteConfirm(true);
        } else if (result === "error") {
          notificationPanelStore.addError("operations", "Move Failed", "Failed to move file/folder.");
        }
        store.clearDragState();
        return;
      }

      // 🆕 Windows 경로 정규화 (백슬래시 → 슬래시)
      const filePaths = Array.from(e.dataTransfer.files)
        .map((f) => {
          try {
            const p = webUtils.getPathForFile(f);
            return process.platform === "win32" ? p.replace(/\\/g, "/") : p;
          } catch {
            return "";
          }
        })
        .filter(Boolean);

      // macOS 네이티브 드래그: filePaths로 내부/외부 판별
      const isInternalDrag = store.dragSourcePath && filePaths.includes(store.dragSourcePath);

      if (isInternalDrag) {
        const result = await store.moveEntry(store.dragSourcePath!, targetDir);
        if (result === "dest_exists") {
          setOverwriteSource(store.dragSourcePath);
          setOverwriteTarget(targetDir);
          setShowOverwriteConfirm(true);
        } else if (result === "error") {
          notificationPanelStore.addError("operations", "Move Failed", "Failed to move file/folder.");
        }
      } else if (filePaths.length > 0) {
        if (store.dragSourcePath) store.clearDragState();

        const conflicts = await store.checkCopyConflicts(filePaths, targetDir);
        if (conflicts.length > 0) {
          setCopyConflictFiles(filePaths);
          setCopyConflictTarget(targetDir);
          setCopyConflictNames(conflicts);
          setShowCopyConflict(true);
        } else {
          const success = await store.copyExternalFiles(filePaths, targetDir);
          if (!success) {
            notificationPanelStore.addError("operations", "Copy Failed", "Failed to copy external files.");
          }
        }
      }

      store.clearDragState();
    },
    [store],
  );

  /**
   * 루트 영역 드래그 리브 핸들러
   */
  const handleRootDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const currentTarget = e.currentTarget as HTMLElement;
      const relatedTarget = e.relatedTarget as HTMLElement | null;
      if (relatedTarget && currentTarget.contains(relatedTarget)) {
        return;
      }
      store.setDragOver(null);
      store.setExternalDrag(false);
    },
    [store],
  );

  /**
   * 덮어쓰기 확인 실행
   */
  const executeOverwrite = useCallback(async () => {
    if (!overwriteSource || !overwriteTarget) return;
    const result = await store.moveEntry(overwriteSource, overwriteTarget, true);
    if (result === "error") {
      notificationPanelStore.addError("operations", "Move Failed", "Failed to overwrite existing file.");
    }
    setShowOverwriteConfirm(false);
    setOverwriteSource(null);
    setOverwriteTarget(null);
  }, [overwriteSource, overwriteTarget, store]);

  /**
   * 외부 복사 충돌 — 덮어쓰기 (Replace)
   */
  const handleCopyConflictReplace = useCallback(async () => {
    if (!copyConflictFiles.length || !copyConflictTarget) return;
    const success = await store.copyExternalFiles(copyConflictFiles, copyConflictTarget, true);
    if (!success) {
      notificationPanelStore.addError("operations", "Copy Failed", "Failed to copy external files.");
    }
    setShowCopyConflict(false);
    setCopyConflictFiles([]);
    setCopyConflictTarget(null);
    setCopyConflictNames([]);
  }, [copyConflictFiles, copyConflictTarget, store]);

  /**
   * 외부 복사 충돌 — 둘 다 유지 (Keep Both, 자동 이름변경)
   */
  const handleCopyConflictKeepBoth = useCallback(async () => {
    if (!copyConflictFiles.length || !copyConflictTarget) return;
    const success = await store.copyExternalFiles(copyConflictFiles, copyConflictTarget, false);
    if (!success) {
      notificationPanelStore.addError("operations", "Copy Failed", "Failed to copy external files.");
    }
    setShowCopyConflict(false);
    setCopyConflictFiles([]);
    setCopyConflictTarget(null);
    setCopyConflictNames([]);
  }, [copyConflictFiles, copyConflictTarget, store]);

  /**
   * 🆕 클립보드 붙여넣기 공통 함수 (충돌 확인 포함)
   * 컨텍스트 메뉴, 키보드 단축키, paste 이벤트에서 공통 사용
   * 📝 내부 클립보드 우선, 없으면 OS 클립보드(외부 파일) 시도
   */
  const executePasteWithConflictCheck = useCallback(
    async (targetDir: string) => {
      // OS 클립보드 확인 (내부 없으면 외부 시도)
      const clipSource = await store.pasteFromOS(targetDir);

      if (clipSource.source === "internal") {
        // 기존 내부 paste 로직 (충돌 확인 포함)
        const conflictName = await store.checkPasteConflict(targetDir);
        if (conflictName) {
          setPasteConflictTarget(targetDir);
          setPasteConflictName(conflictName);
          setShowPasteConflict(true);
        } else {
          await store.paste(targetDir);
        }
      } else if (clipSource.source === "external" && clipSource.filePaths) {
        // 외부 파일 붙여넣기 (기존 copyExternalFiles 재활용)
        const conflicts = await store.checkCopyConflicts(clipSource.filePaths, targetDir);
        if (conflicts.length > 0) {
          setCopyConflictFiles(clipSource.filePaths);
          setCopyConflictTarget(targetDir);
          setCopyConflictNames(conflicts);
          setShowCopyConflict(true);
        } else {
          const success = await store.copyExternalFiles(clipSource.filePaths, targetDir);
          if (!success) {
            notificationPanelStore.addError("operations", "Paste Failed", "Failed to paste files from clipboard.");
          } else {
            const fileNames = clipSource.filePaths.map((p) => p.split("/").pop()).join(", ");
            notificationPanelStore.addSuccess("operations", "Paste Complete", `Pasted: ${fileNames}`);
          }
        }
      }
      // source === "none": 클립보드 비어있음 → silent no-op (VS Code/Finder 동일 동작)
    },
    [store],
  );

  /** 🆕 붙여넣기 충돌 — 덮어쓰기 (Replace) */
  const handlePasteConflictReplace = useCallback(async () => {
    if (!pasteConflictTarget) return;
    await store.paste(pasteConflictTarget, true);
    setShowPasteConflict(false);
    setPasteConflictTarget(null);
    setPasteConflictName(null);
  }, [pasteConflictTarget, store]);

  /** 🆕 붙여넣기 충돌 — 둘 다 유지 (Keep Both) */
  const handlePasteConflictKeepBoth = useCallback(async () => {
    if (!pasteConflictTarget) return;
    await store.paste(pasteConflictTarget, false);
    setShowPasteConflict(false);
    setPasteConflictTarget(null);
    setPasteConflictName(null);
  }, [pasteConflictTarget, store]);

  /**
   * 컨텍스트 메뉴 "Rename" 클릭
   * 📝 window.prompt()는 Electron에서 지원되지 않으므로 인라인 리네임 사용
   */
  const handleRename = useCallback(() => {
    if (!contextMenuEntry) return;
    store.startRename(contextMenuEntry.path);
    setContextMenuOpen(false);
  }, [contextMenuEntry, store]);

  /**
   * 인라인 리네임 확인 핸들러
   */
  const handleRenameConfirm = useCallback(
    (path: string, newName: string) => {
      store.confirmRename(newName);
    },
    [store],
  );

  /**
   * 인라인 리네임 취소 핸들러
   */
  const handleRenameCancel = useCallback(() => {
    store.cancelRename();
  }, [store]);

  // ========== FIX-032: Delete confirmation dialog state (moved before executeDelete) ==========
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetEntry, setDeleteTargetEntry] = useState<FileEntry | null>(null);
  const [deleteType, setDeleteType] = useState<"local" | "cluster">("local");

  // ========== 키보드 단축키 ==========
  const containerRef = useRef<HTMLDivElement>(null);
  /** Hidden focus proxy — paste 이벤트 수신을 위한 보이지 않는 contentEditable */
  const focusProxyRef = useRef<HTMLDivElement>(null);

  /** 키보드 Delete/Backspace → 삭제 확인 다이얼로그 표시 */
  const handleDeleteFromKeyboard = useCallback((entry: FileEntry) => {
    setDeleteTargetEntry(entry);
    setDeleteType("local");
    setShowDeleteConfirm(true);
  }, []);

  const handleTreeKeyDown = useFileExplorerKeyboard(store, {
    onDeleteRequest: handleDeleteFromKeyboard,
  });

  /**
   * 🆕 파일 탐색기 클릭 시 hidden focus proxy로 포커스 이동
   * 📝 webContents.paste()는 focused contentEditable 요소에만 paste 이벤트 발생
   *    → 파일 탐색기 영역 클릭 시 hidden proxy에 포커스를 줘서 Cmd+V 대응
   * 📝 onClickCapture (캡처 단계) 사용 — FileTreeNode이 stopPropagation()을
   *    호출하므로 bubble 단계에서는 컨테이너까지 전파되지 않음 (FIX-005)
   *    캡처 단계는 target의 stopPropagation보다 먼저 실행되므로 항상 동작
   * 📝 인라인 리네임/생성의 input에서는 포커스를 뺏지 않음
   */
  const handleContainerClickCapture = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // 입력 필드는 포커스를 뺏지 않음
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
    // 툴바 영역의 버튼/링크만 포커스 프록시 스킵 (파일 트리 내 버튼은 focus proxy 필요)
    if (target.closest("[data-testid='file-explorer-toolbar']") && (target.closest("button") || target.closest("a")))
      return;
    focusProxyRef.current?.focus();
  }, []);

  /**
   * 🆕 Container가 Tab으로 포커스 받으면 proxy로 리다이렉트
   */
  const handleContainerFocus = useCallback((e: React.FocusEvent) => {
    if (e.target === containerRef.current) {
      focusProxyRef.current?.focus();
    }
  }, []);

  /**
   * 🆕 Cmd+V 감지 — Hidden proxy의 paste 이벤트
   *
   * 📝 동작 원리:
   * 1. setup-paste-handler가 before-input-event에서 Cmd+V 가로채기
   * 2. webContents.paste() 호출
   * 3. Hidden proxy가 focused contentEditable → paste 이벤트 발생!
   * 4. e.preventDefault()로 텍스트 삽입 차단 → OS 클립보드에서 파일 붙여넣기
   */
  const handlePasteEvent = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();

      if (store.renamingPath || store.inlineCreateParentPath) return;
      if (!store.hasOpenFolder) return;

      let targetDir: string | null = null;
      const selected = store.selectedPath;
      if (selected) {
        const entry = store.getEntryByPath(selected);
        if (entry?.isDirectory) {
          targetDir = selected;
        } else {
          const slashIdx = selected.lastIndexOf("/");
          targetDir = slashIdx > 0 ? selected.substring(0, slashIdx) : store.rootPath;
        }
      } else if (store.rootPath) {
        targetDir = store.rootPath;
      }
      if (targetDir) executePasteWithConflictCheck(targetDir);
    },
    [store, executePasteWithConflictCheck],
  );

  /**
   * Context menu "Delete" click
   * FIX-032: Changed to Shadcn AlertDialog
   */
  const handleDelete = useCallback(() => {
    if (!contextMenuEntry) return;
    setDeleteTargetEntry(contextMenuEntry);
    setDeleteType("local");
    setShowDeleteConfirm(true);
    setContextMenuOpen(false);
  }, [contextMenuEntry]);

  /**
   * FIX-032: Execute delete after confirmation
   * FIX-038: clusterName을 metadata로 전달 (제목에서 제거)
   */
  const executeDelete = useCallback(async () => {
    if (!deleteTargetEntry) return;

    if (deleteType === "local") {
      await store.delete(deleteTargetEntry.path);
    } else if (deleteType === "cluster" && clusterId) {
      // Delete from cluster is handled separately in handleDeleteFromCluster
      try {
        const response = await kubectlDeleteFile({
          clusterId,
          filePath: deleteTargetEntry.path,
        });
        if (response.success) {
          notificationPanelStore.addSuccess(
            "operations",
            `Delete: ${deleteTargetEntry.name}`,
            response.stdout || "Resource deleted successfully.",
            { clusterName },
          );
        } else {
          notificationPanelStore.addError(
            "operations",
            `Delete Failed: ${deleteTargetEntry.name}`,
            response.stderr || "Unknown error occurred.",
            { clusterName },
          );
        }
      } catch (err) {
        notificationPanelStore.addError(
          "operations",
          `Delete Error: ${deleteTargetEntry.name}`,
          err instanceof Error ? err.message : "Unknown error",
          { clusterName },
        );
      }
    }

    setShowDeleteConfirm(false);
    setDeleteTargetEntry(null);
  }, [deleteTargetEntry, deleteType, store, clusterId, clusterName, kubectlDeleteFile]);

  /**
   * 컨텍스트 메뉴 "Copy" 클릭 (클립보드에 저장)
   */
  const handleCopy = useCallback(() => {
    if (contextMenuEntry) {
      store.copyToClipboard(contextMenuEntry.path);
    }
    setContextMenuOpen(false);
  }, [contextMenuEntry, store]);

  /**
   * 컨텍스트 메뉴 "Cut" 클릭
   */
  const handleCut = useCallback(() => {
    if (contextMenuEntry) {
      store.cutToClipboard(contextMenuEntry.path);
    }
    setContextMenuOpen(false);
  }, [contextMenuEntry, store]);

  /**
   * 컨텍스트 메뉴 "Paste" 클릭
   * 📝 빈 공간 클릭 시에는 rootPath 사용
   * 📝 충돌 확인 후 다이얼로그 표시
   */
  const handlePaste = useCallback(async () => {
    let targetDir: string | null = null;

    if (contextMenuEntry) {
      targetDir = contextMenuEntry.isDirectory
        ? contextMenuEntry.path
        : contextMenuEntry.path.substring(0, contextMenuEntry.path.lastIndexOf("/"));
    } else if (isEmptySpaceMenu && store.rootPath) {
      targetDir = store.rootPath;
    }

    if (!targetDir) return;

    await executePasteWithConflictCheck(targetDir);
    setContextMenuOpen(false);
  }, [contextMenuEntry, isEmptySpaceMenu, executePasteWithConflictCheck]);

  // ========== File info dialog state ==========
  const [fileInfoOpen, setFileInfoOpen] = useState(false);
  const [fileInfo, setFileInfo] = useState<{
    name?: string;
    path?: string;
    isDirectory?: boolean;
    sizeFormatted?: string;
    createdAt?: string;
    modifiedAt?: string;
    permissions?: string;
  } | null>(null);

  // ========== YAML validation result dialog state ==========
  const [yamlValidationOpen, setYamlValidationOpen] = useState(false);
  const [yamlValidationResult, setYamlValidationResult] = useState<{
    isValid: boolean;
    errors: Array<{ type: string; message: string; line?: number; path?: string }>;
    resourceKind?: string;
    apiVersion?: string;
  } | null>(null);

  // ========== Operation progress state (FIX-028: simplified with sonner toast) ==========

  /**
   * 컨텍스트 메뉴 "Duplicate" 클릭
   */
  const handleDuplicate = useCallback(async () => {
    if (!contextMenuEntry) return;
    setContextMenuOpen(false);
    await store.duplicate(contextMenuEntry.path);
  }, [contextMenuEntry, store]);

  /**
   * 컨텍스트 메뉴 "Set as Root" 클릭
   */
  const handleSetAsRoot = useCallback(async () => {
    if (!contextMenuEntry || !contextMenuEntry.isDirectory) return;
    setContextMenuOpen(false);
    await store.setAsRoot(contextMenuEntry.path);
  }, [contextMenuEntry, store]);

  /**
   * 컨텍스트 메뉴 "File Info" 클릭
   */
  const handleFileInfo = useCallback(async () => {
    if (!contextMenuEntry) return;
    setContextMenuOpen(false);
    const info = await store.getFileInfo(contextMenuEntry.path);
    if (info.success) {
      setFileInfo(info);
      setFileInfoOpen(true);
    }
  }, [contextMenuEntry, store]);

  /**
   * 컨텍스트 메뉴 "Reveal in File Explorer" 클릭
   */
  const handleRevealInExplorer = useCallback(async () => {
    if (!contextMenuEntry) return;
    setContextMenuOpen(false);
    await store.revealInExplorer(contextMenuEntry.path);
  }, [contextMenuEntry, store]);

  /**
   * 컨텍스트 메뉴 "Open in Terminal" 클릭
   */
  const handleOpenInTerminal = useCallback(() => {
    if (!contextMenuEntry) return;
    setContextMenuOpen(false);
    const targetPath = contextMenuEntry.isDirectory
      ? contextMenuEntry.path
      : contextMenuEntry.path.substring(0, contextMenuEntry.path.lastIndexOf("/"));
    onOpenTerminal?.(targetPath);
  }, [contextMenuEntry, onOpenTerminal]);

  /**
   * 컨텍스트 메뉴 "Validate YAML" 클릭
   */
  const handleValidateYaml = useCallback(async () => {
    if (!contextMenuEntry) return;
    setContextMenuOpen(false);
    const result = await store.validateYaml(contextMenuEntry.path);
    if (result.success) {
      setYamlValidationResult(result);
      setYamlValidationOpen(true);
    }
  }, [contextMenuEntry, store]);

  /**
   * Context menu "Deploy to Cluster" click
   * 📝 FIX-030: Uses kubectlApplyFile injectable
   * 📝 FIX-032: Uses notificationPanelStore instead of toast
   * 📝 FIX-038: clusterName을 metadata로 전달 (제목에서 제거)
   */
  const handleDeployToCluster = useCallback(async () => {
    if (!contextMenuEntry || !clusterId) {
      notificationPanelStore.addError(
        "operations",
        "Deploy Failed",
        "No cluster selected. Please select a cluster first.",
      );
      return;
    }
    setContextMenuOpen(false);

    try {
      const response = await kubectlApplyFile({
        clusterId,
        filePath: contextMenuEntry.path,
        dryRun: false,
      });
      if (response.success) {
        notificationPanelStore.addSuccess(
          "operations",
          `Deploy: ${contextMenuEntry.name}`,
          response.stdout || "Resource applied successfully.",
          { clusterName },
        );
      } else {
        notificationPanelStore.addError(
          "operations",
          `Deploy Failed: ${contextMenuEntry.name}`,
          response.stderr || "Unknown error occurred.",
          { clusterName },
        );
      }
    } catch (err) {
      notificationPanelStore.addError(
        "operations",
        `Deploy Error: ${contextMenuEntry.name}`,
        err instanceof Error ? err.message : "Unknown error",
        { clusterName },
      );
    }
  }, [contextMenuEntry, clusterId, clusterName, kubectlApplyFile]);

  /**
   * Context menu "Dry Run" click
   * 📝 FIX-030: Uses kubectlApplyFile injectable (dryRun: true)
   * 📝 FIX-032: Uses notificationPanelStore instead of toast
   * 📝 FIX-038: clusterName을 metadata로 전달 (제목에서 제거)
   */
  const handleDryRun = useCallback(async () => {
    if (!contextMenuEntry || !clusterId) {
      notificationPanelStore.addError(
        "operations",
        "Dry Run Failed",
        "No cluster selected. Please select a cluster first.",
      );
      return;
    }
    setContextMenuOpen(false);

    try {
      const response = await kubectlApplyFile({
        clusterId,
        filePath: contextMenuEntry.path,
        dryRun: true,
      });
      if (response.success) {
        notificationPanelStore.addSuccess(
          "operations",
          `Dry Run: ${contextMenuEntry.name}`,
          response.stdout || "Validation completed successfully.",
          { clusterName },
        );
      } else {
        notificationPanelStore.addError(
          "operations",
          `Dry Run Failed: ${contextMenuEntry.name}`,
          response.stderr || "Unknown error occurred.",
          { clusterName },
        );
      }
    } catch (err) {
      notificationPanelStore.addError(
        "operations",
        `Dry Run Error: ${contextMenuEntry.name}`,
        err instanceof Error ? err.message : "Unknown error",
        { clusterName },
      );
    }
  }, [contextMenuEntry, clusterId, clusterName, kubectlApplyFile]);

  /**
   * Context menu "Delete from Cluster" click
   * 📝 Runs kubectl delete -f
   * 📝 FIX-030: Uses kubectlDeleteFile injectable
   * 📝 FIX-032: Uses AlertDialog instead of window.confirm
   */
  const handleDeleteFromCluster = useCallback(() => {
    if (!contextMenuEntry || !clusterId) {
      notificationPanelStore.addError(
        "operations",
        "Delete Failed",
        "No cluster selected. Please select a cluster first.",
      );
      return;
    }
    setDeleteTargetEntry(contextMenuEntry);
    setDeleteType("cluster");
    setShowDeleteConfirm(true);
    setContextMenuOpen(false);
  }, [contextMenuEntry, clusterId]);

  /**
   * Context menu "Compare with Cluster" click
   * 📝 Compares local YAML with cluster state (kubectl diff)
   * 📝 FIX-030: Uses kubectlDiffFile injectable
   * 📝 FIX-032: Uses notificationPanelStore instead of toast
   * 📝 FIX-038: clusterName을 metadata로 전달 (제목에서 제거)
   */
  const handleCompareWithCluster = useCallback(async () => {
    if (!contextMenuEntry || !clusterId) {
      notificationPanelStore.addError(
        "operations",
        "Compare Failed",
        "No cluster selected. Please select a cluster first.",
      );
      return;
    }
    setContextMenuOpen(false);

    try {
      const response = await kubectlDiffFile({
        clusterId,
        filePath: contextMenuEntry.path,
      });
      if (response.success) {
        if (response.exitCode === 0) {
          notificationPanelStore.addSuccess(
            "operations",
            `Compare: ${contextMenuEntry.name}`,
            "No differences found. Resource matches cluster state.",
            {
              clusterName,
              actionType: "diff",
              filePath: contextMenuEntry.path,
            },
          );
        } else {
          // exit code 1 = differences found
          // FIX-036: Parse diff for readable summary + store full diff in metadata
          const diffSummary = parseDiffSummary(response.stdout);
          notificationPanelStore.addInfo("operations", `Compare: ${contextMenuEntry.name}`, diffSummary, {
            clusterName,
            actionType: "diff",
            filePath: contextMenuEntry.path,
            diffContent: response.stdout,
          });
        }
      } else {
        notificationPanelStore.addError(
          "operations",
          `Compare Failed: ${contextMenuEntry.name}`,
          response.stderr || "Unknown error occurred.",
          {
            clusterName,
            actionType: "diff",
            filePath: contextMenuEntry.path,
          },
        );
      }
    } catch (err) {
      notificationPanelStore.addError(
        "operations",
        `Compare Error: ${contextMenuEntry.name}`,
        err instanceof Error ? err.message : "Unknown error",
        {
          clusterName,
          actionType: "diff",
          filePath: contextMenuEntry.path,
        },
      );
    }
  }, [contextMenuEntry, clusterId, clusterName, kubectlDiffFile]);

  /**
   * 빈 상태 렌더링
   */
  const renderEmptyState = () => (
    <div
      className="flex flex-col items-center justify-center h-full gap-3 p-4 text-muted-foreground"
      data-testid="file-explorer-empty"
    >
      <FolderOpen className="h-10 w-10 opacity-50" />
      <p className="text-sm text-center">No folder opened</p>
      <Button variant="outline" size="sm" onClick={onOpenFolderDialog} data-testid="open-folder-button">
        <FolderOpen className="h-4 w-4 mr-2" />
        Open Folder
      </Button>
    </div>
  );

  /**
   * 로딩 상태 렌더링
   */
  const renderLoading = () => (
    <div className="flex items-center justify-center h-full p-4" data-testid="file-explorer-loading">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  /**
   * 에러 상태 렌더링
   */
  const renderError = () => (
    <div
      className="flex flex-col items-center justify-center h-full gap-2 p-4 text-destructive"
      data-testid="file-explorer-error"
    >
      <p className="text-sm text-center">{store.error}</p>
      <Button variant="outline" size="sm" onClick={handleRefresh}>
        Retry
      </Button>
    </div>
  );

  /**
   * 툴바 렌더링
   */
  const renderToolbar = () => (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-border/50" data-testid="file-explorer-toolbar">
      {/* 폴더 열기 버튼 */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onOpenFolderDialog}
            data-testid="toolbar-open-folder"
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Open Folder</TooltipContent>
      </Tooltip>

      {/* 새로고침 버튼 */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleRefresh}
            disabled={!store.hasOpenFolder || store.isLoading}
            data-testid="toolbar-refresh"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", store.isLoading && "animate-spin")} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Refresh</TooltipContent>
      </Tooltip>

      {/* 숨김 파일 토글 */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleToggleHidden}
            disabled={!store.hasOpenFolder}
            data-testid="toolbar-toggle-hidden"
          >
            {store.showHiddenFiles ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {store.showHiddenFiles ? "Hide Hidden Files" : "Show Hidden Files"}
        </TooltipContent>
      </Tooltip>

      {/* 스페이서 */}
      <div className="flex-1" />

      {/* 폴더 닫기 버튼 */}
      {store.hasOpenFolder && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCloseFolder}
              data-testid="toolbar-close-folder"
            >
              <FolderX className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Close Folder</TooltipContent>
        </Tooltip>
      )}
    </div>
  );

  /**
   * 파일 트리 렌더링
   * 📝 FIX-005: 빈 공간 핸들러는 부모 컨테이너(line 951)에서 처리
   *    FileTreeNode가 stopPropagation()을 호출하므로 파일/폴더 클릭은
   *    부모까지 전파되지 않음. 빈 공간 클릭만 부모에서 처리됨.
   * 📝 FIX-015: treeVersion 참조하여 MobX observer가 변경 추적하도록 함
   * 📝 FIX-027: 인라인 생성 props 전달
   */
  /**
   * 📝 FIX-016: expandedPaths, loadingPaths를 FileTreeNode에 전달
   *    이 Observable Set들을 직접 참조하여 MobX가 변경을 추적하게 함
   */
  const renderTree = () => {
    // 🆕 FIX-027: 루트 레벨 인라인 생성 여부 확인
    const showRootInlineCreate = store.inlineCreateParentPath === store.rootPath && store.inlineCreateType !== null;

    return (
      <div className="py-1" data-testid="file-explorer-tree" data-tree-version={store.treeVersion}>
        {/* 🆕 FIX-027: 루트 레벨 인라인 생성 입력 */}
        {showRootInlineCreate && store.inlineCreateType && (
          <InlineRootCreateInput
            type={store.inlineCreateType}
            onConfirm={handleInlineCreateConfirm}
            onCancel={handleInlineCreateCancel}
          />
        )}
        {store.rootEntries.map((entry) => (
          <FileTreeNode
            key={entry.path}
            entry={entry}
            depth={0}
            selectedPath={store.selectedPath}
            expandedPaths={store.expandedPaths}
            loadingPaths={store.loadingPaths}
            onSelect={handleSelect}
            onDoubleClick={handleDoubleClick}
            onToggle={handleToggle}
            onContextMenu={handleContextMenu}
            inlineCreateParentPath={store.inlineCreateParentPath}
            inlineCreateType={store.inlineCreateType}
            onInlineCreateConfirm={handleInlineCreateConfirm}
            onInlineCreateCancel={handleInlineCreateCancel}
            renamingPath={store.renamingPath}
            onRenameConfirm={handleRenameConfirm}
            onRenameCancel={handleRenameCancel}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            dragSourcePath={store.dragSourcePath}
            dragOverPath={store.dragOverPath}
          />
        ))}
      </div>
    );
  };

  /**
   * YAML 파일 여부 확인
   */
  const isYaml = contextMenuEntry ? isYamlFile(contextMenuEntry.path) : false;

  /**
   * 컨텍스트 메뉴 렌더링
   * 📝 DropdownMenu를 사용하여 controlled mode 지원
   * 📝 파일/폴더 클릭 또는 빈 공간 클릭에 따라 다른 메뉴 표시
   */
  const renderContextMenu = () => {
    // 컨텍스트 메뉴가 열려있지 않으면 렌더링하지 않음
    if (!contextMenuOpen) return null;

    // 빈 공간 컨텍스트 메뉴 (간소화된 메뉴)
    if (isEmptySpaceMenu) {
      return (
        <div
          style={{
            position: "fixed",
            left: contextMenuPosition.x,
            top: contextMenuPosition.y,
            zIndex: 9999,
          }}
        >
          <DropdownMenu open={contextMenuOpen} onOpenChange={setContextMenuOpen}>
            <DropdownMenuTrigger asChild>
              <div style={{ width: 0, height: 0 }} />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-[180px]">
              {/* 새 파일 - FIX-017: onClick 대신 onSelect 사용 */}
              <DropdownMenuItem onSelect={handleNewFile}>
                <FilePlus className="mr-2 h-4 w-4" />
                New File
              </DropdownMenuItem>
              {/* 새 폴더 */}
              <DropdownMenuItem onSelect={handleNewFolder}>
                <FolderPlus className="mr-2 h-4 w-4" />
                New Folder
              </DropdownMenuItem>

              {/* 붙여넣기 (내부 클립보드 또는 OS 클립보드) - */}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handlePaste}>
                <Clipboard className="mr-2 h-4 w-4" />
                Paste
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* 새로고침 - FIX-017 */}
              <DropdownMenuItem
                onSelect={() => {
                  store.refresh();
                  setContextMenuOpen(false);
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    }

    // 파일/폴더가 선택되지 않은 경우 렌더링하지 않음
    if (!contextMenuEntry) return null;

    return (
      <div
        style={{
          position: "fixed",
          left: contextMenuPosition.x,
          top: contextMenuPosition.y,
          zIndex: 9999,
        }}
      >
        <DropdownMenu open={contextMenuOpen} onOpenChange={setContextMenuOpen}>
          <DropdownMenuTrigger asChild>
            <div style={{ width: 0, height: 0 }} />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-[220px]">
            {/* 파일: Open */}
            {!contextMenuEntry.isDirectory && (
              <DropdownMenuItem onClick={handleContextMenuOpen}>
                <FileText className="mr-2 h-4 w-4" />
                Open
              </DropdownMenuItem>
            )}
            {/* 폴더: Expand/Collapse */}
            {contextMenuEntry.isDirectory && (
              <DropdownMenuItem
                onClick={() => {
                  handleToggle(contextMenuEntry);
                  setContextMenuOpen(false);
                }}
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                {contextMenuEntry.isExpanded ? "Collapse" : "Expand"}
              </DropdownMenuItem>
            )}
            {/* 폴더: Refresh */}
            {contextMenuEntry.isDirectory && (
              <DropdownMenuItem
                onClick={() => {
                  store.refresh();
                  setContextMenuOpen(false);
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </DropdownMenuItem>
            )}

            {/* ========== Kubernetes 작업 (YAML 파일만) ========== */}
            {isYaml && !contextMenuEntry.isDirectory && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Rocket className="mr-2 h-4 w-4" />
                    Kubernetes
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={handleValidateYaml}>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Validate YAML
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDryRun} disabled={!clusterId}>
                      <Play className="mr-2 h-4 w-4" />
                      Dry Run
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDeployToCluster} disabled={!clusterId}>
                      <Rocket className="mr-2 h-4 w-4" />
                      Deploy to Cluster
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleCompareWithCluster} disabled={!clusterId}>
                      <GitCompare className="mr-2 h-4 w-4" />
                      Compare with Cluster
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleDeleteFromCluster}
                      disabled={!clusterId}
                      className="text-destructive focus:text-destructive"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Delete from Cluster
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </>
            )}

            <DropdownMenuSeparator />

            {/* 새 파일/폴더 - FIX-020: onClick 대신 onSelect 사용 */}
            <DropdownMenuItem onSelect={handleNewFile}>
              <FilePlus className="mr-2 h-4 w-4" />
              New File
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleNewFolder}>
              <FolderPlus className="mr-2 h-4 w-4" />
              New Folder
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* 클립보드 작업 */}
            <DropdownMenuItem onClick={handleCut}>
              <Scissors className="mr-2 h-4 w-4" />
              Cut
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopy}>
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handlePaste}>
              <Clipboard className="mr-2 h-4 w-4" />
              Paste
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDuplicate}>
              <CopyPlus className="mr-2 h-4 w-4" />
              Duplicate
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* 이름 변경 */}
            <DropdownMenuItem onClick={handleRename}>
              <Pencil className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>

            {/* 삭제 */}
            <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* 폴더: Set as Root */}
            {contextMenuEntry.isDirectory && (
              <DropdownMenuItem onClick={handleSetAsRoot}>
                <FolderRoot className="mr-2 h-4 w-4" />
                Set as Root
              </DropdownMenuItem>
            )}

            {/* 터미널에서 열기 */}
            {onOpenTerminal && (
              <DropdownMenuItem onClick={handleOpenInTerminal}>
                <Terminal className="mr-2 h-4 w-4" />
                Open in Terminal
              </DropdownMenuItem>
            )}

            {/* 시스템 탐색기에서 열기 */}
            <DropdownMenuItem onClick={handleRevealInExplorer}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Reveal in File Explorer
            </DropdownMenuItem>

            {/* 파일 정보 */}
            <DropdownMenuItem onClick={handleFileInfo}>
              <Info className="mr-2 h-4 w-4" />
              Properties
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* 경로 복사 */}
            <DropdownMenuItem onClick={handleCopyPath}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Path
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={cn("flex flex-col h-full min-h-0 relative", className)}
      data-testid="file-explorer"
      tabIndex={0}
      onClickCapture={handleContainerClickCapture}
      onFocus={handleContainerFocus}
      style={{ outline: "none" }}
    >
      {/* 🆕 Hidden focus proxy — paste 이벤트 수신용 */}
      {/* webContents.paste()는 focused contentEditable에만 paste 이벤트 발생 */}
      {/* 이 요소가 포커스를 받아 Cmd+V 시 paste 이벤트를 캡처 */}
      <div
        ref={focusProxyRef}
        contentEditable="true"
        suppressContentEditableWarning={true}
        onBeforeInput={(e) => e.preventDefault()}
        onPaste={handlePasteEvent}
        onKeyDown={handleTreeKeyDown}
        tabIndex={-1}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          opacity: 0,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: -1,
        }}
        aria-hidden="true"
      />
      {/* 툴바 */}
      {renderToolbar()}

      {/* 콘텐츠 영역 - 빈 공간 우클릭 시 컨텍스트 메뉴 표시 */}
      {/* FIX-003: overflow-hidden → overflow-auto로 변경하여 스크롤 활성화 */}
      {/* 빈 공간 DnD 지원 (루트 디렉토리로 이동/복사) */}
      <div
        className={cn(
          "flex-1 min-h-0 overflow-auto",
          store.dragOverPath === store.rootPath && store.rootPath && "bg-primary/10",
        )}
        onContextMenu={store.hasOpenFolder ? handleEmptySpaceContextMenu : undefined}
        onDragOver={store.hasOpenFolder ? handleRootDragOver : undefined}
        onDragLeave={store.hasOpenFolder ? handleRootDragLeave : undefined}
        onDrop={store.hasOpenFolder ? handleRootDrop : undefined}
      >
        {store.isLoading && !store.hasOpenFolder && renderLoading()}
        {store.error && renderError()}
        {!store.isLoading && !store.error && !store.hasOpenFolder && renderEmptyState()}
        {!store.error && store.hasOpenFolder && renderTree()}
      </div>

      {/* 컨텍스트 메뉴 */}
      {renderContextMenu()}

      {/* 📝 FIX-028: 커스텀 작업 메시지 UI 제거 - sonner toast로 대체 */}

      {/* 파일 정보 다이얼로그 */}
      <Dialog open={fileInfoOpen} onOpenChange={setFileInfoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {/* 🎯 THEME-024: Semantic color for folder/file info icons */}
              {fileInfo?.isDirectory ? (
                <FolderOpen className="h-5 w-5 text-status-warning" />
              ) : (
                <FileText className="h-5 w-5 text-status-info" />
              )}
              {fileInfo?.name}
            </DialogTitle>
            <DialogDescription>File Properties</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 text-sm">
            <div className="grid grid-cols-3 gap-2">
              <span className="text-muted-foreground">Type:</span>
              <span className="col-span-2">{fileInfo?.isDirectory ? "Folder" : "File"}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-muted-foreground">Size:</span>
              <span className="col-span-2">{fileInfo?.sizeFormatted || "N/A"}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-muted-foreground">Path:</span>
              <span className="col-span-2 break-all text-xs">{fileInfo?.path}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-muted-foreground">Created:</span>
              <span className="col-span-2">
                {fileInfo?.createdAt ? new Date(fileInfo.createdAt).toLocaleString() : "N/A"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-muted-foreground">Modified:</span>
              <span className="col-span-2">
                {fileInfo?.modifiedAt ? new Date(fileInfo.modifiedAt).toLocaleString() : "N/A"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="text-muted-foreground">Permissions:</span>
              <span className="col-span-2 font-mono">{fileInfo?.permissions || "N/A"}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* YAML 검증 결과 다이얼로그 */}
      <Dialog open={yamlValidationOpen} onOpenChange={setYamlValidationOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {/* 🎯 THEME-024: Semantic color for validation status */}
              {yamlValidationResult?.isValid ? (
                <CheckCircle className="h-5 w-5 text-status-success" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              YAML Validation Result
            </DialogTitle>
            <DialogDescription>
              {yamlValidationResult?.isValid ? "No issues found" : "Validation errors detected"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {yamlValidationResult?.resourceKind && (
              <div className="text-sm">
                <span className="text-muted-foreground">Resource: </span>
                <span className="font-medium">
                  {yamlValidationResult.resourceKind}
                  {yamlValidationResult.apiVersion && ` (${yamlValidationResult.apiVersion})`}
                </span>
              </div>
            )}
            {/* 🎯 THEME-024: CSS 변수 기반 에러/경고 색상 */}
            {yamlValidationResult?.errors && yamlValidationResult.errors.length > 0 && (
              <div className="space-y-2 max-h-[300px] overflow-auto">
                {yamlValidationResult.errors.map((error, index) => (
                  <div
                    key={index}
                    className={cn(
                      "p-2 rounded text-sm border",
                      error.type === "syntax"
                        ? "bg-status-error-muted border-status-error-border"
                        : "bg-status-warning-muted border-status-warning-border",
                    )}
                  >
                    <div className="font-medium">
                      {error.type === "syntax" ? "Syntax Error" : "Schema Error"}
                      {error.line && ` (line ${error.line})`}
                    </div>
                    <div className="text-muted-foreground">{error.message}</div>
                    {error.path && <div className="text-xs font-mono mt-1">Path: {error.path}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 📝 FIX-027: Input Dialog removed - replaced with VSCode style inline creation */}

      {/* FIX-032: Delete confirmation dialog (Shadcn AlertDialog) */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteType === "cluster" ? "Delete from Cluster?" : "Delete File/Folder?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteType === "cluster" ? (
                <>
                  Are you sure you want to delete resources defined in{" "}
                  <span className="font-semibold">{deleteTargetEntry?.name}</span> from the cluster? This action cannot
                  be undone.
                </>
              ) : (
                <>
                  Are you sure you want to delete <span className="font-semibold">{deleteTargetEntry?.name}</span>?
                  {deleteTargetEntry?.isDirectory && " This will delete all contents inside."} This action cannot be
                  undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 🆕 내부 이동 덮어쓰기 확인 다이얼로그 */}
      <AlertDialog open={showOverwriteConfirm} onOpenChange={setShowOverwriteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Overwrite Existing File?</AlertDialogTitle>
            <AlertDialogDescription>
              A file with the same name already exists in the target folder. Do you want to replace it? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setOverwriteSource(null);
                setOverwriteTarget(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeOverwrite}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Overwrite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 🆕 외부 복사 충돌 다이얼로그 */}
      <AlertDialog
        open={showCopyConflict}
        onOpenChange={(open) => {
          if (!open) {
            setShowCopyConflict(false);
            setCopyConflictFiles([]);
            setCopyConflictTarget(null);
            setCopyConflictNames([]);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>File Already Exists</AlertDialogTitle>
            <AlertDialogDescription>
              {copyConflictNames.length === 1 ? (
                <>
                  <span className="font-semibold">{copyConflictNames[0]}</span> already exists in the target folder.
                </>
              ) : (
                <>
                  {copyConflictNames.length} files already exist in the target folder:{" "}
                  {copyConflictNames.slice(0, 3).join(", ")}
                  {copyConflictNames.length > 3 ? ` (+${copyConflictNames.length - 3} more)` : ""}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCopyConflictKeepBoth}>Keep Both</AlertDialogAction>
            <AlertDialogAction
              onClick={handleCopyConflictReplace}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 🆕 클립보드 붙여넣기 충돌 다이얼로그 */}
      <AlertDialog
        open={showPasteConflict}
        onOpenChange={(open) => {
          if (!open) {
            setShowPasteConflict(false);
            setPasteConflictTarget(null);
            setPasteConflictName(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>File Already Exists</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold">{pasteConflictName}</span> already exists in the target folder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePasteConflictKeepBoth}>Keep Both</AlertDialogAction>
            <AlertDialogAction
              onClick={handlePasteConflictReplace}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

export { FileExplorerInternal };
export type { FileExplorerInternalProps };
