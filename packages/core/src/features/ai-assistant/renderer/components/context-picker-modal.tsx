/**
 * 🎯 목적: ContextPickerModal - 컨텍스트 리소스 선택 모달
 * 01: Context Picker Modal UI 구현
 *
 * 🔄 변경이력:
 * - 2026-01-07: 수정 - ALL 탭 레이아웃 깨짐 방지 (min-w, flex-shrink-0)
 * - 2026-01-06: ShadCN 테마 변수로 CSS 수정 (다크 테마 호환성)
 *
 * @packageDocumentation
 */

import { Check, Loader2, Search, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../../../../renderer/lib/utils";
import { ContextType, getContextTypeLabel } from "../../common/context-types";
import { useContextResources } from "../hooks/use-context-resources";
import { ContextIcon } from "./context-icon";

import type { ContextItem, ContextTypeValue } from "../../common/context-types";
import type { ResourceFetcher, ResourceQuery } from "../hooks/use-context-resources";

/** 타입 필터 탭 */
const TYPE_TABS: { id: string; type: ContextTypeValue | "all"; label: string }[] = [
  { id: "all", type: "all", label: "All" },
  { id: "pod", type: ContextType.POD, label: "Pod" },
  { id: "deployment", type: ContextType.DEPLOYMENT, label: "Deployment" },
  { id: "service", type: ContextType.SERVICE, label: "Service" },
  { id: "node", type: ContextType.NODE, label: "Node" },
  { id: "configmap", type: ContextType.CONFIGMAP, label: "ConfigMap" },
];

export interface ContextPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selected: ContextItem | ContextItem[]) => void;
  fetcher: ResourceFetcher;
  multiSelect?: boolean;
  title?: string;
  /** 🆕 2026-01-07: 클러스터 연결 상태 */
  isClusterConnected?: boolean;
}

/**
 * 🎯 목적: 컨텍스트 리소스 선택 모달
 *
 * 📝 주요 기능:
 * - Kubernetes 리소스 목록 표시
 * - 타입별 필터링 (Pod, Deployment, Service 등)
 * - 검색 기능
 * - 단일/다중 선택 지원
 *
 * 🔄 변경이력: 2026-01-06 - ShadCN 테마 변수로 CSS 수정 (다크 테마 호환성)
 */
export function ContextPickerModal({
  isOpen,
  onClose,
  onSelect,
  fetcher,
  multiSelect = false,
  title = "Select Context",
  isClusterConnected = true,
}: ContextPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ContextTypeValue | "all">("all");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const { resources, isLoading, error, fetchResources } = useContextResources({ fetcher });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalTitleId = useRef(`context-picker-title-${Date.now()}`);

  const buildQuery = useCallback((): ResourceQuery => {
    const types: ContextTypeValue[] =
      activeTab === "all" ? [ContextType.POD, ContextType.DEPLOYMENT, ContextType.SERVICE] : [activeTab];
    return { types, search: searchQuery || undefined };
  }, [activeTab, searchQuery]);

  useEffect(() => {
    if (isOpen) {
      fetchResources(buildQuery());
      setHighlightedIndex(-1);
      setSelectedItems(new Set());
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen, fetchResources, buildQuery]);

  useEffect(() => {
    if (isOpen) {
      fetchResources(buildQuery());
      setHighlightedIndex(-1);
    }
  }, [searchQuery, activeTab]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (resources.length === 0) return;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((p) => Math.min(p + 1, resources.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((p) => Math.max(p - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0) handleItemClick(resources[highlightedIndex]);
          break;
      }
    },
    [isOpen, resources, highlightedIndex, onClose],
  );

  const handleItemClick = useCallback(
    (item: ContextItem) => {
      if (multiSelect) {
        setSelectedItems((prev) => {
          const next = new Set(prev);
          next.has(item.id) ? next.delete(item.id) : next.add(item.id);
          return next;
        });
      } else {
        onSelect(item);
        onClose();
      }
    },
    [multiSelect, onSelect, onClose],
  );

  const handleConfirm = useCallback(() => {
    onSelect(resources.filter((r) => selectedItems.has(r.id)));
    onClose();
  }, [resources, selectedItems, onSelect, onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      data-testid="modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
    >
      {/* 🎯 2026-01-06: ShadCN 테마 변수 사용 (다크 테마 호환) */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={modalTitleId.current}
        className="w-full max-w-lg max-h-[80vh] bg-popover text-popover-foreground rounded-lg shadow-xl flex flex-col border border-border"
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 id={modalTitleId.current} className="text-lg font-semibold text-foreground">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 검색 */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-background text-foreground border border-input rounded-md placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 타입 필터 탭 - 🆕 overflow-x-auto 제거 (불필요한 스크롤 방지) */}
        <div className="flex gap-1 p-2 border-b border-border" role="tablist">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.type}
              onClick={() => setActiveTab(tab.type)}
              className={cn(
                // 🎯 기본 스타일 - 충분한 높이와 패딩으로 pill 형태 보장
                "min-w-[60px] h-8 flex-shrink-0 px-3 py-1.5 text-sm font-medium",
                "rounded-md whitespace-nowrap transition-colors text-center",
                "inline-flex items-center justify-center",
                activeTab === tab.type
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 리소스 목록 */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading && (
            <div data-testid="loading-indicator" className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-destructive mb-2">An error occurred</p>
              <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
              <button
                type="button"
                onClick={() => fetchResources(buildQuery())}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Try again
              </button>
            </div>
          )}
          {!isLoading && !error && resources.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-center">
              {!isClusterConnected ? (
                <>
                  <p className="font-medium">No cluster connected</p>
                  <p className="text-sm mt-1">Connect to a cluster to add Kubernetes resources</p>
                </>
              ) : (
                <p>No resources found</p>
              )}
            </div>
          )}
          {!isLoading && !error && resources.length > 0 && (
            <ul className="space-y-1">
              {resources.map((r, idx) => (
                <li
                  key={r.id}
                  onClick={() => handleItemClick(r)}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors",
                    highlightedIndex === idx && "highlighted bg-accent",
                    selectedItems.has(r.id) && "bg-accent/50",
                    "hover:bg-accent",
                  )}
                >
                  <ContextIcon type={r.type} className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-foreground">{r.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.namespace} · {getContextTypeLabel(r.type)}
                    </div>
                  </div>
                  {multiSelect && selectedItems.has(r.id) && <Check className="w-5 h-5 text-primary" />}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 다중 선택 푸터 */}
        {multiSelect && (
          <div className="flex items-center justify-between p-4 border-t border-border">
            <span className="text-sm text-muted-foreground">{selectedItems.size} selected</span>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedItems.size === 0}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
