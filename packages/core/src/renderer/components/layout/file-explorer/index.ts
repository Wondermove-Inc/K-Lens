/**
 * 🎯 목적: FileExplorer 모듈 barrel export
 * 📝 기능:
 *   - FileExplorer 컴포넌트 export
 *   - FileExplorerStore export
 *   - 타입 export
 * 🔄 변경이력:
 *   - 2026-01-24: 초기 구현
 * @module file-explorer/index
 */

export { FileExplorerInternal } from "./file-explorer";
// Components
export { FileExplorer } from "./file-explorer.injectable";
export { detectLanguage } from "./file-explorer.types";
// Store
export { FileExplorerStore } from "./file-explorer-store";
export { default as fileExplorerStoreInjectable } from "./file-explorer-store.injectable";
// Icons
export { getFileIcon, getFileIconColorClass, getFolderIcon } from "./file-icons";
export { FileTreeNode } from "./file-tree-node";

// Types
export type {
  FileEntry,
  FileExplorerProps,
  FileTreeNodeProps,
  SupportedLanguage,
} from "./file-explorer.types";
