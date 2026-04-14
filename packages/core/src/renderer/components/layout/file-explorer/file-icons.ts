/**
 * 🎯 목적: 파일/폴더 아이콘 매핑
 * 📝 기능:
 *   - 확장자별 파일 아이콘 매핑
 *   - 폴더 아이콘 (열림/닫힘 상태)
 *   - 기본 파일 아이콘
 * 🔄 변경이력:
 *   - 2026-01-24: 초기 구현
 * @module file-explorer/file-icons
 */

import {
  File,
  FileCode,
  FileJson,
  FileText,
  FileType,
  Folder,
  FolderOpen,
  type LucideIcon,
  Terminal,
} from "lucide-react";

/**
 * 파일 확장자별 아이콘 매핑
 */
const fileIconMap: Record<string, LucideIcon> = {
  // YAML
  yaml: FileCode,
  yml: FileCode,
  // JSON
  json: FileJson,
  // Markdown
  md: FileText,
  markdown: FileText,
  // TypeScript
  ts: FileCode,
  tsx: FileCode,
  // JavaScript
  js: FileCode,
  jsx: FileCode,
  mjs: FileCode,
  cjs: FileCode,
  // Python
  py: FileCode,
  pyw: FileCode,
  // Go
  go: FileCode,
  // Rust
  rs: FileCode,
  // Shell
  sh: Terminal,
  bash: Terminal,
  zsh: Terminal,
  // HTML
  html: FileCode,
  htm: FileCode,
  // CSS
  css: FileCode,
  scss: FileCode,
  sass: FileCode,
  less: FileCode,
  // Text
  txt: FileText,
  log: FileText,
  // Config
  toml: FileCode,
  ini: FileCode,
  cfg: FileCode,
  conf: FileCode,
  env: FileCode,
};

/**
 * 특수 파일명별 아이콘 매핑
 */
const specialFileIconMap: Record<string, LucideIcon> = {
  dockerfile: Terminal,
  makefile: Terminal,
  ".gitignore": FileType,
  ".dockerignore": FileType,
  ".env": FileCode,
  ".env.local": FileCode,
  ".env.development": FileCode,
  ".env.production": FileCode,
};

/**
 * 파일 아이콘 가져오기
 * @param fileName - 파일명
 * @returns lucide-react 아이콘 컴포넌트
 */
export function getFileIcon(fileName: string): LucideIcon {
  const lowerName = fileName.toLowerCase();

  // 특수 파일명 체크
  if (specialFileIconMap[lowerName]) {
    return specialFileIconMap[lowerName];
  }

  // 확장자로 체크
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (fileIconMap[ext]) {
    return fileIconMap[ext];
  }

  // 기본 파일 아이콘
  return File;
}

/**
 * 폴더 아이콘 가져오기
 * @param isExpanded - 펼쳐진 상태 여부
 * @returns lucide-react 아이콘 컴포넌트
 */
export function getFolderIcon(isExpanded: boolean): LucideIcon {
  return isExpanded ? FolderOpen : Folder;
}

/**
 * 파일 확장자에서 색상 클래스 가져오기
 * 🎯 THEME-024: CSS 변수 기반 semantic 색상으로 마이그레이션
 * @param fileName - 파일명
 * @returns CSS 변수 기반 색상 클래스
 */
export function getFileIconColorClass(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const lowerName = fileName.toLowerCase();

  // 특수 파일명 (shell/docker)
  if (lowerName === "dockerfile" || lowerName.endsWith(".sh")) {
    return "text-status-success";
  }

  // 확장자별 색상 (semantic 색상 사용)
  const colorMap: Record<string, string> = {
    // YAML/JSON - warning 계열 (orange/yellow)
    yaml: "text-status-warning",
    yml: "text-status-warning",
    json: "text-status-warning",
    // Markdown - info 계열 (blue)
    md: "text-status-info",
    markdown: "text-status-info",
    // TypeScript - info 계열 (blue)
    ts: "text-status-info",
    tsx: "text-status-info",
    // JavaScript - warning 계열 (yellow)
    js: "text-status-warning",
    jsx: "text-status-warning",
    // Python - info 계열 (blue)
    py: "text-status-info",
    // Go - info 계열 (cyan → info)
    go: "text-status-info",
    // Rust - warning 계열 (orange)
    rs: "text-status-warning",
    // HTML - warning 계열 (orange)
    html: "text-status-warning",
    // CSS - info 계열 (blue)
    css: "text-status-info",
    scss: "text-status-info",
    // Config - warning 계열
    env: "text-status-warning",
  };

  return colorMap[ext] ?? "text-muted-foreground";
}
