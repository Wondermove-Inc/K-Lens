/**
 * 🎯 목적: 파일 탐색기 타입 정의
 * 📝 기능:
 *   - FileEntry 인터페이스 정의
 *   - FileExplorer 컴포넌트 props 정의
 * 🔄 변경이력:
 *   - 2026-01-24: 초기 구현
 * @module file-explorer/file-explorer.types
 */

import type React from "react";

/**
 * 파일/폴더 엔트리 인터페이스
 */
export interface FileEntry {
  /** 파일/폴더 이름 */
  name: string;
  /** 전체 경로 */
  path: string;
  /** 디렉토리 여부 */
  isDirectory: boolean;
  /** 디렉토리 펼침 상태 (디렉토리만 해당) */
  isExpanded?: boolean;
  /** 하위 엔트리 목록 (디렉토리만 해당, 지연 로드) */
  children?: FileEntry[];
  /** 하위 엔트리 로딩 중 여부 */
  isLoading?: boolean;
  /** 파일 크기 (바이트) */
  size?: number;
  /** 수정 시간 (timestamp) */
  modifiedAt?: number;
}

/**
 * FileExplorer 컴포넌트 props
 */
export interface FileExplorerProps {
  /** 파일 더블클릭 이벤트 핸들러 */
  onFileDoubleClick?: (entry: FileEntry) => void;
  /** 파일 선택 이벤트 핸들러 */
  onFileSelect?: (entry: FileEntry | null) => void;
  /** 컴포넌트 클래스명 */
  className?: string;
  /** 현재 선택된 클러스터 ID (kubectl apply 용) */
  clusterId?: string;
  /** 🆕 FIX-035: 현재 선택된 클러스터 이름 (알림 표시용) */
  clusterName?: string;
  /** 터미널 열기 콜백 (경로를 인자로 받음) */
  onOpenTerminal?: (path: string) => void;
}

/**
 * FileTreeNode 컴포넌트 props
 * 📝 FIX-016: expandedPaths, loadingPaths 추가하여 MobX Observable Set 직접 참조
 * 📝 FIX-027: 인라인 생성 관련 props 추가
 */
export interface FileTreeNodeProps {
  /** 파일/폴더 엔트리 */
  entry: FileEntry;
  /** 깊이 (들여쓰기용) */
  depth: number;
  /** 선택된 경로 */
  selectedPath: string | null;
  /** 🆕 FIX-016: 펼쳐진 경로 Set (MobX Observable) */
  expandedPaths: Set<string>;
  /** 🆕 FIX-016: 로딩 중인 경로 Set (MobX Observable) */
  loadingPaths: Set<string>;
  /** 파일 클릭 이벤트 핸들러 */
  onSelect: (entry: FileEntry) => void;
  /** 파일 더블클릭 이벤트 핸들러 */
  onDoubleClick: (entry: FileEntry) => void;
  /** 디렉토리 토글 이벤트 핸들러 */
  onToggle: (entry: FileEntry) => void;
  /** 우클릭 컨텍스트 메뉴 열기 이벤트 핸들러 */
  onContextMenu?: (entry: FileEntry, event: React.MouseEvent) => void;
  /** 🆕 FIX-027: 인라인 생성 부모 경로 */
  inlineCreateParentPath?: string | null;
  /** 🆕 FIX-027: 인라인 생성 타입 (file/folder) */
  inlineCreateType?: "file" | "folder" | null;
  /** 🆕 FIX-027: 인라인 생성 완료 핸들러 */
  onInlineCreateConfirm?: (name: string) => void;
  /** 🆕 FIX-027: 인라인 생성 취소 핸들러 */
  onInlineCreateCancel?: () => void;
  /** 인라인 리네임 대상 경로 */
  renamingPath?: string | null;
  /** 인라인 리네임 확인 핸들러 */
  onRenameConfirm?: (path: string, newName: string) => void;
  /** 인라인 리네임 취소 핸들러 */
  onRenameCancel?: () => void;
  /** 🆕 드래그 앤 드롭 이벤트 핸들러 */
  onDragStart?: (entry: FileEntry, event: React.DragEvent) => void;
  onDragOver?: (entry: FileEntry, event: React.DragEvent) => void;
  onDragLeave?: (entry: FileEntry, event: React.DragEvent) => void;
  onDrop?: (entry: FileEntry, event: React.DragEvent) => void;
  onDragEnd?: (event: React.DragEvent) => void;
  /** 🆕 드래그 앤 드롭 상태 */
  dragSourcePath?: string | null;
  dragOverPath?: string | null;
}

/**
 * 지원하는 프로그래밍 언어 타입
 */
export type SupportedLanguage =
  | "yaml"
  | "json"
  | "markdown"
  | "typescript"
  | "javascript"
  | "python"
  | "go"
  | "rust"
  | "shell"
  | "dockerfile"
  | "html"
  | "css"
  | "plaintext";

/**
 * 파일 확장자에서 언어 타입 추론
 * @param fileName - 파일명
 * @returns 언어 타입
 */
export function detectLanguage(fileName: string): SupportedLanguage {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  const languageMap: Record<string, SupportedLanguage> = {
    // YAML
    yaml: "yaml",
    yml: "yaml",
    // JSON
    json: "json",
    // Markdown
    md: "markdown",
    markdown: "markdown",
    // TypeScript
    ts: "typescript",
    tsx: "typescript",
    // JavaScript
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    // Python
    py: "python",
    pyw: "python",
    // Go
    go: "go",
    // Rust
    rs: "rust",
    // Shell
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    // Dockerfile
    dockerfile: "dockerfile",
    // HTML
    html: "html",
    htm: "html",
    // CSS
    css: "css",
    scss: "css",
    sass: "css",
    less: "css",
  };

  // Dockerfile 특수 처리 (확장자 없음)
  if (fileName.toLowerCase() === "dockerfile") {
    return "dockerfile";
  }

  return languageMap[ext] ?? "plaintext";
}
