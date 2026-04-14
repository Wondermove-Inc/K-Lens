/**
 * 🎯 목적: QuickSearch 모듈 barrel export
 * 📝 기능:
 *   - QuickFileSearch 컴포넌트 export
 *   - GlobalSearch 컴포넌트 export
 *   - 훅 및 타입 export
 * 🔄 변경이력:
 *   - 2026-01-24: 초기 구현
 *   - 2026-01-24: GlobalSearch 추가
 * @module quick-search/index
 */

export { GlobalSearch } from "./global-search";
// Components
export { QuickFileSearch } from "./quick-file-search";
// Hooks
export { useFileSearch } from "./use-file-search";
export { useGlobalSearch } from "./use-global-search";

export type { GlobalSearchProps } from "./global-search";
export type { QuickFileSearchProps } from "./quick-file-search";
export type { FileSearchResult, SearchResultItem } from "./use-file-search";
export type {
  GlobalSearchOptions,
  GlobalSearchResult,
  GlobalSearchState,
} from "./use-global-search";
