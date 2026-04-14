/**
 * Copyright (c) Wondermove Inc.. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * (updated): DaiveGroupSidebar — 위험도 기반 그룹 사이드바
 *
 * 위험도 3단계 섹션 (Critical 🔴 / Warning 🟡 / Info 🟢)
 * NS 단위 하위 그룹핑 + 상태 아이콘 + Ops/Dev 배지 + 검색
 *
 * @packageDocumentation
 */

import React, { useMemo, useState } from "react";
import { classifyIssueOwnership } from "./daive-finding-context";

import type { ActionType, DaiveGroup, GroupCategory } from "./daive-group-types";

// ============================================
// SVG Icons
// ============================================

const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

const ChevronRightIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);

// ============================================
// Status icon
// ============================================

// StatusIcon 제거됨 — 그룹 리스트에서 도트/체크박스 아이콘 비활성화 (취약점 제목 가시성 우선)

// ============================================
// ActionType badge
// ============================================

function ActionTypeBadge({ actionType }: { actionType: ActionType }) {
  const map: Record<ActionType, { label: string; cls: string }> = {
    "config-fix": { label: "Config", cls: "border-violet-500/30 bg-violet-500/10 text-violet-300" },
    "image-upgrade": { label: "Image", cls: "border-blue-500/30 bg-blue-500/10 text-blue-300" },
    "manual-review": { label: "Manual", cls: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400" },
  };
  const m = map[actionType];
  return <span className={`text-[11px] px-1.5 py-0.5 rounded border font-medium shrink-0 ${m.cls}`}>{m.label}</span>;
}

// ============================================
// Category config
// ============================================

const CATEGORY_META: Record<
  GroupCategory,
  {
    label: string;
    emoji: string;
    color: string;
    dotColor: string;
  }
> = {
  critical: { label: "Critical", emoji: "", color: "text-red-400", dotColor: "bg-red-500" },
  warning: { label: "Warning", emoji: "", color: "text-amber-400", dotColor: "bg-amber-500" },
  info: { label: "Info", emoji: "", color: "text-emerald-400", dotColor: "bg-emerald-500" },
};

const CATEGORY_ORDER: GroupCategory[] = ["critical", "warning", "info"];

// ============================================
// Props
// ============================================

export interface DaiveGroupSidebarProps {
  groups: DaiveGroup[];
  selectedGroupId: string | null;
  onGroupSelect: (groupId: string) => void;
  totalCount?: number;
  appliedCount?: number;
}

// ============================================
// DaiveGroupSidebar
// ============================================

export const DaiveGroupSidebar: React.FC<DaiveGroupSidebarProps> = ({
  groups,
  selectedGroupId,
  onGroupSelect,
  totalCount,
  appliedCount,
}) => {
  const [query, setQuery] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<GroupCategory>>(
    new Set(["critical", "warning", "info"] as GroupCategory[]),
  );

  const toggleCategory = (cat: GroupCategory) =>
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });

  const filtered = useMemo(() => {
    if (!query.trim()) return groups;
    const q = query.toLowerCase();
    return groups.filter(
      (g) =>
        g.label.toLowerCase().includes(q) ||
        g.groupId.toLowerCase().includes(q) ||
        (g.namespaces ?? (g.namespace ? [g.namespace] : [])).some((ns) => ns.toLowerCase().includes(q)),
    );
  }, [groups, query]);

  // 위험도별 그룹화
  const byCategory = useMemo(() => {
    const map = new Map<GroupCategory, DaiveGroup[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const g of filtered) map.get(g.category)?.push(g);
    return map;
  }, [filtered]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-muted/10">
      {/* 헤더 */}
      <div className="px-3 py-2.5 border-b border-border/40 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-foreground">Groups</span>
          {totalCount !== undefined && (
            <span className="text-sm text-muted-foreground">
              {appliedCount ?? 0}/{totalCount}
            </span>
          )}
        </div>
        <div className="relative">
          <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="w-full pl-6 pr-2 py-1.5 text-sm bg-background border border-border/50 rounded focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* 카테고리 섹션 */}
      <div className="flex-1 overflow-y-auto py-1">
        {CATEGORY_ORDER.map((cat) => {
          const items = byCategory.get(cat) ?? [];
          if (items.length === 0) return null;
          const meta = CATEGORY_META[cat];
          const isCollapsed = collapsedCategories.has(cat);

          return (
            <div key={cat} className="mb-0.5">
              {/* 카테고리 헤더 */}
              <button
                className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-muted/20 transition-colors"
                onClick={() => toggleCategory(cat)}
              >
                <ChevronRightIcon
                  className={`w-3 h-3 text-muted-foreground transition-transform shrink-0 ${isCollapsed ? "" : "rotate-90"}`}
                />
                <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dotColor}`} />
                <span className={`text-sm font-semibold ${meta.color}`}>{meta.label}</span>
                <span className="ml-auto text-xs text-muted-foreground bg-muted/50 rounded px-1 shrink-0">
                  {items.length}
                </span>
              </button>

              {/* 그룹 목록 */}
              {!isCollapsed &&
                items.map((g) => {
                  const isSelected = g.groupId === selectedGroupId;
                  const ownership = g.findings.length > 0 ? classifyIssueOwnership(g.findings[0]) : "unknown";

                  return (
                    <button
                      key={g.groupId}
                      className={[
                        "w-full text-left pl-7 pr-2 py-2 flex items-start gap-2 transition-colors border-l-2",
                        isSelected ? "bg-violet-950/30 border-violet-500" : "border-transparent hover:bg-muted/15",
                      ].join(" ")}
                      onClick={() => onGroupSelect(g.groupId)}
                    >
                      <div className="flex-1 min-w-0">
                        {/* Row 1: 그룹명 + finding 수 */}
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="text-sm font-medium truncate text-foreground flex-1">{g.label}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{g.findings.length}</span>
                        </div>
                        {/* Row 2: 라벨링 (actionType + ownership) */}
                        <div className="flex items-center gap-1">
                          <ActionTypeBadge actionType={g.actionType} />
                          {ownership !== "unknown" && (
                            <span
                              className={[
                                "text-[11px] px-1 rounded border font-semibold uppercase shrink-0",
                                ownership === "ops"
                                  ? "border-purple-500/40 bg-purple-500/10 text-purple-300"
                                  : "border-orange-500/40 bg-orange-500/10 text-orange-300",
                              ].join(" ")}
                            >
                              {ownership}
                            </span>
                          )}
                          {(() => {
                            const nsList = g.namespaces?.length ? g.namespaces : g.namespace ? [g.namespace] : [];
                            if (nsList.length === 0) return null;
                            if (nsList.length === 1)
                              return (
                                <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[70px]">
                                  {nsList[0]}
                                </span>
                              );
                            return (
                              <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[70px]">
                                {nsList[0]} +{nsList.length - 1}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            {query ? "No matches" : "No groups"}
          </div>
        )}
      </div>
    </div>
  );
};
